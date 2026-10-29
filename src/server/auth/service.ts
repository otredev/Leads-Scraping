import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { updateAccounts, readAccounts, type Session, type User } from "./accounts";
import { hashSecret, normalizeRecoveryCode, randomToken, recoveryCode, sha256, verifySecret } from "./crypto";
import { clearAttempts, clientIp, rateLimit, startSession, type Auth } from "./session";

/**
 * Registro, inicio de sesión, perfil, sesiones y recuperación de la contraseña.
 * Registro abierto: cada cuenta tiene sus propios datos (ver server/tenant.ts).
 */

const bad = (m: string, status = 400) => Object.assign(new Error(m), { status });

const MIN_PASSWORD = 8;
const RESET_MINUTES = 60;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt?: string;
  /** Es la primera cuenta (la que tiene los datos de antes del inicio de sesión). */
  founder: boolean;
  /** Tiene un token de Claude (MCP) creado. */
  hasMcpToken: boolean;
}

export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.createdAt,
  ...(u.lastLoginAt ? { lastLoginAt: u.lastLoginAt } : {}),
  founder: u.dataKey === "",
  hasMcpToken: Boolean(u.mcpTokenHash),
});

const str = (v: unknown) => (typeof v === "string" ? v : "");

function cleanEmail(v: unknown) {
  const email = str(v).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw bad("Escribe un email válido");
  return email;
}

function cleanName(v: unknown) {
  const name = str(v).trim().replace(/\s+/g, " ");
  if (name.length < 2) throw bad("Escribe tu nombre");
  return name.slice(0, 80);
}

function checkPassword(v: unknown, field = "La contraseña") {
  const p = str(v);
  if (p.length < MIN_PASSWORD) throw bad(`${field} debe tener al menos ${MIN_PASSWORD} caracteres`);
  if (p.length > 200) throw bad(`${field} es demasiado larga`);
  if (/^(.)\1+$/.test(p) || /^(12345678|password|contraseña|qwertyui)/i.test(p)) throw bad(`${field} es demasiado fácil de adivinar`);
  return p;
}

/** Hay registro abierto salvo REGISTRATION=closed (entonces solo se puede crear la primera cuenta). */
export const registrationOpen = async () => process.env.REGISTRATION !== "closed" || (await readAccounts()).users.length === 0;

// ── Registro e inicio de sesión ──

export async function register(request: Request, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  rateLimit(`register:${clientIp(request) ?? "?"}`, 10, 60 * 60_000);
  const email = cleanEmail(r.email);
  const name = cleanName(r.name);
  const password = checkPassword(r.password);
  if (r.accept !== true) throw bad("Acepta las condiciones para crear la cuenta");
  const code = recoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(normalizeRecoveryCode(code))]);
  const now = new Date().toISOString();
  const user = await updateAccounts((d) => {
    if (process.env.REGISTRATION === "closed" && d.users.length > 0) throw bad("El registro de cuentas nuevas está cerrado", 403);
    if (d.users.some((u) => u.email === email)) throw bad("Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.", 409);
    const u: User = {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      recoveryHash,
      // La primera cuenta se queda con los datos que ya había; las demás empiezan vacías.
      dataKey: d.users.length === 0 ? "" : `u_${randomBytes(6).toString("hex")}`,
      createdAt: now,
      updatedAt: now,
    };
    d.users.push(u);
    return u;
  });
  const cookie = await startSession(request, user.id);
  return { user: publicUser(user), recoveryCode: code, cookie };
}

export async function login(request: Request, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const email = str(r.email).trim().toLowerCase();
  const password = str(r.password);
  const ipKey = `login-ip:${clientIp(request) ?? "?"}`;
  const emailKey = `login:${email}`;
  rateLimit(ipKey, 30);
  rateLimit(emailKey, 8);
  const user = (await readAccounts()).users.find((u) => u.email === email);
  // Se calcula el hash aunque no exista la cuenta, para no delatar qué emails están registrados.
  const ok = await verifySecret(password, user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!user || !ok) throw bad("Email o contraseña incorrectos", 401);
  clearAttempts(emailKey);
  const cookie = await startSession(request, user.id);
  return { user: publicUser(user), cookie };
}

export async function logout(auth: Auth) {
  await updateAccounts((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== auth.session.id);
  });
}

// ── Perfil ──

export async function updateProfile(auth: Auth, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = r.name !== undefined ? cleanName(r.name) : undefined;
  const email = r.email !== undefined ? cleanEmail(r.email) : undefined;
  if (email && email !== auth.user.email) {
    // Cambiar el email cambia el acceso: se confirma con la contraseña.
    if (!(await verifySecret(str(r.currentPassword), auth.user.passwordHash))) throw bad("La contraseña actual no es correcta", 401);
  }
  const user = await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === auth.user.id);
    if (!u) throw bad("Cuenta no encontrada", 404);
    if (email && email !== u.email && d.users.some((x) => x.email === email)) throw bad("Ya hay otra cuenta con ese email", 409);
    if (name) u.name = name;
    if (email) u.email = email;
    u.updatedAt = new Date().toISOString();
    return u;
  });
  return publicUser(user);
}

export async function changePassword(auth: Auth, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  rateLimit(`password:${auth.user.id}`, 8);
  if (!(await verifySecret(str(r.currentPassword), auth.user.passwordHash))) throw bad("La contraseña actual no es correcta", 401);
  const next = checkPassword(r.newPassword, "La nueva contraseña");
  const hash = await hashSecret(next);
  await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === auth.user.id);
    if (!u) throw bad("Cuenta no encontrada", 404);
    u.passwordHash = hash;
    u.updatedAt = new Date().toISOString();
    // Se cierran las demás sesiones: si alguien la conocía, deja de tener acceso.
    d.sessions = d.sessions.filter((s) => s.userId !== u.id || s.id === auth.session.id);
    d.resets = d.resets.filter((x) => x.userId !== u.id);
  });
  return { ok: true };
}

/** Nuevo código de recuperación (el anterior deja de valer). */
export async function newRecoveryCode(auth: Auth, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!(await verifySecret(str(r.currentPassword), auth.user.passwordHash))) throw bad("La contraseña actual no es correcta", 401);
  const code = recoveryCode();
  const hash = await hashSecret(normalizeRecoveryCode(code));
  await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === auth.user.id);
    if (u) u.recoveryHash = hash;
  });
  return { recoveryCode: code };
}

// ── Sesiones ──

export interface SessionView {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent?: string;
  ip?: string;
}

export async function listSessions(auth: Auth): Promise<SessionView[]> {
  const now = Date.now();
  return (await readAccounts()).sessions
    .filter((s) => s.userId === auth.user.id && Date.parse(s.expiresAt) > now)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .map((s: Session) => ({
      id: s.id,
      current: s.id === auth.session.id,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      ...(s.userAgent ? { userAgent: s.userAgent } : {}),
      ...(s.ip ? { ip: s.ip } : {}),
    }));
}

/** Cierra una sesión ({ id }) o todas menos la actual ({ others: true }). */
export async function closeSessions(auth: Auth, { id, others }: { id?: string; others?: boolean }) {
  return updateAccounts((d) => {
    const before = d.sessions.length;
    d.sessions = d.sessions.filter((s) => s.userId !== auth.user.id || (others ? s.id === auth.session.id : s.id !== id));
    return { closed: before - d.sessions.length };
  });
}

// ── Recuperar la contraseña ──

/** Con el código de recuperación: { email, code, newPassword }. Devuelve un código nuevo. */
export async function recoverWithCode(request: Request, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const email = str(r.email).trim().toLowerCase();
  rateLimit(`recover-ip:${clientIp(request) ?? "?"}`, 20);
  rateLimit(`recover:${email}`, 6, 60 * 60_000);
  const user = (await readAccounts()).users.find((u) => u.email === email);
  const ok = await verifySecret(normalizeRecoveryCode(str(r.code)), user?.recoveryHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!user || !ok) throw bad("El email o el código de recuperación no son correctos", 401);
  const password = checkPassword(r.newPassword, "La nueva contraseña");
  const code = recoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(normalizeRecoveryCode(code))]);
  await setPassword(user.id, passwordHash, recoveryHash);
  const cookie = await startSession(request, user.id);
  return { recoveryCode: code, cookie };
}

/** Por email (si hay servicio de envío configurado). Siempre responde igual, exista o no la cuenta. */
export async function requestEmailReset(request: Request, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!emailConfigured()) throw bad("El envío de emails no está configurado: usa tu código de recuperación.", 400);
  rateLimit(`reset-ip:${clientIp(request) ?? "?"}`, 10, 60 * 60_000);
  const email = str(r.email).trim().toLowerCase();
  rateLimit(`reset:${email}`, 3, 60 * 60_000);
  const user = (await readAccounts()).users.find((u) => u.email === email);
  if (!user) return { sent: true };
  const token = randomToken();
  await updateAccounts((d) => {
    d.resets = d.resets.filter((x) => x.userId !== user.id);
    d.resets.push({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString() });
  });
  const base = (process.env.APP_URL?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
  const link = `${base}/recuperar?token=${token}`;
  await sendEmail(user.email, "Cambia tu contraseña de Leads Scraping", [
    `Hola ${user.name},`,
    "",
    `Para elegir una contraseña nueva, abre este enlace (caduca en ${RESET_MINUTES} minutos):`,
    link,
    "",
    "Si no lo has pedido tú, ignora este email: tu contraseña no cambia.",
  ]);
  return { sent: true };
}

/** Con el enlace del email: { token, newPassword }. */
export async function resetWithToken(request: Request, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  rateLimit(`reset-token:${clientIp(request) ?? "?"}`, 20);
  const hash = sha256(str(r.token));
  const reset = (await readAccounts()).resets.find((x) => x.tokenHash === hash && Date.parse(x.expiresAt) > Date.now());
  if (!reset) throw bad("El enlace ha caducado o ya se usó. Pide otro.", 400);
  const password = checkPassword(r.newPassword, "La nueva contraseña");
  await setPassword(reset.userId, await hashSecret(password));
  const cookie = await startSession(request, reset.userId);
  return { cookie };
}

async function setPassword(userId: string, passwordHash: string, recoveryHash?: string) {
  await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === userId);
    if (!u) throw bad("Cuenta no encontrada", 404);
    u.passwordHash = passwordHash;
    if (recoveryHash) u.recoveryHash = recoveryHash;
    u.updatedAt = new Date().toISOString();
    // Contraseña nueva: se cierran todas las sesiones y enlaces anteriores.
    d.sessions = d.sessions.filter((s) => s.userId !== userId);
    d.resets = d.resets.filter((x) => x.userId !== userId);
  });
}

// ── Email (opcional): Resend, gratis hasta 3.000 emails/mes ──

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());

async function sendEmail(to: string, subject: string, lines: string[]) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [to], subject, text: lines.join("\n") }),
    signal: AbortSignal.timeout(15_000),
  }).catch((err: Error) => {
    throw bad(`No se pudo enviar el email: ${err.message}`, 502);
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw bad(`El servicio de email respondió ${res.status}${body.message ? `: ${body.message}` : ""}`, 502);
  }
}

// ── Claude (MCP): un token por cuenta ──

export async function createMcpToken(auth: Auth) {
  const token = `lsm_${randomToken(24)}`;
  await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === auth.user.id);
    if (u) u.mcpTokenHash = sha256(token);
  });
  return { token };
}

export async function revokeMcpToken(auth: Auth) {
  await updateAccounts((d) => {
    const u = d.users.find((x) => x.id === auth.user.id);
    if (u) delete u.mcpTokenHash;
  });
}

export async function userByMcpToken(token: string): Promise<User | undefined> {
  if (!token.startsWith("lsm_")) return undefined;
  const hash = sha256(token);
  return (await readAccounts()).users.find((u) => u.mcpTokenHash === hash);
}

/** La primera cuenta (para MCP_TOKEN y las conexiones locales sin token, como antes). */
export async function founderUser(): Promise<User | undefined> {
  return (await readAccounts()).users.find((u) => u.dataKey === "");
}

// ── Eliminar la cuenta ──

export async function deleteAccount(auth: Auth, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!(await verifySecret(str(r.currentPassword), auth.user.passwordHash))) throw bad("La contraseña no es correcta", 401);
  if (str(r.confirm).trim().toLowerCase() !== auth.user.email) throw bad("Escribe tu email para confirmar");
  const { destroyTenantData } = await import("../registry");
  await destroyTenantData(auth.user.dataKey);
  await updateAccounts((d) => {
    d.users = d.users.filter((u) => u.id !== auth.user.id);
    d.sessions = d.sessions.filter((s) => s.userId !== auth.user.id);
    d.resets = d.resets.filter((x) => x.userId !== auth.user.id);
  });
  return { deleted: true };
}

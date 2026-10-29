import "server-only";
import { randomUUID } from "node:crypto";
import { readAccounts, updateAccounts, type Session, type User } from "./accounts";
import { randomToken, sha256 } from "./crypto";
import type { Tenant } from "../tenant";

/** Sesión en una cookie httpOnly; en el servidor solo se guarda su hash. */

export const SESSION_COOKIE = "ls_session";
const SESSION_DAYS = 30;
/** Se renueva (y se apunta "última actividad") como mucho cada 5 minutos. */
const TOUCH_MS = 5 * 60_000;

export interface Auth {
  user: User;
  session: Session;
}

export const tenantOf = (user: User): Tenant => ({ userId: user.id, dataKey: user.dataKey });

export function readCookie(request: Request, name = SESSION_COOKIE): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim() || undefined;
}

const isHttps = (request: Request) => new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

export function sessionCookie(request: Request, token: string, maxAgeSeconds = SESSION_DAYS * 86_400) {
  return [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`, ...(isHttps(request) ? ["Secure"] : [])].join("; ");
}

export const clearSessionCookie = (request: Request) => sessionCookie(request, "", 0);

/** Crea una sesión y devuelve la cabecera Set-Cookie. */
export async function startSession(request: Request, userId: string) {
  const token = randomToken();
  const now = new Date();
  const session: Session = {
    id: randomUUID(),
    tokenHash: sha256(token),
    userId,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    userAgent: request.headers.get("user-agent")?.slice(0, 300) || undefined,
    ip: clientIp(request),
  };
  await updateAccounts((d) => {
    d.sessions.push(session);
    const user = d.users.find((u) => u.id === userId);
    if (user) user.lastLoginAt = session.createdAt;
  });
  return sessionCookie(request, token);
}

/** Usuario y sesión de la petición, o undefined si no hay sesión válida. */
export async function authenticate(request: Request): Promise<Auth | undefined> {
  const token = readCookie(request);
  if (!token || token.length > 200) return undefined;
  const hash = sha256(token);
  const data = await readAccounts();
  const session = data.sessions.find((s) => s.tokenHash === hash);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return undefined;
  const user = data.users.find((u) => u.id === session.userId);
  if (!user) return undefined;
  if (Date.now() - Date.parse(session.lastSeenAt) > TOUCH_MS) {
    const now = new Date();
    void updateAccounts((d) => {
      const s = d.sessions.find((x) => x.id === session.id);
      if (!s) return;
      s.lastSeenAt = now.toISOString();
      s.expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
      s.ip = clientIp(request) ?? s.ip;
    }).catch(() => undefined);
  }
  return { user, session };
}

// ── Límite de intentos (en memoria: inicio de sesión, registro y recuperación) ──

const g = globalThis as unknown as { __authAttempts?: Map<string, number[]> };
const attempts = (g.__authAttempts ??= new Map());

/** Lanza 429 si la clave superó el máximo de intentos en la ventana. */
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (list.length >= max) {
    const wait = Math.ceil((windowMs - (now - list[0])) / 60_000);
    throw Object.assign(new Error(`Demasiados intentos. Espera ${wait} ${wait === 1 ? "minuto" : "minutos"} y vuelve a probar.`), { status: 429 });
  }
  list.push(now);
  attempts.set(key, list);
  if (attempts.size > 5000) attempts.clear();
}

/** Tras un acceso correcto, se olvidan los fallos de esa clave. */
export const clearAttempts = (key: string) => attempts.delete(key);

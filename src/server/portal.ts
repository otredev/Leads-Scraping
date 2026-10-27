import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { projectProgress, projectTotals, statusLabel, type Client } from "@/core/clients";
import { PORTAL_SNAPSHOT_VERSION, type PortalBrand, type PortalSnapshot, type PortalStatus } from "@/core/portal";
import { getStore } from "./registry";

/**
 * Publicación del portal del cliente (Cloudflare Workers + D1, carpeta portal/).
 *
 * La app construye un snapshot solo con lo visible para el cliente y lo envía
 * al portal con PORTAL_SECRET. Los cambios de proyectos y tareas se publican
 * solos a los pocos segundos.
 */

export function portalConfig() {
  const url = process.env.PORTAL_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.PORTAL_SECRET?.trim();
  return { url, secret, configured: Boolean(url && secret && secret.length >= 16) };
}

const bad = (m: string, status = 400) => Object.assign(new Error(m), { status });

async function portalFetch(path: string, init: RequestInit = {}) {
  const { url, secret, configured } = portalConfig();
  if (!configured) throw bad("Configura PORTAL_URL y PORTAL_SECRET en .env.local para usar el portal del cliente.");
  let res: Response;
  try {
    res = await fetch(`${url}/api${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw bad(`No se pudo conectar con el portal (${url}): ${(err as Error).message}`, 502);
  }
  return res;
}

async function portalError(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) return bad("El portal rechazó el secreto: PORTAL_SECRET no coincide con el del portal.", 502);
  return bad(`El portal respondió ${res.status}${body.error ? `: ${body.error}` : ""}`, 502);
}

export const portalLink = (token: string) => `${portalConfig().url}/p/${token}`;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(24).toString("base64url");

/** Comprueba la conexión con el portal (para Ajustes). */
export async function portalHealth(): Promise<{ ok: boolean; message: string }> {
  const { configured, url } = portalConfig();
  if (!configured) return { ok: false, message: "Sin configurar: añade PORTAL_URL y PORTAL_SECRET a .env.local" };
  try {
    const res = await portalFetch("/health");
    if (!res.ok) throw await portalError(res);
    return { ok: true, message: `Conectado con ${url}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function digits(v?: string) {
  const d = v?.replace(/\D/g, "");
  return d && d.length >= 8 ? d : undefined;
}

/** Construye lo que verá el cliente: solo proyectos no cancelados y lo marcado como visible. */
export async function buildSnapshot(client: Client): Promise<PortalSnapshot> {
  const store = getStore();
  const [projects, tasks, settings] = await Promise.all([store.listProjects({ clientId: client.id }), store.listTasks({ clientId: client.id }), store.getSettings()]);
  const b = settings.portal ?? {};
  const brand: PortalBrand = {
    name: b.brandName?.trim() || "Portal de clientes",
    ...(b.email ? { email: b.email } : {}),
    ...(b.phone ? { phone: b.phone } : {}),
    ...(digits(b.whatsapp) ? { whatsapp: digits(b.whatsapp) } : {}),
    ...(b.website ? { website: b.website } : {}),
    ...(b.welcome ? { welcome: b.welcome } : {}),
  };
  const item = (x: { title: string; dueAt?: string; done: boolean; doneAt?: string }) => ({
    title: x.title,
    done: x.done,
    ...(x.dueAt ? { dueAt: x.dueAt } : {}),
    ...(x.doneAt ? { doneAt: x.doneAt } : {}),
  });

  return {
    version: PORTAL_SNAPSHOT_VERSION,
    client: { id: client.id, name: client.name, ...(client.contactName ? { contactName: client.contactName } : {}) },
    brand,
    timeZone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    publishedAt: new Date().toISOString(),
    projects: projects
      .filter((p) => p.status !== "cancelled")
      .map((p) => {
        const own = tasks.filter((t) => t.projectId === p.id);
        const totals = projectTotals(p);
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          statusLabel: statusLabel(p.status),
          ...(p.description ? { description: p.description } : {}),
          ...(p.startDate ? { startDate: p.startDate } : {}),
          ...(p.dueDate ? { dueDate: p.dueDate } : {}),
          progress: projectProgress(p, own),
          milestones: p.milestones.filter((m) => m.visibleToClient).map(item),
          tasks: own.filter((t) => t.visibleToClient).map(item),
          ...(p.showPaymentsToClient
            ? {
                money: {
                  currency: p.currency,
                  ...(p.budget !== undefined ? { budget: p.budget } : {}),
                  paid: totals.paid,
                  ...(totals.pending !== undefined ? { pending: totals.pending } : {}),
                  payments: [...p.payments].sort((a, b) => b.date.localeCompare(a.date)).map(({ date, amount, note }) => ({ date, amount, ...(note ? { note } : {}) })),
                },
              }
            : {}),
          updatedAt: p.updatedAt,
        };
      }),
  };
}

async function saveClientPortal(client: Client, portal: Client["portal"]) {
  const fresh = (await getStore().getClient(client.id)) ?? client;
  const next = { ...fresh };
  if (portal) next.portal = portal;
  else delete next.portal;
  await getStore().putClient(next);
  return next;
}

/** Envía el snapshot al portal y guarda el resultado (o el error) en el cliente. */
export async function publishClient(clientId: string): Promise<Client> {
  const client = await getStore().getClient(clientId);
  if (!client) throw bad("Cliente no encontrado", 404);
  if (!client.portal) throw bad("El portal de este cliente no está activado");
  try {
    const snapshot = await buildSnapshot(client);
    const res = await portalFetch(`/portals/${encodeURIComponent(client.id)}`, {
      method: "PUT",
      body: JSON.stringify({ tokenHash: hashToken(client.portal.token), snapshot }),
    });
    if (!res.ok) throw await portalError(res);
    return await saveClientPortal(client, { ...client.portal, publishedAt: new Date().toISOString(), lastError: undefined });
  } catch (err) {
    await saveClientPortal(client, { ...client.portal, lastError: (err as Error).message });
    throw err;
  }
}

export async function enablePortal(clientId: string, regenerate = false) {
  const store = getStore();
  const client = await store.getClient(clientId);
  if (!client) throw bad("Cliente no encontrado", 404);
  if (!portalConfig().configured) throw bad("Configura PORTAL_URL y PORTAL_SECRET en .env.local para usar el portal del cliente.");
  if (!client.portal || regenerate) {
    await saveClientPortal(client, { token: newToken(), enabledAt: new Date().toISOString() });
  }
  return publishClient(clientId);
}

/** Borra el portal del cliente en el servidor y olvida el enlace. */
export async function disablePortal(clientId: string) {
  const client = await getStore().getClient(clientId);
  if (!client) throw bad("Cliente no encontrado", 404);
  if (portalConfig().configured) {
    const res = await portalFetch(`/portals/${encodeURIComponent(clientId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw await portalError(res);
  }
  return saveClientPortal(client, undefined);
}

/** Estado en el portal: última publicación y última visita del cliente. */
export async function remotePortalStatus(clientId: string): Promise<PortalStatus | undefined> {
  const res = await portalFetch(`/portals/${encodeURIComponent(clientId)}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw await portalError(res);
  return (await res.json()) as PortalStatus;
}

// ── Publicación automática tras cambios ──

const g = globalThis as unknown as { __portalTimers?: Map<string, NodeJS.Timeout> };
const timers = (g.__portalTimers ??= new Map());

/** Vuelve a publicar el portal de un cliente unos segundos después del último cambio. */
export function schedulePublish(clientId: string | undefined) {
  if (!clientId || !portalConfig().configured) return;
  clearTimeout(timers.get(clientId));
  const t = setTimeout(async () => {
    timers.delete(clientId);
    const client = await getStore().getClient(clientId).catch(() => undefined);
    if (!client?.portal) return;
    await publishClient(clientId).catch((err: Error) => console.error(`[portal] ${client.name}: ${err.message}`));
  }, 2_000);
  t.unref?.();
  timers.set(clientId, t);
}

/** Republica todos los portales activos (p. ej. al cambiar los datos de tu negocio). */
export async function scheduleAll() {
  for (const c of await getStore().listClients()) if (c.portal) schedulePublish(c.id);
}

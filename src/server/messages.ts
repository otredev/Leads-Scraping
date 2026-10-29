import "server-only";
import { randomUUID } from "node:crypto";
import type { Client } from "@/core/clients";
import type { Conversation, Message, PortalConsent } from "@/core/messages";
import { getStore } from "./registry";

/**
 * Mensajes con los clientes.
 *
 * Los del cliente llegan desde su portal: la app los recoge cada minuto (y al
 * abrir Mensajes) con un cursor, junto con las aceptaciones de las políticas y
 * cuándo vio cada cliente sus mensajes. Tus respuestas se envían al portal al
 * momento. Las notas internas solo se guardan aquí.
 */

const bad = (m: string, status = 400) => Object.assign(new Error(m), { status });
const META_CURSOR = "messages:cursor";
const MAX_LENGTH = 8000;

interface Inbox {
  messages: (Omit<Message, "author"> & { author: "client" | "admin"; seq: number })[];
  consents: (Omit<PortalConsent, "at"> & { clientId: string; acceptedAt: string })[];
  seen: Record<string, string>;
}

let lastSync = 0;
let running: Promise<{ received: number }> | undefined;

/** Recoge del portal los mensajes nuevos, las aceptaciones de políticas y los "visto". */
export function syncInbox({ force = false } = {}): Promise<{ received: number }> {
  if (running) return running;
  if (!force && Date.now() - lastSync < 15_000) return Promise.resolve({ received: 0 });
  running = doSync().finally(() => {
    running = undefined;
  });
  return running;
}

async function doSync() {
  const { portalConfig, portalFetch } = await import("./portal");
  if (!portalConfig().configured) return { received: 0 };
  lastSync = Date.now();
  const store = getStore();
  const cursor = (await store.getMeta<number>(META_CURSOR)) ?? 0;
  const res = await portalFetch(`/inbox?after=${cursor}`);
  if (res.status === 404) return { received: 0 }; // portal sin actualizar
  if (!res.ok) throw bad(`El portal respondió ${res.status} al pedir los mensajes`, 502);
  const inbox = (await res.json()) as Inbox;

  // Mensajes: se respetan las marcas de leído que ya tenías.
  const clients = new Map((await store.listClients()).map((c) => [c.id, c]));
  const existing = new Map((await store.listMessages()).map((m) => [m.id, m]));
  const incoming = inbox.messages.filter((m) => clients.has(m.clientId));
  await store.putMessages(incoming.map((m) => ({ ...existing.get(m.id), ...m })));
  const fresh = incoming.filter((m) => m.author === "client" && !existing.has(m.id));
  if (inbox.messages.length) await store.setMeta(META_CURSOR, Math.max(cursor, ...inbox.messages.map((m) => m.seq)));

  // Aceptaciones de políticas y "visto", guardados en el cliente.
  const changed = new Map<string, Client>();
  const get = (id: string) => changed.get(id) ?? clients.get(id);
  for (const c of inbox.consents) {
    const client = get(c.clientId);
    if (!client || client.consents?.some((x) => x.version === c.version)) continue;
    const consent: PortalConsent = { version: c.version, name: c.name, at: c.acceptedAt, ...(c.ip ? { ip: c.ip } : {}), ...(c.userAgent ? { userAgent: c.userAgent } : {}) };
    changed.set(client.id, { ...client, consents: [...(client.consents ?? []), consent] });
  }
  for (const [clientId, at] of Object.entries(inbox.seen)) {
    const client = get(clientId);
    if (client && client.messagesSeenAt !== at) changed.set(clientId, { ...client, messagesSeenAt: at });
  }
  for (const c of changed.values()) await store.putClient(c);

  if (fresh.length) {
    const { notifyAll } = await import("./notifications");
    const byClient = new Map<string, number>();
    for (const m of fresh) byClient.set(m.clientId, (byClient.get(m.clientId) ?? 0) + 1);
    for (const [clientId, n] of byClient) {
      const last = fresh.filter((m) => m.clientId === clientId).at(-1)!;
      await notifyAll({
        title: `${n === 1 ? "Mensaje" : `${n} mensajes`} de ${clients.get(clientId)?.name ?? "un cliente"}`,
        body: last.body.slice(0, 140),
        url: `/mensajes?cliente=${clientId}`,
        tag: `msg-${clientId}`,
      }).catch(() => 0);
    }
  }
  return { received: fresh.length };
}

// ── Lectura ──

export async function listConversations(): Promise<{ conversations: Conversation[]; unread: number }> {
  const store = getStore();
  const [clients, messages] = await Promise.all([store.listClients(), store.listMessages()]);
  const byClient = new Map<string, Message[]>();
  for (const m of messages) byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]);
  const conversations = clients
    .filter((c) => byClient.has(c.id) || (c.portal && !c.archived))
    .map((c) => {
      const list = byClient.get(c.id) ?? [];
      const last = list.at(-1);
      return {
        clientId: c.id,
        clientName: c.name,
        ...(last ? { last: { author: last.author, body: last.body, createdAt: last.createdAt } } : {}),
        unread: list.filter((m) => m.author === "client" && !m.readAt).length,
        portalEnabled: Boolean(c.portal),
      };
    })
    .sort((a, b) => b.unread - a.unread || (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? "") || a.clientName.localeCompare(b.clientName, "es"));
  return { conversations, unread: conversations.reduce((s, c) => s + c.unread, 0) };
}

export async function unreadCount() {
  return (await getStore().listMessages()).filter((m) => m.author === "client" && !m.readAt).length;
}

export async function getThread(clientId: string) {
  const store = getStore();
  const client = await store.getClient(clientId);
  if (!client) throw bad("Cliente no encontrado", 404);
  const [messages, projects] = await Promise.all([store.listMessages({ clientId }), store.listProjects({ clientId })]);
  return {
    client: { id: client.id, name: client.name, contactName: client.contactName, portalEnabled: Boolean(client.portal), consents: client.consents ?? [], messagesSeenAt: client.messagesSeenAt },
    projects: projects.filter((p) => p.status !== "cancelled").map((p) => ({ id: p.id, name: p.name })),
    messages,
  };
}

/** Marca como leídos los mensajes del cliente. */
export async function markRead(clientId: string) {
  const store = getStore();
  const now = new Date().toISOString();
  const unread = (await store.listMessages({ clientId })).filter((m) => m.author === "client" && !m.readAt);
  await store.putMessages(unread.map((m) => ({ ...m, readAt: now })));
  return { marked: unread.length };
}

// ── Escribir ──

/** Responde al cliente (se publica en su portal) o guarda una nota interna: { body, projectId?, internal? }. */
export async function sendMessage(clientId: string, raw: unknown): Promise<Message> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const client = await store.getClient(clientId);
  if (!client) throw bad("Cliente no encontrado", 404);
  const body = typeof r.body === "string" ? r.body.replace(/\r\n/g, "\n").trim() : "";
  if (!body) throw bad("Escribe el mensaje");
  if (body.length > MAX_LENGTH) throw bad(`El mensaje es demasiado largo (máx. ${MAX_LENGTH} caracteres)`);
  const project = typeof r.projectId === "string" && r.projectId ? await store.getProject(r.projectId) : undefined;
  if (r.projectId && (!project || project.clientId !== clientId)) throw bad("El proyecto no es de ese cliente");
  const message: Message = {
    id: randomUUID(),
    clientId,
    author: r.internal === true ? "note" : "admin",
    body,
    ...(project ? { projectId: project.id, projectName: project.name } : {}),
    createdAt: new Date().toISOString(),
  };

  if (message.author === "admin") {
    if (!client.portal) throw bad("Este cliente no tiene el portal activo: actívalo en su ficha para poder escribirle, o guarda una nota interna.");
    const { portalFetch } = await import("./portal");
    const res = await portalFetch(`/portals/${encodeURIComponent(clientId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ id: message.id, body, projectId: message.projectId, projectName: message.projectName, createdAt: message.createdAt }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw bad(`No se pudo enviar al portal: ${err.error ?? res.status}`, 502);
    }
    const { seq } = (await res.json()) as { seq?: number };
    if (seq) message.seq = seq;
  }
  // Al responder, lo anterior del cliente queda leído.
  await markRead(clientId);
  await store.putMessages([message]);
  if (message.author === "admin") {
    const [{ notifyClientSoon }, settings] = await Promise.all([import("./client-push"), store.getSettings()]);
    const brand = settings.portal?.brandName?.trim() || "Portal de clientes";
    notifyClientSoon(clientId, { title: `Nuevo mensaje de ${brand}`, body: body.length > 160 ? `${body.slice(0, 157)}…` : body, path: "mensajes", tag: "mensajes" });
  }
  return message;
}

/** Borra una nota interna (los mensajes enviados no se borran: el cliente ya los tiene). */
export async function deleteNote(clientId: string, id: string) {
  const store = getStore();
  const m = (await store.listMessages({ clientId })).find((x) => x.id === id);
  if (!m) throw bad("Mensaje no encontrado", 404);
  if (m.author !== "note") throw bad("Solo se pueden borrar las notas internas");
  await store.deleteMessages({ id });
}

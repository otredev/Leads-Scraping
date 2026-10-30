import { docTotals, type Document } from "./documents";
import type { Message } from "./messages";

/**
 * Bandeja "Hoy" del Panel: lo que pide atención para empezar el día, aparte de
 * las tareas (que la app ya tiene en memoria y se suman en el navegador).
 * - Mensajes de clientes sin responder.
 * - Facturas emitidas sin cobrar que vencen hoy o ya vencieron.
 * - Propuestas y contratos enviados sin respuesta.
 */

export interface InboxMessage {
  kind: "message";
  clientId: string;
  clientName: string;
  /** Último mensaje del cliente. */
  preview: string;
  /** Desde cuándo espera respuesta (su primer mensaje sin contestar). */
  since: string;
  /** Último mensaje del cliente (si escribe otra vez, vuelve a aparecer aunque lo quitaras). */
  lastAt: string;
  /** Mensajes sin contestar. */
  count: number;
  unread: boolean;
}

export interface InboxInvoice {
  kind: "invoice";
  id: string;
  number: string;
  title: string;
  clientName: string;
  total: number;
  currency: string;
  dueDate: string;
  /** Días de retraso (0 = vence hoy). */
  daysLate: number;
}

export interface InboxProposal {
  kind: "proposal";
  id: string;
  type: "proposal" | "contract";
  number?: string;
  title: string;
  clientName: string;
  sentAt: string;
  /** Días desde que se envió. */
  daysWaiting: number;
  /** Ya pasó su fecha de validez. */
  expired: boolean;
  total: number;
  currency: string;
}

export interface TodayInbox {
  /** AAAA-MM-DD con el que se calculó (zona horaria del servidor). */
  today: string;
  messages: InboxMessage[];
  invoices: InboxInvoice[];
  proposals: InboxProposal[];
  /** Elementos que quitaste de la bandeja (ver isDismissed). */
  dismissed: Dismissals;
}

// ── Quitar elementos de la bandeja ──

/**
 * "AAAA-MM-DD": oculto hasta ese día (hasta mañana). "always": oculto mientras no cambie.
 * "deleted": eliminado; como "always" (vuelve si cambia), pero no sale en la lista de ocultos.
 * La clave incluye lo que puede cambiar (fecha de la tarea, último mensaje, vencimiento…),
 * así que si cambia, el elemento vuelve a aparecer solo.
 */
export type Dismissals = Record<string, string>;

export const inboxKey = {
  task: (t: { id: string; dueAt?: string }) => `t:${t.id}:${t.dueAt ?? ""}`,
  message: (m: Pick<InboxMessage, "clientId" | "lastAt">) => `m:${m.clientId}:${m.lastAt}`,
  invoice: (i: Pick<InboxInvoice, "id" | "dueDate">) => `i:${i.id}:${i.dueDate}`,
  proposal: (p: Pick<InboxProposal, "id" | "sentAt">) => `p:${p.id}:${p.sentAt}`,
};

/** Formato de una clave válida (para no guardar cualquier cosa). */
export const INBOX_KEY = /^[tmip]:[A-Za-z0-9_-]{1,80}:[0-9A-Za-z:.+-]{0,40}$/;

export type DismissState = "tomorrow" | "always" | "deleted";

/** Cómo está oculto un elemento (o undefined si se ve). */
export function dismissState(key: string, dismissed: Dismissals | undefined, today: string): DismissState | undefined {
  const until = dismissed?.[key];
  if (!until) return undefined;
  if (until === "always" || until === "deleted") return until;
  return today < until ? "tomorrow" : undefined;
}

export const isDismissed = (key: string, dismissed: Dismissals | undefined, today: string) => dismissState(key, dismissed, today) !== undefined;

/** Quita las que ya caducaron y, si hay demasiadas, las más antiguas. */
export function pruneDismissals(dismissed: Dismissals, today: string, max = 500): Dismissals {
  const live = Object.entries(dismissed).filter(([, until]) => until === "always" || until === "deleted" || today < until);
  return Object.fromEntries(live.slice(-max));
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);

/** Conversaciones cuyo último mensaje (sin contar notas internas) es del cliente. */
export function unansweredMessages(messages: Message[], clientNames: Map<string, string>): InboxMessage[] {
  const byClient = new Map<string, Message[]>();
  for (const m of messages) if (m.author !== "note") byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]);
  const out: InboxMessage[] = [];
  for (const [clientId, list] of byClient) {
    const name = clientNames.get(clientId);
    if (!name) continue;
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastAdmin = list.findLastIndex((m) => m.author === "admin");
    const waiting = list.slice(lastAdmin + 1);
    if (!waiting.length) continue;
    out.push({
      kind: "message",
      clientId,
      clientName: name,
      preview: waiting[waiting.length - 1].body.slice(0, 160),
      since: waiting[0].createdAt,
      lastAt: waiting[waiting.length - 1].createdAt,
      count: waiting.length,
      unread: waiting.some((m) => !m.readAt),
    });
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}

/** Facturas emitidas sin cobrar con vencimiento hoy o antes (no las rectificativas). */
export function dueInvoices(docs: Document[], clientNames: Map<string, string>, today: string): InboxInvoice[] {
  return docs
    .filter((d) => d.type === "invoice" && d.status === "issued" && d.kind !== "R4" && d.dueDate && d.dueDate <= today)
    .map((d) => ({
      kind: "invoice" as const,
      id: d.id,
      number: d.number ?? "",
      title: d.title,
      clientName: clientNames.get(d.clientId) ?? d.customer?.name ?? "Cliente",
      total: docTotals(d).total,
      currency: d.currency,
      dueDate: d.dueDate!,
      daysLate: daysBetween(d.dueDate!, today),
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Propuestas y contratos enviados que el cliente aún no ha aceptado, firmado ni rechazado. */
export function pendingProposals(docs: Document[], clientNames: Map<string, string>, today: string): InboxProposal[] {
  return docs
    .filter((d) => (d.type === "proposal" || d.type === "contract") && d.status === "sent" && d.sentAt)
    .map((d) => ({
      kind: "proposal" as const,
      id: d.id,
      type: d.type as "proposal" | "contract",
      ...(d.number ? { number: d.number } : {}),
      title: d.title,
      clientName: clientNames.get(d.clientId) ?? d.customer?.name ?? "Cliente",
      sentAt: d.sentAt!,
      daysWaiting: Math.max(0, daysBetween(d.sentAt!.slice(0, 10), today)),
      expired: Boolean(d.dueDate && d.dueDate < today),
      total: docTotals(d).total,
      currency: d.currency,
    }))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

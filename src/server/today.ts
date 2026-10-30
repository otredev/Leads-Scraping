import "server-only";
import { INBOX_KEY, dueInvoices, pendingProposals, pruneDismissals, unansweredMessages, type Dismissals, type TodayInbox } from "@/core/today";
import { getStore } from "./registry";

const pad = (n: number) => String(n).padStart(2, "0");
/** Fecha de hoy en la zona horaria del servidor (TZ). */
const localToday = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Mensajes sin responder, facturas vencidas y propuestas sin respuesta (las tareas las suma el navegador). */
export async function todayInbox(now = new Date()): Promise<TodayInbox> {
  // Trae antes del portal los mensajes que hayan llegado (como mucho cada 15 s).
  const { syncInbox } = await import("./messages");
  await syncInbox().catch(() => undefined);
  const store = getStore();
  const [clients, messages, docs, dismissed] = await Promise.all([store.listClients(), store.listMessages(), store.listDocuments(), store.getMeta<Dismissals>(META_DISMISSED)]);
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const today = localToday(now);
  return {
    today,
    messages: unansweredMessages(messages, names),
    invoices: dueInvoices(docs, names, today),
    proposals: pendingProposals(docs, names, today),
    dismissed: pruneDismissals(dismissed ?? {}, today),
  };
}

const META_DISMISSED = "today:dismissed";
const bad = (m: string) => Object.assign(new Error(m), { status: 400 });

function tomorrow(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return localToday(d);
}

/**
 * Quita un elemento de la bandeja: { action: "dismiss", key, until: "tomorrow" | "always" | "deleted" }
 * ("deleted" = eliminado: no sale en ocultos, pero vuelve si cambia) o lo vuelve a mostrar: { action: "restore", key }.
 */
export async function changeDismissal(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key : "";
  if (!INBOX_KEY.test(key)) throw bad("Elemento no válido");
  if (r.action !== "dismiss" && r.action !== "restore") throw bad("Acción no válida");
  if (r.action === "dismiss" && r.until !== "tomorrow" && r.until !== "always" && r.until !== "deleted") throw bad("Elige hasta cuándo ocultarlo");
  const today = localToday();
  const dismissed = await getStore().updateMeta<Dismissals>(META_DISMISSED, (cur = {}) => {
    const next = pruneDismissals(cur, today);
    delete next[key];
    if (r.action === "dismiss") next[key] = r.until === "tomorrow" ? tomorrow() : (r.until as string);
    return next;
  });
  return { dismissed };
}

import "server-only";
import { hasDue } from "@/core/calendar";
import { getStore } from "./registry";
import { hasSubscribers, notifyAll } from "./notifications";
import { listTasks } from "./tasks";

/**
 * Recordatorios en segundo plano: cada minuto busca tareas que acaban de
 * vencer y las envía por los canales de notificación (push…). Funciona
 * mientras el servidor esté encendido, aunque no haya ninguna pestaña abierta.
 */

const INTERVAL_MS = 60_000;
/** Solo avisa de tareas vencidas hace menos de una hora (no repasa el historial). */
const WINDOW_MS = 60 * 60_000;

const g = globalThis as unknown as { __reminders?: NodeJS.Timeout; __remindersRunning?: boolean };

const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

export async function checkDueTasks(now = new Date()) {
  if (g.__remindersRunning) return 0;
  g.__remindersRunning = true;
  try {
    const store = getStore();
    const due = (await store.listTasks()).filter((t) => {
      if (t.done || t.notifiedAt || !hasDue(t)) return false;
      const at = new Date(t.dueAt).getTime();
      return at <= now.getTime() && now.getTime() - at < WINDOW_MS;
    });
    if (!due.length || !(await hasSubscribers())) return 0;

    const info = new Map((await listTasks()).map((t) => [t.id, t]));
    let sent = 0;
    for (const t of due) {
      const item = info.get(t.id);
      sent += await notifyAll({
        title: t.title,
        body: `${item?.subject ?? t.leadName} · ${timeFmt.format(new Date(t.dueAt!))}`,
        url: item?.exists ? item.href : "/tareas",
        tag: `task-${t.id}`,
      });
      await store.updateTask(t.id, { notifiedAt: now.toISOString() });
    }
    return sent;
  } catch (err) {
    console.error(`[recordatorios] ${(err as Error).message}`);
    return 0;
  } finally {
    g.__remindersRunning = false;
  }
}

/** Arranca el temporizador una sola vez por proceso. */
async function syncMessages() {
  const { syncInbox } = await import("./messages");
  await syncInbox({ force: true }).catch((err: Error) => console.error(`[portal] mensajes: ${err.message}`));
}

async function syncFromPortal() {
  const { syncAcceptances } = await import("./documents");
  await syncAcceptances({ force: true }).catch((err: Error) => console.error(`[portal] aceptaciones: ${err.message}`));
}

export function startReminders() {
  if (g.__reminders) return;
  let ticks = 0;
  g.__reminders = setInterval(() => {
    void checkDueTasks();
    void syncMessages();
    // Cada 5 minutos, recoge las propuestas y contratos aceptados en el portal.
    if (++ticks % 5 === 0) void syncFromPortal();
  }, INTERVAL_MS);
  // No impide que el proceso termine (p. ej. al parar el servidor).
  g.__reminders.unref?.();
  void checkDueTasks();
}

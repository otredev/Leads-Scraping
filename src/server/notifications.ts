import "server-only";
import { notifiers } from "@/modules";
import type { Notifier, NotificationMessage, NotifierModule } from "@/core/notifier";
import { getStore } from "./registry";
import { tenantKey } from "./tenant";

const g = globalThis as unknown as { __notifiers?: Map<string, Notifier> };

/** Instancia de un canal, con acceso a los datos internos del almacenamiento. */
export function getNotifier(id: string): { module: NotifierModule; notifier: Notifier } | undefined {
  const mod = notifiers.find((n) => n.id === id);
  if (!mod) return undefined;
  const cache = (g.__notifiers ??= new Map());
  const key = `${tenantKey()}:${id}`;
  if (!cache.has(key)) {
    const store = getStore();
    cache.set(
      key,
      mod.create({
        getMeta: (k) => store.getMeta(k),
        setMeta: (k, v) => store.setMeta(k, v),
        updateMeta: (k, fn) => store.updateMeta(k, fn),
      }),
    );
  }
  return { module: mod, notifier: cache.get(key)! };
}

/** Envía un mensaje por todos los canales. Devuelve cuántos avisos salieron. */
export async function notifyAll(message: NotificationMessage) {
  let sent = 0;
  for (const m of notifiers) {
    try {
      sent += (await getNotifier(m.id)!.notifier.send(message)).sent;
    } catch (err) {
      console.error(`[notificaciones] ${m.id}: ${(err as Error).message}`);
    }
  }
  return sent;
}

/** ¿Hay algún destinatario en algún canal? */
export async function hasSubscribers() {
  for (const m of notifiers) {
    if ((await getNotifier(m.id)!.notifier.listSubscribers()).length) return true;
  }
  return false;
}

export { notifiers };

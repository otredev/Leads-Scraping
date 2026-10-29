import "server-only";
import webpush, { WebPushError, type PushSubscription } from "web-push";
import { createHash } from "node:crypto";
import { vapidKeys, vapidSubject } from "@/modules/notifiers/web-push";
import { getStore } from "./registry";

/**
 * Avisos push para tus clientes. El cliente los activa en su portal (las
 * suscripciones se guardan en el portal, en D1) y tu app los envía con sus
 * propias claves VAPID cuando le respondes o le envías un documento.
 * Se pueden desactivar en Ajustes → Portal del cliente.
 */

export interface ClientPush {
  title: string;
  body: string;
  /** Ruta dentro del portal del cliente: "mensajes", "d/<id>"… */
  path?: string;
  /** Avisos con la misma etiqueta se sustituyen en vez de acumularse. */
  tag?: string;
}

const keysCtx = () => {
  const store = getStore();
  return { updateMeta: store.updateMeta.bind(store) };
};

/** Clave pública que se publica en el portal (sin ella, el portal no ofrece los avisos). */
export async function clientPushKey(): Promise<string | undefined> {
  const settings = await getStore().getSettings();
  if (settings.portal?.clientPushOff) return undefined;
  try {
    return (await vapidKeys(keysCtx())).publicKey;
  } catch (err) {
    console.error(`[avisos a clientes] claves: ${(err as Error).message}`);
    return undefined;
  }
}

/** Envía un aviso a todos los dispositivos donde el cliente los activó. */
export async function notifyClient(clientId: string, message: ClientPush) {
  const store = getStore();
  const [client, settings] = await Promise.all([store.getClient(clientId), store.getSettings()]);
  if (!client?.portal || settings.portal?.clientPushOff) return { sent: 0, failed: 0, removed: 0 };
  const { portalFetch } = await import("./portal");
  const res = await portalFetch(`/portals/${encodeURIComponent(clientId)}/push`);
  if (!res.ok) throw new Error(`El portal respondió ${res.status}`);
  const subs = (await res.json()) as PushSubscription[];
  if (!subs.length) return { sent: 0, failed: 0, removed: 0 };

  const { publicKey, privateKey } = await vapidKeys(keysCtx());
  const payload = JSON.stringify({ title: message.title.slice(0, 120), body: message.body.slice(0, 240), path: message.path, tag: message.tag });
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, {
          vapidDetails: { subject: vapidSubject(), publicKey, privateKey },
          TTL: 24 * 60 * 60,
          urgency: "normal",
          ...(message.tag ? { topic: createHash("sha1").update(message.tag).digest("hex").slice(0, 32) } : {}),
        });
        sent++;
      } catch (err) {
        failed++;
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) expired.push(sub.endpoint);
        else console.error(`[avisos a clientes] ${client.name}: ${(err as Error).message}`);
      }
    }),
  );
  if (expired.length) await portalFetch("/push/expired", { method: "POST", body: JSON.stringify({ endpoints: expired }) }).catch(() => undefined);
  return { sent, failed, removed: expired.length };
}

/**
 * En segundo plano, sin retrasar la respuesta. Con publishFirst, publica antes
 * el portal para que, al abrir el aviso, el cliente ya vea lo nuevo.
 */
export function notifyClientSoon(clientId: string, message: ClientPush, { publishFirst = false } = {}) {
  void (async () => {
    try {
      // Sin portal no hay nada que publicar ni a quién avisar.
      if (!(await getStore().getClient(clientId))?.portal) return;
      if (publishFirst) {
        const { publishClient } = await import("./portal");
        await publishClient(clientId);
      }
      await notifyClient(clientId, message);
    } catch (err) {
      console.error(`[avisos a clientes] ${(err as Error).message}`);
    }
  })();
}

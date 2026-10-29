import { createHash } from "node:crypto";
import webpush, { type PushSubscription, WebPushError } from "web-push";
import { defineNotifier, type NotifierContext, type Subscriber } from "@/core/notifier";

/**
 * Notificaciones push del navegador (Web Push + VAPID). Gratis: los avisos los
 * entregan los servicios push de cada navegador (Google, Mozilla, Apple).
 *
 * Las claves VAPID se generan solas la primera vez y se guardan en la base de
 * datos. Se pueden fijar con VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 */

interface Keys {
  publicKey: string;
  privateKey: string;
}

interface StoredSubscription extends Subscriber {
  subscription: PushSubscription;
}

const KEYS = "web-push:vapid";
const SUBS = "web-push:subscriptions";

export function vapidSubject() {
  const s = process.env.VAPID_SUBJECT?.trim();
  return s && /^(mailto:|https:)/.test(s) ? s : "mailto:avisos@leads-scraping.example";
}

/** Claves VAPID de la app (las mismas para tus avisos y los de tus clientes). */
export async function vapidKeys(ctx: Pick<NotifierContext, "updateMeta">): Promise<Keys> {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  return ctx.updateMeta<Keys>(KEYS, (current) => current ?? webpush.generateVAPIDKeys());
}

function parseSubscription(data: unknown): PushSubscription {
  const s = data as Partial<PushSubscription> | undefined;
  const ok =
    s &&
    typeof s.endpoint === "string" &&
    /^https:\/\//.test(s.endpoint) &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string";
  if (!ok) throw Object.assign(new Error("Suscripción push no válida"), { status: 400 });
  return { endpoint: s.endpoint!, keys: { p256dh: s.keys!.p256dh, auth: s.keys!.auth } };
}

const idFor = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
const publicView = ({ id, label, createdAt }: StoredSubscription): Subscriber => ({ id, label, createdAt });

export default defineNotifier({
  id: "web-push",
  label: "Notificaciones push",
  description: "Avisos del sistema en el ordenador o el móvil aunque la app esté cerrada (el servidor debe estar encendido).",
  create(ctx) {
    const list = async () => (await ctx.getMeta<StoredSubscription[]>(SUBS)) ?? [];

    return {
      async health() {
        try {
          await vapidKeys(ctx);
          const n = (await list()).length;
          return { ok: true, message: n ? `${n} ${n === 1 ? "dispositivo suscrito" : "dispositivos suscritos"}` : "Ningún dispositivo suscrito" };
        } catch (err) {
          return { ok: false, message: (err as Error).message };
        }
      },

      async clientConfig() {
        return { publicKey: (await vapidKeys(ctx)).publicKey };
      },

      async subscribe(data, label) {
        const subscription = parseSubscription(data);
        const entry: StoredSubscription = {
          id: idFor(subscription.endpoint),
          label: label.trim().slice(0, 80) || "Navegador",
          createdAt: new Date().toISOString(),
          subscription,
        };
        await ctx.updateMeta<StoredSubscription[]>(SUBS, (cur = []) => [entry, ...cur.filter((s) => s.id !== entry.id)]);
        return publicView(entry);
      },

      async unsubscribe(id) {
        await ctx.updateMeta<StoredSubscription[]>(SUBS, (cur = []) => cur.filter((s) => s.id !== id));
      },

      async listSubscribers() {
        return (await list()).map(publicView);
      },

      async send(message) {
        const subs = await list();
        if (!subs.length) return { sent: 0, failed: 0, removed: 0 };
        const { publicKey, privateKey } = await vapidKeys(ctx);
        const payload = JSON.stringify(message);
        const gone = new Set<string>();
        let sent = 0;
        let failed = 0;
        await Promise.all(
          subs.map(async (s) => {
            try {
              await webpush.sendNotification(s.subscription, payload, {
                vapidDetails: { subject: vapidSubject(), publicKey, privateKey },
                TTL: 60 * 60,
                urgency: "high",
                ...(message.tag ? { topic: createHash("sha1").update(message.tag).digest("hex").slice(0, 32) } : {}),
              });
              sent++;
            } catch (err) {
              failed++;
              // 404/410: el navegador dio de baja la suscripción.
              if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) gone.add(s.id);
              else console.error(`[web-push] ${s.label}: ${(err as Error).message}`);
            }
          }),
        );
        if (gone.size) await ctx.updateMeta<StoredSubscription[]>(SUBS, (cur = []) => cur.filter((s) => !gone.has(s.id)));
        return { sent, failed, removed: gone.size };
      },
    };
  },
});

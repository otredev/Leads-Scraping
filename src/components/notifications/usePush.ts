"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthStatus } from "@/core/provider";
import type { Subscriber } from "@/core/notifier";
import { deviceLabel, getPushSubscription, pushSupported, subscribePush, subscriptionId } from "@/lib/pwa";
import { api, postJson } from "../data/DataProvider";

const CHANNEL = "web-push";

export interface ChannelInfo {
  id: string;
  label: string;
  description: string;
  health: HealthStatus;
  config: { publicKey?: string };
  subscribers: Subscriber[];
}

interface Loaded {
  channel?: ChannelInfo;
  deviceId: string | null;
}

async function load(): Promise<Loaded> {
  const [{ channels }, sub] = await Promise.all([
    api<{ channels: ChannelInfo[] }>("/api/notifications"),
    getPushSubscription().catch(() => null),
  ]);
  return { channel: channels.find((c) => c.id === CHANNEL), deviceId: sub ? await subscriptionId(sub.endpoint) : null };
}

export type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

/** Estado y acciones de las notificaciones push en este navegador. */
export function usePush() {
  const [channel, setChannel] = useState<ChannelInfo>();
  const [deviceId, setDeviceId] = useState<string | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const apply = useCallback((r: Loaded) => {
    setChannel(r.channel);
    setDeviceId(r.deviceId);
  }, []);
  const refresh = useCallback(() => load().then(apply), [apply]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => !cancelled && apply(r))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const subscribedHere = Boolean(deviceId && channel?.subscribers.some((s) => s.id === deviceId));
  const state: PushState =
    channel === undefined || deviceId === undefined
      ? "loading"
      : !pushSupported()
        ? "unsupported"
        : typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "denied"
          : subscribedHere
            ? "on"
            : "off";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    channel,
    state,
    deviceId,
    busy,
    error,
    message,
    clearMessages: () => {
      setError(undefined);
      setMessage(undefined);
    },
    enable: () =>
      run(async () => {
        const key = channel?.config.publicKey;
        if (!key) throw new Error("El servidor no tiene claves push.");
        const sub = await subscribePush(key);
        await postJson("/api/notifications/subscriptions", { channel: CHANNEL, data: sub.toJSON(), label: deviceLabel() });
        setMessage("Notificaciones push activadas en este dispositivo.");
      }),
    disable: () =>
      run(async () => {
        const sub = await getPushSubscription();
        if (sub) {
          await postJson("/api/notifications/subscriptions", { channel: CHANNEL, id: await subscriptionId(sub.endpoint) }, "DELETE");
          await sub.unsubscribe();
        }
      }),
    remove: (id: string) => run(() => postJson("/api/notifications/subscriptions", { channel: CHANNEL, id }, "DELETE").then(() => undefined)),
    test: () =>
      run(async () => {
        const r = await postJson<{ sent: number; failed: number }>("/api/notifications/test", { channel: CHANNEL });
        setMessage(r.sent ? `Aviso de prueba enviado a ${r.sent} ${r.sent === 1 ? "dispositivo" : "dispositivos"}.` : "No se pudo entregar a ningún dispositivo.");
      }),
  };
}

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { usePush } from "./usePush";

type Perm = "unsupported" | NotificationPermission;
const permListeners = new Set<() => void>();
const readPerm = (): Perm => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");

/** Botón para activar avisos: push si el navegador lo admite; si no, avisos con la app abierta. */
export function PushButton() {
  const push = usePush();
  const perm = useSyncExternalStore(
    (cb) => {
      permListeners.add(cb);
      return () => permListeners.delete(cb);
    },
    readPerm,
    () => "default" as Perm,
  );

  if (push.state === "loading") return null;

  if (push.state === "on") {
    return (
      <Link href="/ajustes" className="badge border border-line text-fg-2" title="Gestiona los dispositivos en Ajustes">
        <Bell className="size-3.5" aria-hidden /> Notificaciones push activadas
      </Link>
    );
  }
  if (push.state === "off") {
    return (
      <span className="flex flex-col items-end gap-1">
        <button className="btn" onClick={() => void push.enable()} disabled={push.busy}>
          <Bell className="size-4" aria-hidden /> Activar notificaciones push
        </button>
        {push.error && <span className="text-xs text-danger">{push.error}</span>}
      </span>
    );
  }
  if (push.state === "denied" || perm === "denied") {
    return (
      <span className="badge border border-line text-muted" title="Puedes permitirlas en la configuración del sitio del navegador">
        <BellOff className="size-3.5" aria-hidden /> Avisos bloqueados en el navegador
      </span>
    );
  }
  // Sin push (p. ej. Safari en iPhone sin instalar): avisos mientras la app esté abierta.
  if (perm === "default") {
    return (
      <button
        className="btn"
        onClick={async () => {
          await Notification.requestPermission();
          permListeners.forEach((l) => l());
        }}
      >
        <Bell className="size-4" aria-hidden /> Activar avisos del navegador
      </button>
    );
  }
  return perm === "granted" ? (
    <span className="badge border border-line text-fg-2">
      <Bell className="size-3.5" aria-hidden /> Avisos activados (con la app abierta)
    </span>
  ) : null;
}

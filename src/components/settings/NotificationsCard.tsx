"use client";

import { Bell, BellOff, Send, Trash2 } from "lucide-react";
import { usePush } from "../notifications/usePush";
import { Card, Notice, Skeleton } from "../ui";

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

/** Notificaciones push: activar en este dispositivo, probar y ver los suscritos. */
export function NotificationsCard() {
  const push = usePush();
  const { channel, state, deviceId } = push;

  return (
    <Card title="Notificaciones push" description="Avisos de tareas aunque la app esté cerrada">
      <div className="flex flex-col gap-4 text-[13.5px] text-fg-2">
        {(push.error || push.message) && (
          <Notice tone={push.error ? "error" : undefined} onClose={push.clearMessages}>
            {push.error ?? push.message}
          </Notice>
        )}

        {state === "loading" ? (
          <Skeleton className="h-9 w-56" />
        ) : state === "unsupported" ? (
          <p className="flex items-start gap-2">
            <BellOff className="mt-0.5 size-4 text-muted" aria-hidden />
            <span>
              Este navegador no admite notificaciones push. En iPhone y iPad solo funcionan con la app instalada en la pantalla de inicio (iOS
              16.4 o posterior).
            </span>
          </p>
        ) : state === "denied" ? (
          <p className="flex items-start gap-2 text-danger">
            <BellOff className="mt-0.5 size-4" aria-hidden />
            <span>Las notificaciones están bloqueadas para este sitio. Permítelas en la configuración del sitio del navegador y recarga.</span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {state === "on" ? (
              <>
                <span className="badge bg-success-soft text-success">
                  <Bell className="size-3.5" aria-hidden /> Activadas en este dispositivo
                </span>
                <button className="btn btn-sm" onClick={() => void push.test()} disabled={push.busy}>
                  <Send className="size-3.5" aria-hidden /> Enviar prueba
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => void push.disable()} disabled={push.busy}>
                  Desactivar aquí
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => void push.enable()} disabled={push.busy || !channel?.health.ok}>
                <Bell className="size-4" aria-hidden /> Activar en este dispositivo
              </button>
            )}
          </div>
        )}

        {channel && channel.subscribers.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Dispositivos suscritos</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {channel.subscribers.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-fg">
                    {s.label}
                    {s.id === deviceId && <span className="text-muted"> · este</span>}
                  </span>
                  <span className="text-xs text-muted">{dateFmt.format(new Date(s.createdAt))}</span>
                  <button
                    className="btn btn-ghost size-7 p-0 text-muted hover:text-danger"
                    onClick={() => void push.remove(s.id)}
                    disabled={push.busy}
                    aria-label={`Quitar ${s.label}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="hint">
          El servidor revisa las tareas cada minuto y avisa a todos los dispositivos suscritos cuando vence una. Tiene que estar encendido
          (<code className="text-[12px]">npm run dev</code>). En el móvil, la app debe estar desplegada con HTTPS.
        </p>
      </div>
    </Card>
  );
}

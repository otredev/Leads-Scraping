"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe, Mail, MessageCircle, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import type { Client } from "@/core/clients";
import type { PortalStatus } from "@/core/portal";
import { api, postJson } from "../data/DataProvider";
import { MenuItem, Popover } from "../leads/Popover";
import { Card, Skeleton, timeAgo } from "../ui";

interface PortalView {
  configured: boolean;
  enabled: boolean;
  url?: string;
  publishedAt?: string;
  lastError?: string;
  remote?: PortalStatus | null;
  remoteError?: string;
}

/** Portal del cliente: activar, compartir el enlace, publicar y ver si lo ha abierto. */
export function PortalCard({ client }: { client: Client }) {
  const [state, setState] = useState<PortalView>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    () =>
      api<PortalView>(`/api/clients/${client.id}/portal`)
        .then(setState)
        .catch((e: Error) => setError(e.message)),
    [client.id],
  );
  useEffect(() => {
    void Promise.resolve().then(load);
    // Los cambios se publican solos a los ~2 s: refresca el estado de vez en cuando.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: "enable" | "publish" | "regenerate" | "disable") {
    setBusy(action);
    setError(undefined);
    try {
      if (action === "disable") await postJson(`/api/clients/${client.id}/portal`, {}, "DELETE");
      else await postJson(`/api/clients/${client.id}/portal`, { action });
      await load();
    } catch (err) {
      setError((err as Error).message);
      await load();
    } finally {
      setBusy(undefined);
    }
  }

  const greeting = client.contactName ? `Hola ${client.contactName}` : "Hola";
  const message = state?.url ? `${greeting}, aquí puedes seguir el avance de tu proyecto, las próximas entregas y lo pendiente: ${state.url}` : "";
  const phone = (client.phoneE164 ?? client.phone)?.replace(/\D/g, "");

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Globe className="size-4 text-muted" aria-hidden /> Portal del cliente
        </span>
      }
      actions={
        state?.enabled && (
          <Popover buttonClassName="btn btn-ghost size-8 p-0" width="w-56" label={<MoreHorizontal className="size-4" aria-label="Opciones del portal" />}>
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    if (window.confirm("Se creará un enlace nuevo y el actual dejará de funcionar. ¿Continuar?")) void act("regenerate");
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden /> Renovar enlace
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    close();
                    if (window.confirm("El cliente dejará de poder ver su portal. ¿Desactivarlo?")) void act("disable");
                  }}
                >
                  Desactivar portal
                </MenuItem>
              </>
            )}
          </Popover>
        )
      }
    >
      {!state ? (
        <Skeleton className="h-16" />
      ) : !state.configured ? (
        <p className="hint">
          Para compartir el avance con el cliente, despliega el portal en Cloudflare y añade <code className="text-[12px]">PORTAL_URL</code> y{" "}
          <code className="text-[12px]">PORTAL_SECRET</code> a <code className="text-[12px]">.env.local</code>. Los pasos están en el README (sección
          &ldquo;Portal del cliente&rdquo;) y en{" "}
          <Link href="/ajustes?seccion=portal" className="underline underline-offset-2">
            Ajustes
          </Link>
          .
        </p>
      ) : !state.enabled ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-fg-2">
            Un enlace privado donde el cliente ve el avance, el cronograma y las tareas que marques como visibles. Se actualiza solo con cada cambio.
          </p>
          <button className="btn btn-primary self-start" onClick={() => void act("enable")} disabled={Boolean(busy)}>
            {busy ? "Activando…" : "Activar portal"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2" title={state.url}>
              {state.url?.replace(/^https?:\/\//, "")}
            </span>
            <button
              className="btn btn-ghost size-7 shrink-0 p-0"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.url!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* sin portapapeles */
                }
              }}
              aria-label="Copiar enlace"
              title="Copiar enlace"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            </button>
            <a className="btn btn-ghost size-7 shrink-0 p-0" href={state.url} target="_blank" rel="noreferrer" aria-label="Abrir portal" title="Ver como el cliente">
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {phone && (
              <a className="btn btn-sm" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-3.5" aria-hidden /> Enviar por WhatsApp
              </a>
            )}
            {client.email && (
              <a
                className="btn btn-sm"
                href={`mailto:${client.email}?subject=${encodeURIComponent("Avance de tu proyecto")}&body=${encodeURIComponent(message)}`}
              >
                <Mail className="size-3.5" aria-hidden /> Enviar por email
              </a>
            )}
            <button className="btn btn-sm" onClick={() => void act("publish")} disabled={Boolean(busy)} title="Se publica solo con cada cambio; úsalo si algo no se ha actualizado">
              <Upload className={`size-3.5 ${busy === "publish" ? "animate-pulse" : ""}`} aria-hidden /> Publicar ahora
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted">Publicado</dt>
            <dd>{state.publishedAt ? timeAgo(state.publishedAt) : "Aún no"}</dd>
            <dt className="text-muted">Visto</dt>
            <dd>
              {state.remote?.lastViewedAt
                ? `${timeAgo(state.remote.lastViewedAt)} · ${state.remote.views} ${state.remote.views === 1 ? "visita" : "visitas"}`
                : state.remote
                  ? "Todavía no lo ha abierto"
                  : "—"}
            </dd>
            {state.remote && (
              <>
                <dt className="text-muted">Notificaciones</dt>
                <dd>
                  {state.remote.pushDevices
                    ? `Activados en ${state.remote.pushDevices} ${state.remote.pushDevices === 1 ? "dispositivo" : "dispositivos"}`
                    : "No los ha activado"}
                </dd>
              </>
            )}
          </dl>
          {(state.lastError || state.remoteError) && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{state.lastError ?? state.remoteError}</p>}
          <p className="hint">Solo ve los hitos y tareas con el ojo activado, y los pagos si lo activas en cada proyecto.</p>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
    </Card>
  );
}

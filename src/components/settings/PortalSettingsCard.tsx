"use client";

import { useEffect, useState } from "react";
import type { CrmSettings, PortalBrandSettings } from "@/core/crm";
import { api, useData } from "../data/DataProvider";
import { Field } from "../clients/Dialog";
import { Card, Notice, Skeleton } from "../ui";

interface Conn {
  configured: boolean;
  url?: string;
  health: { ok: boolean; message: string };
}

/** Portal del cliente: conexión con Cloudflare y datos de tu negocio que ven los clientes. */
export function PortalSettingsCard({ settings }: { settings: CrmSettings }) {
  const { patchSettings } = useData();
  const [conn, setConn] = useState<Conn>();
  const [draft, setDraft] = useState<PortalBrandSettings>(settings.portal ?? {});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.portal ?? {});

  useEffect(() => {
    api<Conn>("/api/portal")
      .then(setConn)
      .catch((e: Error) => setConn({ configured: false, health: { ok: false, message: e.message } }));
  }, []);

  const set = (k: keyof PortalBrandSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(undefined);
    try {
      const next = await patchSettings({ portal: draft });
      setDraft(next.portal ?? {});
      setNotice({ text: "Guardado. Los portales activos se actualizan en unos segundos." });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Portal del cliente" description="Enlace privado donde cada cliente ve el avance de sus proyectos (Cloudflare Workers + D1)">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form className="flex flex-col gap-4" onSubmit={save}>
          {notice && (
            <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
              {notice.text}
            </Notice>
          )}
          <p className="text-[13px] text-muted">Lo que ven tus clientes en la cabecera y en &ldquo;¿Dudas o cambios?&rdquo;.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre de tu negocio" className="sm:col-span-2">
              <input className="input" value={draft.brandName ?? ""} onChange={set("brandName")} placeholder="Tu estudio" maxLength={80} />
            </Field>
            <Field label="Email de contacto">
              <input className="input" type="email" value={draft.email ?? ""} onChange={set("email")} />
            </Field>
            <Field label="WhatsApp" hint="Con prefijo: +34 600 000 000">
              <input className="input" type="tel" value={draft.whatsapp ?? ""} onChange={set("whatsapp")} />
            </Field>
            <Field label="Teléfono">
              <input className="input" type="tel" value={draft.phone ?? ""} onChange={set("phone")} />
            </Field>
            <Field label="Web">
              <input className="input" value={draft.website ?? ""} onChange={set("website")} placeholder="tuweb.com" />
            </Field>
            <Field label="Mensaje de bienvenida" className="sm:col-span-2">
              <textarea
                className="input min-h-20 resize-y"
                value={draft.welcome ?? ""}
                onChange={set("welcome")}
                placeholder="Aquí puedes seguir el avance de tus proyectos, las próximas entregas y lo que queda pendiente."
                maxLength={500}
              />
            </Field>
          </div>
          <div>
            <button className="btn btn-primary btn-sm" disabled={busy || !dirty}>
              Guardar
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3 rounded-xl border border-line p-4 text-[13.5px]">
          <p className="font-semibold">Conexión</p>
          {!conn ? (
            <Skeleton className="h-10" />
          ) : (
            <span className={`badge self-start ${conn.health.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
              <span className={`size-1.5 rounded-full ${conn.health.ok ? "bg-success" : "bg-danger"}`} aria-hidden />
              {conn.health.ok ? "Conectado" : conn.configured ? "Sin conexión" : "Sin configurar"}
            </span>
          )}
          {conn && <p className={conn.health.ok ? "text-muted" : "text-danger"}>{conn.health.message}</p>}
          <ol className="list-decimal space-y-1 pl-5 text-fg-2">
            <li>
              Despliega la carpeta <code className="text-[12px]">portal/</code> en Cloudflare (gratis). Los pasos están en el README.
            </li>
            <li>
              Añade a <code className="text-[12px]">.env.local</code> la dirección (<code className="text-[12px]">PORTAL_URL</code>) y el mismo secreto que
              pusiste en Cloudflare (<code className="text-[12px]">PORTAL_SECRET</code>) y reinicia la app.
            </li>
            <li>En la ficha de un cliente, pulsa &ldquo;Activar portal&rdquo; y envíale el enlace.</li>
          </ol>
          <p className="hint">Tu CRM sigue en tu equipo: al portal solo se envía lo marcado como visible.</p>
        </div>
      </div>
    </Card>
  );
}

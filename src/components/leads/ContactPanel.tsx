"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Phone } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import { CONTACT_CHANNELS, type ContactChannel, type CrmSettings, type LeadUpdate } from "@/core/crm";
import { mailtoLink, renderTemplate, whatsappLink } from "@/core/templates";

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Contacto rápido: WhatsApp, llamar, email (con plantilla) y copiar datos.
 * Cada acción queda registrada en el historial del lead.
 */
export function ContactPanel({
  lead,
  settings,
  onLog,
}: {
  lead: SavedLead;
  settings: CrmSettings;
  onLog(update: LeadUpdate): Promise<void>;
}) {
  const wa = settings.templates.filter((t) => t.channel === "whatsapp");
  const em = settings.templates.filter((t) => t.channel === "email");
  const [waId, setWaId] = useState(wa[0]?.id ?? "");
  const [emId, setEmId] = useState(em[0]?.id ?? "");
  const [copied, setCopied] = useState<string>();
  const waTpl = wa.find((t) => t.id === waId);
  const emTpl = em.find((t) => t.id === emId);
  const waHref = whatsappLink(lead, waTpl, settings);
  const mailHref = mailtoLink(lead, emTpl, settings);
  const blocked = Boolean(lead.doNotContact);

  const log = (channel: ContactChannel, template?: string) => void onLog({ logContact: { channel, template } });

  async function copy(text: string, channel: ContactChannel) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(channel);
      setTimeout(() => setCopied(undefined), 1500);
      log(channel);
    } catch {
      /* el navegador no permite copiar aquí */
    }
  }

  if (blocked) {
    return <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">Marcado como &ldquo;no contactar&rdquo;: los botones de contacto están desactivados.</p>;
  }

  const btn = "btn btn-sm justify-start";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <select className="input py-1.5" value={waId} onChange={(e) => setWaId(e.target.value)} aria-label="Plantilla de WhatsApp">
          <option value="">WhatsApp sin plantilla</option>
          {wa.map((t) => (
            <option key={t.id} value={t.id}>
              WhatsApp · {t.name}
            </option>
          ))}
        </select>
        {waHref ? (
          <a className={`${btn} btn-primary`} href={waHref} target="_blank" rel="noreferrer" onClick={() => log("whatsapp", waTpl?.name)}>
            <MessageCircle className="size-4" aria-hidden /> Abrir WhatsApp
          </a>
        ) : (
          <button className={btn} disabled title="Sin teléfono válido">
            <MessageCircle className="size-4" aria-hidden /> Sin teléfono
          </button>
        )}
        {waTpl && waHref && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] whitespace-pre-wrap text-fg-2 sm:col-span-2">{renderTemplate(waTpl.body, lead, settings)}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <select className="input py-1.5" value={emId} onChange={(e) => setEmId(e.target.value)} aria-label="Plantilla de email">
          <option value="">Email sin plantilla</option>
          {em.map((t) => (
            <option key={t.id} value={t.id}>
              Email · {t.name}
            </option>
          ))}
        </select>
        {mailHref ? (
          <a className={btn} href={mailHref} onClick={() => log("email", emTpl?.name)}>
            <Mail className="size-4" aria-hidden /> Escribir email
          </a>
        ) : (
          <button className={btn} disabled title="Sin email">
            <Mail className="size-4" aria-hidden /> Sin email
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {lead.phone && (
          <a className={btn} href={`tel:${lead.phoneE164 ?? lead.phone}`} onClick={() => log("call")}>
            <Phone className="size-4" aria-hidden /> Llamar
          </a>
        )}
        {lead.phone && (
          <button className={btn} onClick={() => void copy(lead.phone!, "copy-phone")}>
            <Copy className="size-4" aria-hidden /> {copied === "copy-phone" ? "¡Copiado!" : "Copiar teléfono"}
          </button>
        )}
        {lead.emails[0] && (
          <button className={btn} onClick={() => void copy(lead.emails[0], "copy-email")}>
            <Copy className="size-4" aria-hidden /> {copied === "copy-email" ? "¡Copiado!" : "Copiar email"}
          </button>
        )}
      </div>

      {(lead.contacts?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Historial de contacto</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {lead.contacts!.slice(0, 6).map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>
                  {CONTACT_CHANNELS[c.channel]}
                  {c.template ? <span className="text-muted"> · {c.template}</span> : null}
                </span>
                <span className="text-muted">{dateFmt.format(new Date(c.at))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

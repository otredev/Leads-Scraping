"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, Link2, X } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import type { LeadUpdate } from "@/core/crm";
import { otrelinkBrief, otrelinkPrompt } from "@/core/otrelink";

/**
 * Página del negocio: copia un brief para que Claude la cree en Otrelink
 * (con su conector) y guarda el enlace resultante en el lead.
 */
export function PagePanel({ lead, onPatch, busy }: { lead: SavedLead; onPatch(u: LeadUpdate): Promise<void>; busy?: boolean }) {
  const brief = useMemo(() => otrelinkBrief(lead), [lead]);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(lead.pageUrl ?? "");
  const [copyError, setCopyError] = useState<string>();

  async function copy() {
    setCopyError(undefined);
    try {
      await navigator.clipboard.writeText(otrelinkPrompt(brief));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError("El navegador no permite copiar aquí.");
    }
  }

  async function save(value: string | null) {
    await onPatch({ pageUrl: value });
    setEditing(false);
  }

  const has = brief.business;
  const included = [
    has.phone && "teléfono",
    has.whatsapp && "WhatsApp",
    has.email && "email",
    has.website && "web",
    has.hours?.length && "horario",
    has.address && "mapa",
    has.rating && "valoración",
    has.topReviews.length && `${has.topReviews.length} reseñas`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3">
      {lead.pageUrl && !editing ? (
        <div className="flex items-center gap-2 text-sm">
          <Link2 className="size-4 text-muted" aria-hidden />
          <a href={lead.pageUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline decoration-line-strong underline-offset-2">
            {lead.pageUrl.replace(/^https?:\/\//, "")}
          </a>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Cambiar
          </button>
          <button className="btn btn-ghost size-8 p-0 text-muted" onClick={() => void save(null)} disabled={busy} aria-label="Quitar enlace de la página">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <form
          className="grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) void save(url.trim());
          }}
        >
          <input
            className="input min-w-0"
            type="url"
            inputMode="url"
            placeholder="Pega aquí el enlace de su página"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Enlace de la página del negocio"
          />
          <button className="btn" disabled={busy || !url.trim()}>
            Guardar
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
        <p className="text-[13px] text-fg-2">
          Copia un encargo para Claude con los datos del negocio ({included.join(", ") || "solo el nombre"}) y la plantilla sugerida{" "}
          <span className="font-medium text-fg">{brief.template.id}</span>. Pégalo en un chat con el conector de Otrelink y Claude creará la página en
          borrador.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => void copy()}>
            {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
            {copied ? "Copiado" : "Copiar para Claude"}
          </button>
          <a className="btn btn-sm" href="https://claude.ai/new" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden /> Abrir Claude
          </a>
        </div>
        {copyError && <p className="text-[13px] text-danger">{copyError}</p>}
      </div>
    </div>
  );
}

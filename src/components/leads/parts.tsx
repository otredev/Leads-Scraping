"use client";

import { Fragment } from "react";
import { Ban, ExternalLink, Sparkles } from "lucide-react";
import type { Lead, SavedLead } from "@/core/lead";
import type { LeadField } from "@/core/fields";
import { LABEL_COLORS, type CrmSettings, type LabelColor } from "@/core/crm";
import { AUTO_TAGS, autoTags, leadScore } from "@/core/score";
import { SOCIAL_NETWORKS, type Socials } from "@/core/socials";

/* Piezas de presentación de un lead, compartidas por tabla, lista, tablero y ficha. */

export const labelVar = (c?: string) => `var(--label-${c ?? "gray"})`;

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const nil = <span className="text-muted">—</span>;

export function ColorDot({ color, className = "size-2.5" }: { color?: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: labelVar(color) }} />;
}

export function StageBadge({ stageId, settings }: { stageId?: string; settings?: CrmSettings }) {
  const stage = settings?.stages.find((s) => s.id === stageId);
  return (
    <span className="badge whitespace-nowrap border border-line bg-surface text-fg-2">
      <ColorDot color={stage?.color} className="size-2" />
      {stage?.name ?? "Sin etapa"}
    </span>
  );
}

export function TagChip({ name, color, auto, onRemove }: { name: string; color?: string; auto?: boolean; onRemove?(): void }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${
        auto ? "border-dashed border-line-strong text-muted" : "border-line bg-surface-2 text-fg-2"
      }`}
      title={auto ? `${name} (automática)` : name}
    >
      {auto ? <Sparkles className="size-3" aria-hidden /> : <ColorDot color={color} className="size-2" />}
      <span className="truncate">{name}</span>
      {onRemove && (
        <button className="-mr-0.5 text-muted hover:text-fg" onClick={onRemove} aria-label={`Quitar etiqueta ${name}`}>
          ×
        </button>
      )}
    </span>
  );
}

/** Etiquetas manuales (si es un lead guardado) + automáticas. */
export function LeadTags({ lead, settings, max = 4, showAuto = true }: { lead: Lead; settings?: CrmSettings; max?: number; showAuto?: boolean }) {
  const manual = ((lead as Partial<SavedLead>).tags ?? [])
    .map((id) => settings?.tags.find((t) => t.id === id))
    .filter(Boolean) as { id: string; name: string; color: LabelColor }[];
  const auto = showAuto ? autoTags(lead, settings?.lowRating).map((id) => AUTO_TAGS.find((t) => t.id === id)!) : [];
  const all = [...manual.map((t) => ({ ...t, auto: false })), ...auto.map((t) => ({ ...t, color: undefined, auto: true }))];
  if (!all.length) return nil;
  const shown = all.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <TagChip key={t.id} name={t.name} color={t.color} auto={t.auto} />
      ))}
      {all.length > shown.length && <span className="text-xs text-muted">+{all.length - shown.length}</span>}
    </span>
  );
}

export function ScoreBar({ lead }: { lead: Lead }) {
  const s = leadScore(lead);
  return (
    <span className="inline-flex items-center gap-2" title={`Puntuación ${s} de 100`}>
      <span className="w-6 text-right font-medium tabular-nums">{s}</span>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-primary-track" aria-hidden>
        <span className="block h-full rounded-full bg-chart" style={{ width: `${s}%` }} />
      </span>
    </span>
  );
}

export function DncBadge({ reason }: { reason?: string }) {
  return (
    <span className="badge whitespace-nowrap bg-danger-soft text-danger" title={reason ? `No contactar: ${reason}` : "No contactar"}>
      <Ban className="size-3" aria-hidden />
      No contactar
    </span>
  );
}

export function Cell({ field, lead, settings }: { field: LeadField; lead: Lead; settings?: CrmSettings }) {
  const crm = lead as Partial<SavedLead>;
  switch (field.key) {
    case "name":
      return (
        <span className="inline-flex items-center gap-2">
          {crm.color && <ColorDot color={crm.color} />}
          <span className="font-medium text-fg">{lead.name}</span>
          {crm.doNotContact && <Ban className="size-3.5 text-danger" aria-label="No contactar" />}
        </span>
      );
    case "emails":
      return lead.emails.length ? (
        <span className="flex flex-col">
          {lead.emails.map((e) => (
            <a key={e} href={`mailto:${e}`} className="break-all text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
              {e}
            </a>
          ))}
        </span>
      ) : (
        nil
      );
    case "phone":
      return lead.phone ? (
        <a href={`tel:${lead.phoneE164 ?? lead.phone.replace(/\s/g, "")}`} className="whitespace-nowrap text-fg-2 hover:text-fg hover:underline">
          {lead.phone}
        </a>
      ) : (
        nil
      );
    case "socials":
      return lead.socials && Object.keys(lead.socials).length ? <SocialLinks socials={lead.socials} compact /> : nil;
    case "website":
    case "url":
    case "pageUrl":
      return field.value(lead) ? (
        <a
          href={String(field.value(lead))}
          target="_blank"
          rel="noreferrer"
          className="break-all text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg"
        >
          {field.key === "url" ? "Ver ficha" : hostname(String(field.value(lead)))}
        </a>
      ) : (
        nil
      );
    case "rating":
      return lead.rating !== undefined ? (
        <span className="inline-flex items-center gap-2" title={`${lead.rating} de 5`}>
          <span className="font-medium">{lead.rating.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-primary-track" aria-hidden>
            <span className="block h-full rounded-full bg-chart" style={{ width: `${(lead.rating / 5) * 100}%` }} />
          </span>
        </span>
      ) : (
        nil
      );
    case "score":
      return <ScoreBar lead={lead} />;
    case "stage":
      return <StageBadge stageId={crm.stage} settings={settings} />;
    case "tags":
      return <LeadTags lead={lead} settings={settings} showAuto={false} />;
    case "autoTags":
      return <LeadTags lead={{ ...lead, tags: [] } as Lead} settings={settings} />;
    case "color":
      return crm.color ? (
        <span className="inline-flex items-center gap-1.5">
          <ColorDot color={crm.color} />
          {LABEL_COLORS.find((c) => c.id === crm.color)?.name}
        </span>
      ) : (
        nil
      );
    case "doNotContact":
      return crm.doNotContact ? <DncBadge reason={crm.doNotContact.reason} /> : nil;
    case "notes":
      return crm.notes?.length ? <span className="tabular-nums">{crm.notes.length}</span> : nil;
    case "lastContactAt":
      return crm.lastContactAt ? (
        <span className="whitespace-nowrap text-fg-2">{new Date(crm.lastContactAt).toLocaleDateString("es")}</span>
      ) : (
        nil
      );
    case "savedAt":
      return crm.savedAt ? <span className="whitespace-nowrap text-fg-2">{new Date(crm.savedAt).toLocaleDateString("es")}</span> : nil;
    case "reviewCount":
      return <span className="tabular-nums">{lead.reviewCount ?? "—"}</span>;
    case "openingHours":
      return lead.openingHours ? <span>{Object.keys(lead.openingHours).length} días</span> : nil;
    case "reviews":
      return <span className="tabular-nums">{lead.reviews.length}</span>;
    default: {
      const v = field.format(lead);
      return v ? <span className="text-fg-2">{v}</span> : nil;
    }
  }
}

/** Horario y reseñas de un lead. */
export function HoursAndReviews({ lead, columns = true }: { lead: Lead; columns?: boolean }) {
  return (
    <div className={columns ? "grid gap-6 md:grid-cols-[minmax(200px,300px)_minmax(0,1fr)] md:gap-10" : "flex flex-col gap-6"}>
      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-fg">Horario</h3>
        {lead.openingHours ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {Object.entries(lead.openingHours).map(([day, ranges]) => (
              <Fragment key={day}>
                <dt className="capitalize text-muted">{day}</dt>
                <dd>{ranges.length ? ranges.join(", ") : "Cerrado"}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p className="hint">Sin horario publicado.</p>
        )}
      </section>
      <section className="min-w-0">
        <h3 className="mb-2 text-[13px] font-semibold text-fg">Reseñas ({lead.reviews.length})</h3>
        {lead.reviews.length ? (
          <ul className="flex max-h-80 max-w-[72ch] flex-col gap-3 overflow-y-auto pr-2">
            {lead.reviews.slice(0, 20).map((r, i) => (
              <li key={i} className="text-[13px]">
                <p>
                  <span className="font-medium">{r.author ?? "Anónimo"}</span>
                  {r.rating !== undefined && <span className="ml-2 font-medium text-fg-2">{r.rating}/5</span>}
                  {r.date && <span className="ml-2 text-muted">{r.date}</span>}
                </p>
                {r.text && <p className="text-fg-2">{r.text}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Sin reseñas extraídas.</p>
        )}
        {lead.url && (
          <a href={lead.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] underline underline-offset-2">
            Abrir en Google Maps <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </section>
    </div>
  );
}

/** Selector de color de etiqueta (accesible: cada opción tiene nombre). */
export function ColorPicker({
  value,
  onChange,
  allowNone,
  label = "Color",
}: {
  value?: string;
  onChange(c: LabelColor | null): void;
  allowNone?: boolean;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button
          role="radio"
          aria-checked={!value}
          onClick={() => onChange(null)}
          title="Sin color"
          className={`grid size-6 place-items-center rounded-full border text-xs text-muted ${!value ? "border-fg" : "border-line-strong"}`}
        >
          ∅<span className="sr-only">Sin color</span>
        </button>
      )}
      {LABEL_COLORS.map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={value === c.id}
          onClick={() => onChange(c.id)}
          title={c.name}
          className={`grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-surface ${value === c.id ? "ring-2 ring-fg" : ""}`}
        >
          <span className="size-4 rounded-full" style={{ background: labelVar(c.id) }} />
          <span className="sr-only">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

const SOCIAL_SHORT: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  tiktok: "TT",
  linkedin: "in",
  x: "X",
  youtube: "YT",
  whatsapp: "WA",
  telegram: "TG",
  pinterest: "Pin",
  threads: "Th",
};

/** Enlaces a redes sociales: abreviados en la tabla, con nombre en la ficha. */
export function SocialLinks({ socials, compact }: { socials: Socials; compact?: boolean }) {
  const list = SOCIAL_NETWORKS.filter((n) => socials[n.id]);
  return (
    <span className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
      {list.map((n) => (
        <a
          key={n.id}
          href={socials[n.id]}
          target="_blank"
          rel="noreferrer"
          title={`${n.label}: ${socials[n.id]}`}
          className={`badge border border-line text-fg-2 hover:border-line-strong hover:text-fg ${compact ? "px-1.5 text-[11px]" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          {compact ? SOCIAL_SHORT[n.id] : n.label}
        </a>
      ))}
    </span>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Columns3, Download, Pin, RotateCcw, Search, X } from "lucide-react";
import type { Lead } from "@/core/lead";
import { LABEL_COLORS, type CrmSettings } from "@/core/crm";
import { AUTO_TAGS } from "@/core/score";
import { defaultOptions, type OptionValues } from "@/core/options";
import { toSearchParams } from "@/core/query";
import { OptionInput } from "../OptionInput";
import type { ExporterInfo } from "../types";
import { Popover } from "./Popover";
import type { LeadView } from "./useLeadView";

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange(v: boolean): void }) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-fg-2 hover:bg-surface-2"
      }`}
    >
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Ordenar y mostrar/ocultar columnas. */
function ColumnsMenu({ view, onChange, onResetWidths }: { view: LeadView; onChange(cols: string[]): void; onResetWidths(): void }) {
  const hidden = view.fields.filter((f) => !view.columns.includes(f.key));
  const move = (i: number, d: -1 | 1) => {
    const next = [...view.columns];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Popover
      label={
        <>
          <Columns3 className="size-4" aria-hidden /> Columnas
        </>
      }
      width="w-64"
    >
      <p className="px-1 text-xs font-medium text-muted">Visibles (en orden)</p>
      <ul className="flex flex-col">
        {view.visibleFields.map((f, i) => (
          <li key={f.key} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-surface-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked
                disabled={view.columns.length === 1}
                onChange={() => onChange(view.columns.filter((k) => k !== f.key))}
              />
              <span className="truncate">{f.label}</span>
            </label>
            <button className="btn btn-ghost size-7 p-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${f.label}`}>
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button
              className="btn btn-ghost size-7 p-0"
              onClick={() => move(i, 1)}
              disabled={i === view.columns.length - 1}
              aria-label={`Bajar ${f.label}`}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <>
          <p className="mt-1 px-1 text-xs font-medium text-muted">Ocultas</p>
          <ul className="flex flex-col">
            {hidden.map((f) => (
              <li key={f.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" className="size-4 accent-primary" checked={false} onChange={() => onChange([...view.columns, f.key])} />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {Object.keys(view.widths).length > 0 && (
        <button className="btn btn-ghost btn-sm justify-start" onClick={onResetWidths}>
          Restablecer anchos
        </button>
      )}
      <p className="hint px-1">
        El orden se guarda y también se usa al exportar &ldquo;solo columnas visibles&rdquo;. Para cambiar el ancho, arrastra el borde derecho de
        la cabecera.
      </p>
    </Popover>
  );
}

function ExportMenu({ view, exporters, searchId }: { view: LeadView; exporters: ExporterInfo[]; searchId?: string }) {
  const [exporterId, setExporterId] = useState<string>();
  const [opts, setOpts] = useState<Record<string, OptionValues>>({});
  const exporter = exporters.find((e) => e.id === exporterId) ?? exporters[0];
  const values = exporter ? { ...defaultOptions(exporter.options), ...opts[exporter.id] } : {};

  function href(allColumns: boolean) {
    const p = toSearchParams(view.filters, view.sort);
    p.set("format", exporter?.id ?? "csv");
    if (view.table === "saved") p.set("scope", "saved");
    else if (searchId && searchId !== "all") p.set("searchId", searchId);
    if (!allColumns) p.set("fields", view.columns.join(","));
    for (const [k, v] of Object.entries(values)) p.set(k, String(v));
    return `/api/export?${p.toString()}`;
  }

  return (
    <Popover
      buttonClassName="btn btn-primary btn-sm"
      disabled={!view.rows.length || !exporter}
      width="w-72"
      label={
        <>
          <Download className="size-4" aria-hidden /> Exportar
        </>
      }
    >
      {(close) =>
        exporter && (
          <div className="flex flex-col gap-3 p-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`exp-${view.table}`} className="label">
                Formato
              </label>
              <select id={`exp-${view.table}`} className="input" value={exporter.id} onChange={(e) => setExporterId(e.target.value)}>
                {exporters.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            {exporter.options.map((f) => (
              <OptionInput
                key={`${exporter.id}-${f.key}`}
                field={f}
                value={values[f.key]}
                onChange={(v) => setOpts((o) => ({ ...o, [exporter.id]: { ...values, [f.key]: v } }))}
              />
            ))}
            <a className="btn btn-primary" href={href(true)} onClick={close}>
              Descargar con todos los campos
            </a>
            <a className="btn" href={href(false)} onClick={close}>
              Solo columnas visibles
            </a>
            <p className="hint">Se exportan los {view.rows.length} leads filtrados, en el orden actual.</p>
          </div>
        )
      }
    </Popover>
  );
}

export function LeadsToolbar({
  view,
  leads,
  settings,
  exporters,
  searchId,
  extra,
  onColumnsChange,
  onWidthsReset,
  onSaveDefaults,
}: {
  view: LeadView;
  leads: Lead[];
  settings?: CrmSettings;
  exporters: ExporterInfo[];
  searchId?: string;
  /** Acciones extra a la derecha (p. ej. "Guardar N visibles"). */
  extra?: ReactNode;
  onColumnsChange(cols: string[]): void;
  onWidthsReset(): void;
  onSaveDefaults(): Promise<void>;
}) {
  const f = view.filters;
  const saved = view.table === "saved";
  const [savingDefaults, setSavingDefaults] = useState(false);
  const categories = useMemo(
    () => [...new Set(leads.map((l) => l.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es")),
    [leads],
  );
  const hasFilters = Object.keys(f).length > 0;

  return (
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className="input pl-9"
            type="search"
            placeholder="Buscar por nombre, dirección, email…"
            value={f.q ?? ""}
            onChange={(e) => view.update({ q: e.target.value })}
            aria-label="Buscar en los leads"
          />
        </div>
        {saved && settings && (
          <select className="input w-auto" value={f.stage ?? ""} onChange={(e) => view.update({ stage: e.target.value || undefined })} aria-label="Etapa">
            <option value="">Todas las etapas</option>
            {settings.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select className="input w-auto" value={f.tag ?? ""} onChange={(e) => view.update({ tag: e.target.value || undefined })} aria-label="Etiqueta">
          <option value="">Todas las etiquetas</option>
          {saved && settings && settings.tags.length > 0 && (
            <optgroup label="Tus etiquetas">
              {settings.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Automáticas">
            {AUTO_TAGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        </select>
        <select className="input w-auto" value={f.category ?? ""} onChange={(e) => view.update({ category: e.target.value || undefined })} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={f.minRating ?? ""}
          onChange={(e) => view.update({ minRating: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="Valoración mínima"
        >
          <option value="">Cualquier valoración</option>
          {[3, 3.5, 4, 4.5].map((r) => (
            <option key={r} value={r}>
              {r.toLocaleString("es")}+ estrellas
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={f.minScore ?? ""}
          onChange={(e) => view.update({ minScore: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="Puntuación mínima"
        >
          <option value="">Cualquier puntuación</option>
          {[40, 60, 80].map((r) => (
            <option key={r} value={r}>
              Puntuación {r}+
            </option>
          ))}
        </select>
        <input
          className="input w-32"
          type="number"
          min={0}
          placeholder="Mín. reseñas"
          value={f.minReviews ?? ""}
          onChange={(e) => view.update({ minReviews: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="Mínimo de reseñas"
        />
        {saved && (
          <>
            <select className="input w-auto" value={f.color ?? ""} onChange={(e) => view.update({ color: e.target.value || undefined })} aria-label="Color">
              <option value="">Cualquier color</option>
              <option value="none">Sin color</option>
              {LABEL_COLORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input w-auto"
              value={f.dnc ?? "all"}
              onChange={(e) => view.update({ dnc: e.target.value === "all" ? undefined : (e.target.value as "hide" | "only") })}
              aria-label="No contactar"
            >
              <option value="hide">Ocultar &ldquo;no contactar&rdquo;</option>
              <option value="all">Incluir &ldquo;no contactar&rdquo;</option>
              <option value="only">Solo &ldquo;no contactar&rdquo;</option>
            </select>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle on={Boolean(f.hasEmail)} label="Con email" onChange={(v) => view.update({ hasEmail: v })} />
        <Toggle on={Boolean(f.hasPhone)} label="Con teléfono" onChange={(v) => view.update({ hasPhone: v })} />
        <Toggle on={Boolean(f.noWebsite)} label="Sin web" onChange={(v) => view.update({ noWebsite: v, hasWebsite: undefined })} />
        <Toggle on={Boolean(f.hasSocials)} label="Con redes" onChange={(v) => view.update({ hasSocials: v || undefined })} />
        {!view.isDefault && (
          <button className="btn btn-ghost btn-sm" onClick={view.resetToDefaults} title="Vuelve a tus filtros predeterminados">
            <RotateCcw className="size-3.5" aria-hidden /> Restablecer
          </button>
        )}
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={view.clearFilters}>
            <X className="size-3.5" aria-hidden /> Quitar filtros
          </button>
        )}
        {!view.isDefault && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={savingDefaults}
            onClick={async () => {
              setSavingDefaults(true);
              try {
                await onSaveDefaults();
              } finally {
                setSavingDefaults(false);
              }
            }}
            title="Estos filtros y este orden se aplicarán al abrir la página y al pulsar Restablecer"
          >
            <Pin className="size-3.5" aria-hidden /> {savingDefaults ? "Guardando…" : "Fijar como predeterminados"}
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 [&_.btn]:whitespace-nowrap">
          <span className="mr-1 text-[13px] text-muted tabular-nums">
            {view.rows.length === leads.length ? `${leads.length} ${saved ? "leads" : "resultados"}` : `${view.rows.length} de ${leads.length}`}
          </span>
          {extra}
          <ColumnsMenu view={view} onChange={onColumnsChange} onResetWidths={onWidthsReset} />
          <ExportMenu view={view} exporters={exporters} searchId={searchId} />
        </div>
      </div>
    </div>
  );
}

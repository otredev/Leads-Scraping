"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, AtSign, Bookmark, BookmarkPlus, Columns3, Download, ExternalLink, Globe, Phone, Search, Trash2, X } from "lucide-react";
import { leadDedupeKey, type Lead } from "@/core/lead";
import { LEAD_FIELDS, type LeadField } from "@/core/fields";
import { defaultOptions, type OptionValues } from "@/core/options";
import { queryLeads, toSearchParams, type LeadFilters, type LeadSort } from "@/core/query";
import { OptionInput } from "./OptionInput";
import { EmptyState, Loading, Skeleton } from "./ui";
import type { ExporterInfo } from "./types";

const PAGE_SIZE = 50;

interface Props {
  leads: Lead[];
  /** Búsqueda seleccionada ("all" = todas). Solo para resultados. */
  searchId: string;
  exporters: ExporterInfo[];
  loading: boolean;
  /** "results": resultados de búsqueda (se pueden guardar). "saved": leads guardados. */
  mode?: "results" | "saved";
  /** Claves de los leads ya guardados (modo resultados). */
  savedKeys?: Set<string>;
  onSave?(ids: string[]): Promise<void>;
  onTrash?(ids: string[]): Promise<void>;
  empty?: ReactNode;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const nil = <span className="text-muted">—</span>;

function Cell({ field, lead }: { field: LeadField; lead: Lead }) {
  switch (field.key) {
    case "name":
      return <span className="font-medium text-fg">{lead.name}</span>;
    case "emails":
      return lead.emails.length ? (
        <span className="flex flex-col">
          {lead.emails.map((e) => (
            <a key={e} href={`mailto:${e}`} className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
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
    case "website":
    case "url":
      return field.value(lead) ? (
        <a
          href={String(field.value(lead))}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg"
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

/** Vías de contacto disponibles: lo primero que se mira de un lead. */
function Reach({ lead }: { lead: Lead }) {
  const items = [
    { on: lead.emails.length > 0, label: "email", Icon: AtSign },
    { on: Boolean(lead.phone), label: "teléfono", Icon: Phone },
    { on: Boolean(lead.website), label: "web", Icon: Globe },
  ];
  const have = items.filter((i) => i.on).map((i) => i.label);
  const text = have.length ? `Tiene ${have.join(", ")}` : "Sin datos de contacto";
  return (
    <span className="inline-flex gap-1" title={text}>
      {items.map(({ on, label, Icon }) => (
        <span
          key={label}
          aria-hidden
          className={`grid size-6 place-items-center rounded-md ${on ? "bg-primary-soft text-primary" : "text-line-strong"}`}
        >
          <Icon className="size-3.5" />
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Detail({ lead }: { lead: Lead }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(200px,300px)_minmax(0,1fr)] md:gap-10">
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
          <a href={lead.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
            Abrir en Google Maps <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </section>
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange(v: boolean): void }) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-fg-2 hover:bg-surface-2"
      }`}
    >
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function TableSkeleton() {
  const widths = ["w-40", "w-28", "w-36", "w-24", "w-32", "w-44"];
  return (
    <Loading label="Cargando leads…">
      <div className="flex items-center gap-6 border-b border-line bg-surface-2 px-4 py-3">
        {["w-16", "w-14", "w-12", "w-16", "w-10", "w-16"].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w} ${i > 3 ? "hidden md:block" : ""}`} />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-0">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="size-6" />
            ))}
          </div>
          <Skeleton className={`h-3.5 ${widths[r % widths.length]}`} />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="hidden h-3.5 w-36 sm:block" />
          <Skeleton className="hidden h-3.5 w-24 md:block" />
          <Skeleton className="hidden h-3.5 w-28 lg:block" />
          <Skeleton className="ml-auto hidden h-3.5 w-14 lg:block" />
        </div>
      ))}
    </Loading>
  );
}

export function LeadsTable({
  leads,
  searchId,
  exporters,
  loading,
  mode = "results",
  savedKeys,
  onSave,
  onTrash,
  empty,
}: Props) {
  const [busy, setBusy] = useState<string>();
  const [filters, setFilters] = useState<LeadFilters>({});
  const [sort, setSort] = useState<LeadSort | undefined>({ field: "rating", dir: "desc" });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const [visible, setVisible] = useState(() => LEAD_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key));
  const [exporterId, setExporterId] = useState<string>();
  const [exportOpts, setExportOpts] = useState<Record<string, OptionValues>>({});
  const [panel, setPanel] = useState<"export" | "columns">();

  const categories = useMemo(
    () => [...new Set(leads.map((l) => l.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es")),
    [leads],
  );
  const rows = useMemo(() => queryLeads(leads, filters, sort), [leads, filters, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const columns = LEAD_FIELDS.filter((f) => visible.includes(f.key));

  const exporter = exporters.find((e) => e.id === exporterId) ?? exporters[0];
  const exporterValues = exporter ? { ...defaultOptions(exporter.options), ...exportOpts[exporter.id] } : {};
  const isSaved = (l: Lead) => Boolean(savedKeys?.has(leadDedupeKey(l)));
  const unsavedVisible = mode === "results" && savedKeys ? rows.filter((l) => !isSaved(l)) : [];

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(undefined);
    }
  }

  const activeFilters = Object.values(filters).some((v) => v !== undefined && v !== "" && v !== false);

  function update(patch: Partial<LeadFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  function toggleSort(key: string) {
    setSort((s) =>
      s?.field !== key ? { field: key, dir: "asc" } : s.dir === "asc" ? { field: key, dir: "desc" } : undefined,
    );
  }

  function exportHref(allColumns: boolean) {
    const p = toSearchParams(filters, sort);
    p.set("format", exporter?.id ?? "csv");
    if (mode === "saved") p.set("scope", "saved");
    else if (searchId !== "all") p.set("searchId", searchId);
    if (!allColumns) p.set("fields", visible.join(","));
    for (const [k, v] of Object.entries(exporterValues)) p.set(k, String(v));
    return `/api/export?${p.toString()}`;
  }

  return (
    <section className="card" aria-label="Leads">
      {/* Barra de herramientas */}
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-[1_1_260px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              className="input pl-9"
              type="search"
              placeholder="Buscar por nombre, dirección, email…"
              value={filters.q ?? ""}
              onChange={(e) => update({ q: e.target.value })}
              aria-label="Buscar en los leads"
            />
          </div>
          <select
            className="input w-auto"
            value={filters.category ?? ""}
            onChange={(e) => update({ category: e.target.value || undefined })}
            aria-label="Categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.minRating ?? ""}
            onChange={(e) => update({ minRating: e.target.value ? Number(e.target.value) : undefined })}
            aria-label="Valoración mínima"
          >
            <option value="">Cualquier valoración</option>
            {[3, 3.5, 4, 4.5].map((r) => (
              <option key={r} value={r}>
                {r.toLocaleString("es")}+ estrellas
              </option>
            ))}
          </select>
          <input
            className="input w-32"
            type="number"
            min={0}
            placeholder="Mín. reseñas"
            value={filters.minReviews ?? ""}
            onChange={(e) => update({ minReviews: e.target.value ? Number(e.target.value) : undefined })}
            aria-label="Mínimo de reseñas"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle on={Boolean(filters.hasEmail)} label="Con email" onChange={(v) => update({ hasEmail: v })} />
          <Toggle on={Boolean(filters.hasPhone)} label="Con teléfono" onChange={(v) => update({ hasPhone: v })} />
          <Toggle on={Boolean(filters.hasWebsite)} label="Con web" onChange={(v) => update({ hasWebsite: v })} />
          {activeFilters && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({})}>
              <X className="size-3.5" aria-hidden /> Quitar filtros
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 [&_.btn]:whitespace-nowrap">
            <span className="mr-1 text-[13px] text-muted tabular-nums">
              {loading ? "" : rows.length === leads.length ? `${leads.length} ${mode === "saved" ? "leads" : "resultados"}` : `${rows.length} de ${leads.length}`}
            </span>
            {mode === "results" && onSave && (
              <button
                className="btn btn-sm"
                disabled={!unsavedVisible.length || busy === "save-all"}
                onClick={() => run("save-all", () => onSave(unsavedVisible.map((l) => l.id)))}
                title="Guarda en Leads todos los resultados que coinciden con los filtros (todas las páginas)"
              >
                <BookmarkPlus className="size-4" aria-hidden />
                {busy === "save-all"
                  ? "Guardando…"
                  : unsavedVisible.length
                    ? `Guardar ${unsavedVisible.length} ${unsavedVisible.length === 1 ? "visible" : "visibles"}`
                    : "Todo guardado"}
              </button>
            )}
            <div className="relative">
              <button
                className="btn btn-sm"
                onClick={() => setPanel((p) => (p === "columns" ? undefined : "columns"))}
                aria-expanded={panel === "columns"}
              >
                <Columns3 className="size-4" aria-hidden /> Columnas
              </button>
              {panel === "columns" && (
                <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-line bg-surface p-2 shadow-pop">
                  {LEAD_FIELDS.map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={visible.includes(f.key)}
                        onChange={(e) =>
                          setVisible((v) =>
                            e.target.checked
                              ? LEAD_FIELDS.map((x) => x.key).filter((k) => k === f.key || v.includes(k))
                              : v.filter((k) => k !== f.key),
                          )
                        }
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setPanel((p) => (p === "export" ? undefined : "export"))}
                aria-expanded={panel === "export"}
                disabled={!rows.length}
              >
                <Download className="size-4" aria-hidden /> Exportar
              </button>
              {panel === "export" && exporter && (
                <div className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-pop">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="exporter" className="label">
                      Formato
                    </label>
                    <select id="exporter" className="input" value={exporter.id} onChange={(e) => setExporterId(e.target.value)}>
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
                      value={exporterValues[f.key]}
                      onChange={(v) => setExportOpts((o) => ({ ...o, [exporter.id]: { ...exporterValues, [f.key]: v } }))}
                    />
                  ))}
                  <a className="btn btn-primary" href={exportHref(true)} onClick={() => setPanel(undefined)}>
                    Descargar con todos los campos
                  </a>
                  <a className="btn" href={exportHref(false)} onClick={() => setPanel(undefined)}>
                    Solo columnas visibles
                  </a>
                  <p className="hint">Se exportan los {rows.length} leads filtrados, en el orden actual.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : leads.length === 0 ? (
        <div className="p-5">
          {empty ?? (
            <EmptyState title="Todavía no hay resultados aquí">
              Lanza una búsqueda desde la sección Búsquedas. Con gosom, los resultados tardan unos minutos en llegar.
            </EmptyState>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Ningún lead cumple estos filtros"
            action={
              <button className="btn" onClick={() => setFilters({})}>
                Quitar filtros
              </button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {(onSave || onTrash) && (
                  <th scope="col" className="w-px py-0 pr-0 pl-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
                <th scope="col" className={`w-px py-0 pr-0 ${onSave || onTrash ? "pl-1" : "pl-4"}`}>
                  <span className="sr-only">Contacto</span>
                </th>
                {columns.map((f) => {
                  const dir = sort?.field === f.key ? sort.dir : undefined;
                  const num = f.kind === "number";
                  return (
                    <th
                      key={f.key}
                      scope="col"
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                      className="p-0 whitespace-nowrap"
                    >
                      <button
                        onClick={() => toggleSort(f.key)}
                        className={`flex w-full items-center gap-1 px-3 py-2.5 text-xs font-medium ${num ? "justify-end" : ""} ${
                          dir ? "text-fg" : "text-muted hover:text-fg"
                        }`}
                      >
                        {f.label}
                        {dir === "asc" && <ArrowUp className="size-3" aria-hidden />}
                        {dir === "desc" && <ArrowDown className="size-3" aria-hidden />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((lead) => {
                const open = expanded === lead.id;
                return (
                  <Fragment key={lead.id}>
                    <tr
                      className={`cursor-pointer border-b border-line transition-colors ${open ? "bg-primary-soft/60" : "hover:bg-surface-2"}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a")) return;
                        setExpanded(open ? undefined : lead.id);
                      }}
                    >
                      {(onSave || onTrash) && (
                      <td className="py-2 pr-0 pl-3 align-top">
                        {mode === "results" && onSave ? (
                          isSaved(lead) ? (
                            <span className="inline-flex size-8 items-center justify-center text-fg" title="Ya está en Leads">
                              <Bookmark className="size-4" fill="currentColor" aria-hidden />
                              <span className="sr-only">Guardado</span>
                            </span>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm size-8 p-0"
                              disabled={busy === lead.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void run(lead.id, () => onSave([lead.id]));
                              }}
                              title="Guardar en Leads"
                              aria-label={`Guardar ${lead.name} en Leads`}
                            >
                              <Bookmark className="size-4" aria-hidden />
                            </button>
                          )
                        ) : mode === "saved" && onTrash ? (
                          <button
                            className="btn btn-ghost btn-sm size-8 p-0 text-muted hover:text-danger"
                            disabled={busy === lead.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void run(lead.id, () => onTrash([lead.id]));
                            }}
                            title="Mover a la papelera"
                            aria-label={`Mover ${lead.name} a la papelera`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        ) : null}
                      </td>
                      )}
                      <td className={`py-3 pr-0 align-top ${onSave || onTrash ? "pl-1" : "pl-4"}`}>
                        <Reach lead={lead} />
                      </td>
                      {columns.map((f) => (
                        <td
                          key={f.key}
                          className={`px-3 py-3 align-top ${f.kind === "number" ? "text-right" : ""} ${
                            f.key === "name" ? "min-w-[200px]" : f.key === "address" ? "min-w-[220px]" : ""
                          }`}
                        >
                          {f.key === "name" ? (
                            <button
                              className="text-left"
                              aria-expanded={open}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(open ? undefined : lead.id);
                              }}
                            >
                              <Cell field={f} lead={lead} />
                            </button>
                          ) : (
                            <Cell field={f} lead={lead} />
                          )}
                        </td>
                      ))}
                    </tr>
                    {open && (
                      <tr className="border-b border-line bg-primary-soft/60">
                        <td colSpan={columns.length + 2} className={`px-5 pt-1 pb-5 ${onSave || onTrash ? "sm:pl-[132px]" : "sm:pl-[92px]"}`}>
                          <Detail lead={lead} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted" aria-label="Páginas">
          <span>
            Página {current + 1} de {pages}
          </span>
          <span className="flex gap-2">
            <button className="btn btn-sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Anterior
            </button>
            <button className="btn btn-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Siguiente
            </button>
          </span>
        </nav>
      )}
    </section>
  );
}

"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Ban, Bookmark, Trash2 } from "lucide-react";
import { leadDedupeKey, type Lead, type SavedLead } from "@/core/lead";
import type { CrmSettings } from "@/core/crm";
import { EmptyState, Loading, Skeleton } from "../ui";
import type { LeadField } from "@/core/fields";
import { Cell, HoursAndReviews, labelVar } from "./parts";
import type { LeadView } from "./useLeadView";

const PAGE_SIZE = 50;
const MIN_WIDTH = 60;
const MAX_WIDTH = 1000;

/** Ancho inicial de cada columna según su contenido. */
export function defaultWidth(f: LeadField): number {
  switch (f.key) {
    case "name":
      return 240;
    case "address":
      return 260;
    case "emails":
      return 230;
    case "website":
    case "phone":
    case "phoneE164":
    case "category":
      return 170;
    case "stage":
      return 150;
    case "score":
    case "rating":
      return 130;
    default:
      if (f.kind === "tags") return 200;
      if (f.kind === "number") return 120;
      return 170;
  }
}

/**
 * Asa para cambiar el ancho de una columna: arrastrar con el ratón o el dedo,
 * flechas izquierda/derecha con el teclado y doble clic para restablecer.
 */
function ResizeHandle({
  label,
  width,
  onResize,
  onCommit,
  onReset,
}: {
  label: string;
  width: number;
  onResize(w: number): void;
  onCommit(w: number): void;
  onReset(): void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const last = useRef(width);
  const clamp = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ancho de la columna ${label}`}
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      title="Arrastra para cambiar el ancho · doble clic para restablecer"
      className="group/resize absolute top-0 right-0 z-10 flex h-full w-3 translate-x-1/2 cursor-col-resize touch-none justify-center outline-none"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        last.current = clamp(start.current.w + e.clientX - start.current.x);
        onResize(last.current);
      }}
      onPointerUp={() => {
        if (!start.current) return;
        start.current = null;
        onCommit(last.current);
      }}
      onDoubleClick={onReset}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const w = clamp(width + (e.key === "ArrowRight" ? 10 : -10));
        onResize(w);
        onCommit(w);
      }}
    >
      <span className="h-full w-0.5 bg-transparent group-hover/resize:bg-line-strong group-focus-visible/resize:bg-fg" />
    </span>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const widths = ["w-40", "w-28", "w-36", "w-24", "w-32", "w-44"];
  return (
    <Loading label="Cargando leads…">
      <div className="flex items-center gap-6 border-b border-line bg-surface-2 px-4 py-3">
        {["w-16", "w-14", "w-12", "w-16", "w-10", "w-16"].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w} ${i > 3 ? "hidden md:block" : ""}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-0">
          <Skeleton className="size-4" />
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

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
    />
  );
}

/**
 * Tabla de leads. En resultados, al pulsar una fila se despliega su detalle;
 * en leads guardados se abre la ficha lateral (`onOpen`).
 */
export function LeadsTableView({
  view,
  loading,
  settings,
  savedKeys,
  dncKeys,
  onSave,
  onTrash,
  onOpen,
  onWidthsChange,
  empty,
}: {
  view: LeadView;
  loading: boolean;
  settings?: CrmSettings;
  savedKeys?: Set<string>;
  dncKeys?: Set<string>;
  onSave?(ids: string[]): Promise<void>;
  onTrash?(ids: string[]): Promise<void>;
  onOpen?(lead: SavedLead): void;
  /** Guarda los anchos al terminar de redimensionar. */
  onWidthsChange?(widths: Record<string, number>): void;
  empty: ReactNode;
}) {
  const [expanded, setExpanded] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const rows = view.rows;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(view.page, pages - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const pageIds = pageRows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => view.selection.has(id)).length;
  const hasActions = Boolean(onSave || onTrash);
  const widthOf = (f: LeadField) => view.widths[f.key] ?? defaultWidth(f);
  const fixedWidth = 44 + (hasActions ? 44 : 0);
  const tableWidth = fixedWidth + view.visibleFields.reduce((n, f) => n + widthOf(f), 0);
  const setWidth = (key: string, w: number) => view.setWidths((ws) => ({ ...ws, [key]: w }));

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(undefined);
    }
  };

  if (loading) return <TableSkeleton />;
  if (!rows.length) return <div className="p-5">{empty}</div>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table-fixed text-sm" style={{ width: tableWidth, minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {hasActions && <col style={{ width: 44 }} />}
            {view.visibleFields.map((f) => (
              <col key={f.key} style={{ width: widthOf(f) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th scope="col" className="w-px py-0 pr-0 pl-4">
                <Checkbox
                  checked={selectedOnPage > 0 && selectedOnPage === pageIds.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < pageIds.length}
                  onChange={(v) => view.selectMany(pageIds, v)}
                  label="Seleccionar todos los de esta página"
                />
              </th>
              {hasActions && (
                <th scope="col" className="w-px py-0 pr-0 pl-2">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
              {view.visibleFields.map((f) => {
                const dir = view.sort?.field === f.key ? view.sort.dir : undefined;
                const num = f.kind === "number";
                return (
                  <th
                    key={f.key}
                    scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    className="relative p-0 whitespace-nowrap"
                  >
                    <button
                      onClick={() => view.toggleSort(f.key)}
                      className={`flex w-full items-center gap-1 overflow-hidden px-3 py-2.5 text-xs font-medium ${num ? "justify-end" : ""} ${
                        dir ? "text-fg" : "text-muted hover:text-fg"
                      }`}
                      title={f.label}
                    >
                      <span className="truncate">{f.label}</span>
                      {dir === "asc" && <ArrowUp className="size-3" aria-hidden />}
                      {dir === "desc" && <ArrowDown className="size-3" aria-hidden />}
                    </button>
                    <ResizeHandle
                      label={f.label}
                      width={widthOf(f)}
                      onResize={(w) => setWidth(f.key, w)}
                      onCommit={(w) => onWidthsChange?.({ ...view.widths, [f.key]: w })}
                      onReset={() => {
                        const next = { ...view.widths };
                        delete next[f.key];
                        view.setWidths(next);
                        onWidthsChange?.(next);
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((lead: Lead) => {
              const crm = lead as Partial<SavedLead>;
              const open = expanded === lead.id;
              const key = savedKeys || dncKeys ? leadDedupeKey(lead) : "";
              const isSaved = savedKeys?.has(key);
              const isDnc = dncKeys?.has(key);
              const selected = view.selection.has(lead.id);
              const activate = () => {
                if (onOpen) onOpen(lead as SavedLead);
                else setExpanded(open ? undefined : lead.id);
              };
              return (
                <Fragment key={lead.id}>
                  <tr
                    className={`cursor-pointer border-b border-line transition-colors ${
                      open || selected ? "bg-primary-soft/60" : "hover:bg-surface-2"
                    }`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button,input")) return;
                      activate();
                    }}
                  >
                    <td
                      className="py-3 pr-0 pl-4 align-top"
                      style={crm.color ? { boxShadow: `inset 3px 0 0 ${labelVar(crm.color)}` } : undefined}
                    >
                      <Checkbox checked={selected} onChange={() => view.toggle(lead.id)} label={`Seleccionar ${lead.name}`} />
                    </td>
                    {hasActions && (
                      <td className="py-2 pr-0 pl-2 align-top">
                        {onSave ? (
                          isSaved ? (
                            <span className="inline-flex size-8 items-center justify-center text-fg" title="Ya está en Leads">
                              <Bookmark className="size-4" fill="currentColor" aria-hidden />
                              <span className="sr-only">Guardado</span>
                            </span>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm size-8 p-0"
                              disabled={busy === lead.id}
                              onClick={() => void run(lead.id, () => onSave([lead.id]))}
                              title="Guardar en Leads"
                              aria-label={`Guardar ${lead.name} en Leads`}
                            >
                              <Bookmark className="size-4" aria-hidden />
                            </button>
                          )
                        ) : onTrash ? (
                          <button
                            className="btn btn-ghost btn-sm size-8 p-0 text-muted hover:text-danger"
                            disabled={busy === lead.id}
                            onClick={() => void run(lead.id, () => onTrash([lead.id]))}
                            title="Mover a la papelera"
                            aria-label={`Mover ${lead.name} a la papelera`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        ) : null}
                      </td>
                    )}
                    {view.visibleFields.map((f) => (
                      <td
                        key={f.key}
                        className={`overflow-hidden px-3 py-3 align-top break-words ${f.kind === "number" ? "text-right" : ""}`}
                      >
                        {f.key === "name" ? (
                          <button className="text-left" aria-expanded={onOpen ? undefined : open} onClick={activate}>
                            <Cell field={f} lead={lead} settings={settings} />
                            {isDnc && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs text-danger" title="Marcado como no contactar en Leads">
                                <Ban className="size-3" aria-hidden /> No contactar
                              </span>
                            )}
                          </button>
                        ) : (
                          <Cell field={f} lead={lead} settings={settings} />
                        )}
                      </td>
                    ))}
                  </tr>
                  {open && !onOpen && (
                    <tr className="border-b border-line bg-primary-soft/60">
                      <td colSpan={view.visibleFields.length + (hasActions ? 2 : 1)} className="px-5 pt-1 pb-5 sm:pl-[100px]">
                        <HoursAndReviews lead={lead} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted" aria-label="Páginas">
          <span>
            Página {current + 1} de {pages}
          </span>
          <span className="flex gap-2">
            <button className="btn btn-sm" disabled={current === 0} onClick={() => view.setPage(current - 1)}>
              Anterior
            </button>
            <button className="btn btn-sm" disabled={current >= pages - 1} onClick={() => view.setPage(current + 1)}>
              Siguiente
            </button>
          </span>
        </nav>
      )}
    </>
  );
}

export function NoMatches({ onClear }: { onClear(): void }) {
  return (
    <EmptyState
      title="Ningún lead cumple estos filtros"
      action={
        <button className="btn" onClick={onClear}>
          Quitar filtros
        </button>
      }
    />
  );
}

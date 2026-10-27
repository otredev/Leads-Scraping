"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Ban, Bookmark, Trash2 } from "lucide-react";
import { leadDedupeKey, type Lead, type SavedLead } from "@/core/lead";
import type { CrmSettings } from "@/core/crm";
import { EmptyState, Loading, Skeleton } from "../ui";
import { Cell, HoursAndReviews, Reach, labelVar } from "./parts";
import type { LeadView } from "./useLeadView";

const PAGE_SIZE = 50;

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
        <table className="w-full text-sm">
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
              <th scope="col" className="w-px py-0 pr-0 pl-2">
                <span className="sr-only">Contacto</span>
              </th>
              {view.visibleFields.map((f) => {
                const dir = view.sort?.field === f.key ? view.sort.dir : undefined;
                const num = f.kind === "number";
                return (
                  <th
                    key={f.key}
                    scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    className="p-0 whitespace-nowrap"
                  >
                    <button
                      onClick={() => view.toggleSort(f.key)}
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
                    <td className="py-3 pr-0 pl-2 align-top">
                      <Reach lead={lead} />
                    </td>
                    {view.visibleFields.map((f) => (
                      <td
                        key={f.key}
                        className={`px-3 py-3 align-top ${f.kind === "number" ? "text-right" : ""} ${
                          f.key === "name" ? "min-w-[200px]" : f.key === "address" ? "min-w-[220px]" : f.kind === "tags" ? "min-w-[160px]" : ""
                        }`}
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
                      <td colSpan={view.visibleFields.length + (hasActions ? 3 : 2)} className="px-5 pt-1 pb-5 sm:pl-[132px]">
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

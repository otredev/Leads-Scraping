"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/core/lead";
import { buildFields, defaultColumns, type LeadField } from "@/core/fields";
import type { CrmSettings, TableId, TablePrefs } from "@/core/crm";
import { queryLeads, type LeadFilters, type LeadSort } from "@/core/query";

/** Predeterminados de fábrica si el usuario no ha guardado los suyos. */
export function builtinPrefs(table: TableId, fields: LeadField[]): TablePrefs {
  return {
    filters: table === "saved" ? { dnc: "hide" } : {},
    sort: { field: "score", dir: "desc" },
    columns: defaultColumns(fields),
  };
}

/**
 * Estado de una vista de leads: filtros, orden, columnas, página y selección.
 * Se inicializa con los predeterminados guardados del usuario (o los de fábrica).
 * Montar solo cuando `settings` ya está cargado.
 */
export function useLeadView<T extends Lead>(table: TableId, leads: T[], settings: CrmSettings | undefined) {
  const fields = useMemo(() => buildFields(table, settings), [table, settings]);
  const stored = settings?.tables[table];
  const defaults: TablePrefs = useMemo(() => {
    const base = builtinPrefs(table, fields);
    if (!stored) return base;
    const valid = stored.columns.filter((k) => fields.some((f) => f.key === k));
    return { filters: stored.filters, sort: stored.sort, columns: valid.length ? valid : base.columns, widths: stored.widths };
  }, [stored, table, fields]);

  const [filters, setFilters] = useState<LeadFilters>(defaults.filters);
  const [sort, setSort] = useState<LeadSort | undefined>(defaults.sort);
  const [columns, setColumnsState] = useState<string[]>(defaults.columns);
  const [widths, setWidths] = useState<Record<string, number>>(defaults.widths ?? {});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => queryLeads(leads, filters, sort, { lowRating: settings?.lowRating, fields }),
    [leads, filters, sort, settings?.lowRating, fields],
  );

  // La selección solo conserva leads que siguen existiendo.
  const ids = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);
  const selection = useMemo(() => new Set([...selected].filter((id) => ids.has(id))), [selected, ids]);

  const isDefault =
    JSON.stringify(filters) === JSON.stringify(defaults.filters) && JSON.stringify(sort) === JSON.stringify(defaults.sort);

  return {
    table,
    fields,
    defaults,
    filters,
    sort,
    columns,
    visibleFields: columns.map((k) => fields.find((f) => f.key === k)).filter(Boolean) as LeadField[],
    rows,
    page,
    setPage,
    selection,
    isDefault,
    update(patch: Partial<LeadFilters>) {
      setFilters((f) => {
        const next = { ...f, ...patch };
        for (const k of Object.keys(next) as (keyof LeadFilters)[]) {
          if (next[k] === undefined || next[k] === "" || next[k] === false) delete next[k];
        }
        return next;
      });
      setPage(0);
    },
    clearFilters() {
      setFilters({});
      setPage(0);
    },
    resetToDefaults() {
      setFilters(defaults.filters);
      setSort(defaults.sort);
      setPage(0);
    },
    toggleSort(key: string) {
      setSort((s) => (s?.field !== key ? { field: key, dir: "asc" } : s.dir === "asc" ? { field: key, dir: "desc" } : undefined));
    },
    setColumns: setColumnsState,
    widths,
    setWidths,
    /** Preferencias a guardar al cambiar columnas o anchos (sin tocar los filtros predeterminados). */
    layoutPrefs(patch: Partial<Pick<TablePrefs, "columns" | "widths">> = {}): TablePrefs {
      return {
        filters: defaults.filters,
        sort: defaults.sort,
        columns: patch.columns ?? columns,
        widths: patch.widths ?? widths,
      };
    },
    /** Preferencias completas con los filtros actuales (para "Fijar como predeterminados"). */
    currentPrefs(): TablePrefs {
      return { filters, sort, columns, widths };
    },
    toggle(id: string) {
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    },
    selectMany(list: string[], on: boolean) {
      setSelected((s) => {
        const n = new Set(s);
        for (const id of list) {
          if (on) n.add(id);
          else n.delete(id);
        }
        return n;
      });
    },
    clearSelection() {
      setSelected(new Set());
    },
  };
}

export type LeadView = ReturnType<typeof useLeadView>;

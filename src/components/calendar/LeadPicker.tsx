"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { SavedLead } from "@/core/lead";

export type LeadOption = Pick<SavedLead, "id" | "name" | "category" | "address" | "stage">;

/** Buscador de leads guardados para asignar una tarea. */
export function LeadPicker({ leads, value, onChange }: { leads: LeadOption[] | undefined; value?: LeadOption; onChange(lead?: LeadOption): void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = leads ?? [];
    return (s ? list.filter((l) => [l.name, l.category, l.address].some((v) => v?.toLowerCase().includes(s))) : list).slice(0, 8);
  }, [leads, q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {value.name}
          {value.category && <span className="text-muted"> · {value.category}</span>}
        </span>
        <button type="button" className="text-muted hover:text-fg" onClick={() => onChange(undefined)} aria-label="Cambiar lead">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  const listId = "lead-picker-list";
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        className="input pl-9"
        placeholder={leads ? "Busca el lead…" : "Cargando leads…"}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            onChange(matches[active]);
            setQ("");
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Lead de la tarea"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
        >
          {matches.length ? (
            matches.map((l, i) => (
              <li key={l.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm ${i === active ? "bg-surface-2" : "hover:bg-surface-2"}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(l);
                    setQ("");
                  }}
                >
                  <span className="truncate">{l.name}</span>
                  {(l.category || l.address) && (
                    <span className="truncate text-xs text-muted">{[l.category, l.address].filter(Boolean).join(" · ")}</span>
                  )}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-sm text-muted">{leads ? "Sin coincidencias" : "Cargando…"}</li>
          )}
        </ul>
      )}
    </div>
  );
}

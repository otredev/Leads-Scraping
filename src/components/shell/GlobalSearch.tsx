"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CornerDownRight, Search } from "lucide-react";
import { NAV_ITEMS, SECTIONS, pageEntries, searchEntries, type SearchEntry } from "./nav";

/**
 * Buscador universal del menú lateral: páginas, pestañas, secciones de Ajustes
 * y apartados de la Ayuda, por palabras clave. Ctrl/⌘ + K para enfocarlo.
 */
export function GlobalSearch({ help, onNavigate, shortcut = false }: { help: SearchEntry[]; onNavigate?: () => void; shortcut?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const entries = useMemo(() => [...pageEntries(), ...SECTIONS, ...help], [help]);
  const results = useMemo(() => searchEntries(entries, q), [entries, q]);

  // Atajo de teclado (solo en la instancia del menú de escritorio).
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function go(e: SearchEntry) {
    setOpen(false);
    setQ("");
    input.current?.blur();
    onNavigate?.();
    router.push(e.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      if (q) setQ("");
      else input.current?.blur();
      setOpen(false);
    }
  }

  const showPanel = open && q.trim().length > 0;
  const iconFor = (e: SearchEntry) => {
    if (e.kind === "help") return BookOpen;
    if (e.kind === "page") return NAV_ITEMS.find((i) => i.href === e.href)?.Icon ?? CornerDownRight;
    return CornerDownRight;
  };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={input}
        type="text"
        enterKeyHint="go"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
        aria-label="Buscar en la app"
        placeholder="Buscar…"
        className="input h-9 py-1.5 pr-14 pl-9 text-[13.5px]"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {shortcut && !q && (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-surface-2 px-1.5 py-px text-[10.5px] font-medium text-muted lg:block">
          Ctrl K
        </kbd>
      )}
      {showPanel && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          {results.length ? (
            <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((r, i) => {
                const Icon = iconFor(r);
                return (
                  <li
                    key={`${r.href}-${r.title}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${i === active ? "bg-surface-2" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(r);
                    }}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-fg">{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.context}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-3 text-[13px] text-muted">
              Sin resultados para &ldquo;{q}&rdquo;. Prueba con otra palabra (p. ej. <em>IBAN</em>, <em>etiquetas</em>, <em>push</em>).
            </p>
          )}
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export interface HelpIndexEntry {
  slug: string;
  title: string;
  description: string;
  headings: { id: string; text: string }[];
  text: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Buscador de la ayuda: títulos, apartados y texto de todas las guías. */
export function HelpSearch({ index, autoFocus }: { index: HelpIndexEntry[]; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    const out: { href: string; title: string; context: string; score: number }[] = [];
    for (const d of index) {
      const text = norm(d.text);
      if (!words.every((w) => text.includes(w) || norm(d.title).includes(w))) continue;
      const heading = d.headings.find((h) => words.some((w) => norm(h.text).includes(w)));
      const i = text.indexOf(words[0]);
      const snippet = i >= 0 ? d.text.slice(Math.max(0, i - 50), i + 110).trim() : d.description;
      out.push({
        href: `/ayuda/${d.slug}${heading ? `#${heading.id}` : ""}`,
        title: heading ? `${d.title} › ${heading.text}` : d.title,
        context: `${i > 50 ? "…" : ""}${snippet}…`,
        score: (words.some((w) => norm(d.title).includes(w)) ? 2 : 0) + (heading ? 1 : 0),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [q, index]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        className="input pl-9"
        type="search"
        placeholder="Buscar en la ayuda…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar en la ayuda"
        autoFocus={autoFocus}
      />
      {q.trim().length > 1 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          {results.length ? (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {results.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="block px-4 py-2.5 hover:bg-surface-2" onClick={() => setQ("")}>
                    <span className="block text-sm font-medium">{r.title}</span>
                    <span className="line-clamp-2 text-xs text-muted">{r.context}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Sin resultados para &ldquo;{q}&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
}

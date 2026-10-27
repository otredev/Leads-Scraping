import Link from "next/link";
import type { ReactNode } from "react";
import type { Doc } from "@/server/docs";
import { HelpSearch, type HelpIndexEntry } from "./HelpSearch";

export function helpIndex(docs: Doc[]): HelpIndexEntry[] {
  return docs.map((d) => ({ slug: d.slug, title: d.title, description: d.description, headings: d.headings, text: d.text.slice(0, 6000) }));
}

/** Estructura de la ayuda: buscador e índice de guías a la izquierda, contenido en el centro. */
export function HelpLayout({ docs, current, children, aside }: { docs: Doc[]; current?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
      <nav aria-label="Guías" className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-4">
          <HelpSearch index={helpIndex(docs)} />
        </div>
        <ul className="hidden flex-col gap-0.5 lg:flex">
          <li>
            <Link
              href="/ayuda"
              aria-current={!current ? "page" : undefined}
              className={`block rounded-md px-3 py-1.5 text-sm ${!current ? "bg-primary-soft font-medium text-primary" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
            >
              Inicio
            </Link>
          </li>
          {docs.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/ayuda/${d.slug}`}
                aria-current={current === d.slug ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm ${current === d.slug ? "bg-primary-soft font-medium text-primary" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
              >
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
      {aside && <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">{aside}</aside>}
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listDocs } from "@/server/docs";
import { HelpLayout } from "@/components/help/HelpLayout";

export const metadata = { title: "Ayuda · Leads Scraping" };

export default function Page() {
  const docs = listDocs();
  return (
    <>
      <header className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Ayuda</h1>
        <p className="mt-1 max-w-2xl text-muted">Guías de cada parte de la app: desde la primera búsqueda hasta el portal del cliente.</p>
      </header>
      <HelpLayout docs={docs}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((d, i) => (
            <li key={d.slug}>
              <Link href={`/ayuda/${d.slug}`} className="card group flex h-full flex-col gap-1.5 p-5 hover:border-line-strong">
                <span className="text-xs font-medium tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex items-center gap-2 font-semibold">
                  {d.title}
                  <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="text-sm text-fg-2">{d.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </HelpLayout>
    </>
  );
}

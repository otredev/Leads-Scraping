import { AppShell } from "@/components/shell/AppShell";
import { DataProvider } from "@/components/data/DataProvider";
import { listDocs } from "@/server/docs";
import type { SearchEntry } from "@/components/shell/nav";

/** Guías y apartados de la Ayuda para el buscador del menú (se leen al compilar). */
function helpEntries(): SearchEntry[] {
  return listDocs().flatMap((d) => [
    { title: d.title, context: "Ayuda", href: `/ayuda/${d.slug}`, keywords: d.description, kind: "help" as const },
    ...d.headings.map((h) => ({ title: h.text, context: `Ayuda · ${d.title}`, href: `/ayuda/${d.slug}#${h.id}`, keywords: d.title, kind: "help" as const })),
  ]);
}

/** La app (con sesión iniciada): menú lateral, buscador y datos compartidos. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <DataProvider>
      <AppShell help={helpEntries()}>{children}</AppShell>
    </DataProvider>
  );
}

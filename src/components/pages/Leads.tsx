"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lead } from "@/core/lead";
import { useData } from "../data/DataProvider";
import { LeadsTable } from "../LeadsTable";
import { PageHeader, ProgressBar, Skeleton, StatusBadge } from "../ui";

export function Leads() {
  const { modules, searches, loading: dataLoading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("search") || "all";

  const [result, setResult] = useState<{ key: string; leads: Lead[] }>();

  const current = searches.find((s) => s.id === selected);
  const count =
    selected === "all" ? searches.reduce((n, s) => n + s.leadCount, 0) : (current?.leadCount ?? 0);

  // Recarga al cambiar de búsqueda o cuando llegan leads nuevos.
  useEffect(() => {
    let cancelled = false;
    const q = selected === "all" ? "" : `?searchId=${encodeURIComponent(selected)}`;
    fetch(`/api/leads${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((leads: Lead[]) => !cancelled && setResult({ key: selected, leads }))
      .catch(() => !cancelled && setResult({ key: selected, leads: [] }));
    return () => {
      cancelled = true;
    };
  }, [selected, count]);

  const loading = result?.key !== selected;
  const leads = loading ? [] : (result?.leads ?? []);
  const active = current && (current.status === "running" || current.status === "queued");

  function select(id: string) {
    router.replace(id === "all" ? pathname : `${pathname}?search=${id}`, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title={
          dataLoading && selected !== "all" ? <Skeleton className="my-1 h-7 w-64 max-w-full" /> : (current?.name ?? "Todos los leads")
        }
        description={
          dataLoading && selected !== "all" ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : current ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge status={current.status} />
              {current.params.queries.length > 1 && <span>{current.params.queries.length} consultas</span>}
            </span>
          ) : (
            "Todas las búsquedas juntas, sin duplicados."
          )
        }
        actions={
          <select className="input w-auto max-w-[280px]" value={selected} onChange={(e) => select(e.target.value)} aria-label="Búsqueda">
            <option value="all">Todas las búsquedas</option>
            {searches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.leadCount})
              </option>
            ))}
          </select>
        }
      />

      {active && (
        <div className="card mb-5 flex flex-col gap-2 px-5 py-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-medium">Extrayendo…</span>
            <span className="text-muted">{current.progress?.message}</span>
          </div>
          <ProgressBar percent={current.progress?.percent} />
        </div>
      )}

      <LeadsTable
        key={selected}
        leads={leads}
        searchId={selected}
        exporters={modules?.exporters ?? []}
        loading={loading}
      />
    </>
  );
}

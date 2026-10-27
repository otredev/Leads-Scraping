"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lead } from "@/core/lead";
import { api, postJson, useData } from "../data/DataProvider";
import { LeadsTable } from "../LeadsTable";
import { Notice, PageHeader, ProgressBar, Skeleton, StatusBadge } from "../ui";

interface SaveResult {
  created: number;
  updated: number;
}

/** Resultados de búsqueda: lo que devuelve el scraper. Desde aquí se guardan en Leads. */
export function Results() {
  const { modules, searches, savedKeys, refreshSaved, loading: dataLoading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("search") || "all";

  const [result, setResult] = useState<{ key: string; leads: Lead[] }>();
  const [notice, setNotice] = useState<{ text: React.ReactNode; tone?: "error" }>();

  const current = searches.find((s) => s.id === selected);
  const count =
    selected === "all" ? searches.reduce((n, s) => n + s.leadCount, 0) : (current?.leadCount ?? 0);

  // Recarga al cambiar de búsqueda o cuando llegan resultados nuevos.
  useEffect(() => {
    let cancelled = false;
    const q = selected === "all" ? "" : `?searchId=${encodeURIComponent(selected)}`;
    api<Lead[]>(`/api/results${q}`)
      .then((leads) => !cancelled && setResult({ key: selected, leads }))
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

  async function save(ids: string[]) {
    try {
      const r = await postJson<SaveResult>("/api/leads", { ids, searchId: selected === "all" ? undefined : selected });
      await refreshSaved();
      const parts = [];
      if (r.created) parts.push(`${r.created} ${r.created === 1 ? "lead guardado" : "leads guardados"}`);
      if (r.updated) parts.push(`${r.updated} ${r.updated === 1 ? "actualizado" : "actualizados"}`);
      setNotice({
        text: (
          <>
            {parts.join(", ") || "Nada nuevo que guardar"}.{" "}
            <Link href="/leads" className="font-medium underline underline-offset-2">
              Ver Leads
            </Link>
          </>
        ),
      });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    }
  }

  return (
    <>
      <PageHeader
        title={
          dataLoading && selected !== "all" ? (
            <Skeleton className="my-1 h-7 w-64 max-w-full" />
          ) : (
            (current?.name ?? "Resultados")
          )
        }
        description={
          dataLoading && selected !== "all" ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : current ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge status={current.status} />
              {current.params.queries.length > 1 && <span>{current.params.queries.length} consultas</span>}
              <span>Guarda los que te interesen para trabajarlos en Leads.</span>
            </span>
          ) : (
            "Todo lo que han devuelto tus búsquedas, sin duplicados. Guarda los que te interesen para trabajarlos en Leads."
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

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Notice>
      )}

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
        mode="results"
        leads={leads}
        searchId={selected}
        exporters={modules?.exporters ?? []}
        loading={loading}
        savedKeys={savedKeys}
        onSave={save}
      />
    </>
  );
}

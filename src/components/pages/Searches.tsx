"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw, Square, Trash2 } from "lucide-react";
import { postJson, useData } from "../data/DataProvider";
import type { Search } from "@/core/search";
import { NewSearchForm } from "../NewSearchForm";
import { Card, EmptyState, Loading, PageHeader, ProgressBar, RowsSkeleton, Skeleton, StatusBadge, timeAgo } from "../ui";

export function Searches() {
  const { modules, searches, loading, refreshSearches, addSearch } = useData();
  const router = useRouter();

  async function cancel(id: string) {
    await fetch(`/api/searches/${id}/cancel`, { method: "POST" });
    await refreshSearches();
  }

  async function rerun(id: string) {
    const s = await postJson<Search>(`/api/searches/${id}/rerun`, {});
    addSearch(s);
    router.push(`/resultados?search=${s.id}`);
  }

  async function remove(id: string, name: string, count: number) {
    if (!window.confirm(`¿Eliminar "${name}" y sus ${count} resultados? Los leads que hayas guardado no se borran.`)) return;
    await fetch(`/api/searches/${id}`, { method: "DELETE" });
    await refreshSearches();
  }

  const providerName = (id: string) => modules?.providers.find((p) => p.id === id)?.name.split(" (")[0] ?? id;

  return (
    <>
      <PageHeader title="Búsquedas" description="Lanza extracciones en Google Maps y sigue su progreso." />

      <div className="grid grid-cols-1 items-start gap-4 lg:gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card title="Nueva búsqueda" className="xl:sticky xl:top-8">
          {modules ? (
            <NewSearchForm
              modules={modules}
              onCreated={(s) => {
                addSearch(s);
                router.push(`/resultados?search=${s.id}`);
              }}
            />
          ) : (
            <Loading label="Cargando proveedores…">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </Loading>
          )}
        </Card>

        <Card
          title="Historial"
          description={loading ? "Cargando…" : `${searches.length} búsquedas guardadas · puedes repetir cualquiera`}
          bodyClassName=""
        >
          {loading ? (
            <Loading label="Cargando búsquedas…">
              <div className="border-t border-line">
                <RowsSkeleton rows={6} cols={5} />
              </div>
            </Loading>
          ) : searches.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="Aún no hay búsquedas">Usa el formulario para lanzar la primera.</EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-left text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">Búsqueda</th>
                    <th className="px-3 py-2.5 font-medium">Proveedor</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium">Resultados</th>
                    <th className="px-3 py-2.5 text-right font-medium">Fecha</th>
                    <th className="px-5 py-2.5">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searches.map((s) => {
                    const active = s.status === "running" || s.status === "queued";
                    return (
                      <tr key={s.id} className="border-b border-line align-top last:border-0 hover:bg-surface-2">
                        <td className="max-w-[320px] px-5 py-3.5">
                          <Link href={`/resultados?search=${s.id}`} className="block truncate font-medium text-fg underline-offset-2 hover:underline" title={s.params.queries.join("\n")}>
                            {s.name}
                          </Link>
                          {s.params.refreshLeadIds && (
                            <span className="badge mt-1 border border-line text-muted">Actualización de {s.params.refreshLeadIds.length} leads</span>
                          )}
                          {active && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              <ProgressBar percent={s.progress?.percent} />
                              <span className="text-xs text-muted">{s.progress?.message ?? "Preparando…"}</span>
                            </div>
                          )}
                          {s.status === "failed" && s.error && <p className="mt-1 text-xs text-danger">{s.error}</p>}
                        </td>
                        <td className="px-3 py-3.5 text-fg-2">{providerName(s.providerId)}</td>
                        <td className="px-3 py-3.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums">{s.leadCount}</td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right text-muted">{timeAgo(s.createdAt)}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          {active ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => cancel(s.id)}>
                              <Square className="size-3.5" aria-hidden />
                              Cancelar
                            </button>
                          ) : (
                            <>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => void rerun(s.id)}
                              title="Repetir esta búsqueda con los mismos parámetros"
                              aria-label={`Repetir ${s.name}`}
                            >
                              <RotateCw className="size-4" aria-hidden />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm text-muted hover:text-danger"
                              onClick={() => remove(s.id, s.name, s.leadCount)}
                              aria-label={`Eliminar ${s.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

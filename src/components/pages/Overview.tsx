"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AtSign, Bookmark, Phone, Plus, Search as SearchIcon } from "lucide-react";
import type { LeadStats } from "@/core/stats";
import { useData } from "../data/DataProvider";
import { taskBucket } from "@/core/calendar";
import { TaskRow } from "../tasks/TaskParts";
import { ColorDot } from "../leads/parts";
import { BarList, ColumnChart, MeterRow } from "../charts";
import {
  Card,
  ChartSkeleton,
  EmptyState,
  ListSkeleton,
  Loading,
  PageHeader,
  ProgressBar,
  RowsSkeleton,
  Skeleton,
  StatCard,
  StatCardSkeleton,
  StatusBadge,
  nf,
  pct,
  timeAgo,
} from "../ui";

const dayFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });

interface Funnel {
  stages: { id: string; name: string; color: string; count: number }[];
  total: number;
  contacted: number;
  won?: { name: string; count: number };
}

type Stats = LeadStats & { saved: number; funnel: Funnel };

/** Embudo: leads guardados por etapa, en el orden configurado. */
function FunnelCard({ funnel }: { funnel: Funnel }) {
  const max = Math.max(...funnel.stages.map((s) => s.count), 1);
  return (
    <Card
      title="Embudo de conversión"
      description="Leads guardados por etapa"
      actions={
        <Link href="/leads" className="btn btn-ghost btn-sm">
          Ver leads
        </Link>
      }
    >
      {funnel.total === 0 ? (
        <p className="hint">Guarda leads desde Resultados para ver el embudo.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3">
            {funnel.stages.map((st) => (
              <li key={st.id} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 text-[13px]">
                <span className="flex items-center gap-2 truncate text-fg-2">
                  <ColorDot color={st.color} /> {st.name}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 rounded-r-[4px] bg-chart" style={{ width: `${Math.max((st.count / max) * 100, 1.5)}%`, maxWidth: "calc(100% - 5.5rem)" }} />
                  <span className="whitespace-nowrap tabular-nums text-fg-2">
                    {st.count} <span className="text-muted">· {pct(st.count, funnel.total)}%</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div>
              <p className="text-2xl font-semibold">{pct(funnel.contacted, funnel.total)}%</p>
              <p className="text-xs text-muted">contactados ({funnel.contacted} de {funnel.total})</p>
            </div>
            {funnel.won && (
              <div>
                <p className="text-2xl font-semibold">{pct(funnel.won.count, funnel.total)}%</p>
                <p className="text-xs text-muted">
                  en &ldquo;{funnel.won.name}&rdquo; ({funnel.won.count}), la última etapa
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Tareas vencidas y de hoy. */
function TodayTasks() {
  const { tasks } = useData();
  const list = tasks.filter((t) => ["overdue", "today"].includes(taskBucket(t)));
  return (
    <Card
      title="Tareas para hoy"
      description={list.length ? `${list.length} pendientes, incluidas las vencidas` : "Nada pendiente"}
      actions={
        <Link href="/tareas" className="btn btn-ghost btn-sm">
          Ver agenda
        </Link>
      }
    >
      {list.length ? (
        <ul className="-mx-1 divide-y divide-line">
          {list.slice(0, 6).map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <p className="hint">Crea tareas desde la ficha de un lead: &ldquo;llamar mañana a las 10&rdquo;.</p>
      )}
    </Card>
  );
}

export function Overview() {
  const { searches, loading } = useData();
  const [stats, setStats] = useState<Stats>();

  // Recalcula cuando cambia el número de leads guardados.
  const leadSum = searches.reduce((n, s) => n + s.leadCount, 0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Stats) => !cancelled && s && typeof s.total === "number" && setStats(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [leadSum]);

  const active = searches.filter((s) => s.status === "running" || s.status === "queued");
  const newSearch = (
    <Link href="/busquedas" className="btn btn-primary">
      <Plus className="size-4" aria-hidden />
      Nueva búsqueda
    </Link>
  );

  if (stats && stats.total === 0 && searches.length === 0) {
    return (
      <>
        <PageHeader title="Panel" description="Resumen de tus leads y búsquedas." />
        <EmptyState title="Aún no has buscado nada" action={newSearch}>
          Lanza tu primera búsqueda en Google Maps, por ejemplo &ldquo;clínicas dentales en Valencia&rdquo;. Los resultados
          aparecerán aquí con sus métricas.
        </EmptyState>
      </>
    );
  }

  if (!stats || loading) {
    return (
      <>
        <PageHeader title="Panel" description="Resumen de tus leads y búsquedas." actions={newSearch} />
        <OverviewSkeleton />
      </>
    );
  }

  const s = stats;
  return (
    <>
      <PageHeader title="Panel" description="Resumen de tus leads y búsquedas." actions={newSearch} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
        <StatCard
          hero
          label="Negocios encontrados"
          value={s ? nf.format(s.total) : "—"}
          icon={<SearchIcon className="size-4" />}
          detail={`En ${searches.length} búsquedas, sin duplicados`}
        />
        <StatCard
          label="Leads guardados"
          value={s ? nf.format(s.saved) : "—"}
          icon={<Bookmark className="size-4" />}
          meter={s ? pct(s.saved, s.total) : 0}
          detail={s ? `${pct(s.saved, s.total)}% de lo encontrado` : undefined}
        />
        <StatCard
          label="Con email"
          value={s ? `${pct(s.withEmail, s.total)}%` : "—"}
          icon={<AtSign className="size-4" />}
          meter={s ? pct(s.withEmail, s.total) : 0}
          detail={s ? `${nf.format(s.withEmail)} negocios` : undefined}
        />
        <StatCard
          label="Con teléfono"
          value={s ? `${pct(s.withPhone, s.total)}%` : "—"}
          icon={<Phone className="size-4" />}
          meter={s ? pct(s.withPhone, s.total) : 0}
          detail={s ? `${nf.format(s.withPhone)} negocios` : undefined}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <FunnelCard funnel={s.funnel} />
        <TodayTasks />
      </div>

      {active.length > 0 && (
        <Card className="mt-5" title="En curso" description="Se actualiza sola mientras extrae." bodyClassName="px-5 pb-4">
          <ul className="flex flex-col gap-4">
            {active.map((a) => (
              <li key={a.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted">{a.progress?.message ?? "Preparando…"}</span>
                </div>
                <ProgressBar percent={a.progress?.percent} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Negocios extraídos" description="Últimos 14 días">
          {s ? (
            <ColumnChart
              caption="Negocios extraídos por día"
              labelEvery={4}
              data={s.byDay.map((d) => {
                const label = dayFmt.format(new Date(d.date));
                return { label, value: d.value, tip: `${label} · ${d.value} leads` };
              })}
            />
          ) : (
            <div className="h-[220px]" />
          )}
        </Card>
        <Card title="Datos de contacto" description="Qué parte de lo encontrado puedes contactar">
          {s && (
            <div className="flex flex-col gap-5 pt-1">
              <MeterRow label="Email" value={s.withEmail} total={s.total} />
              <MeterRow label="Teléfono" value={s.withPhone} total={s.total} />
              <MeterRow label="Web" value={s.withWebsite} total={s.total} />
              <p className="hint">Los emails se obtienen visitando la web de cada negocio.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card title="Categorías" description="Tipos de negocio más frecuentes">
          {s && s.byCategory.length > 0 ? <BarList caption="Leads por categoría" data={s.byCategory} /> : <p className="hint">Sin datos.</p>}
        </Card>
        <Card
          title="Valoraciones"
          description={
            s?.avgRating !== undefined
              ? `Media ${s.avgRating.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de 5 · negocios por rango de estrellas`
              : "Negocios por rango de estrellas"
          }
        >
          {s && <ColumnChart caption="Leads por rango de valoración" height={170} data={s.ratingBuckets.map((b) => ({ ...b, tip: `${b.label} ★ · ${b.value} leads` }))} />}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Búsquedas recientes"
          actions={
            <Link href="/busquedas" className="btn btn-ghost btn-sm">
              Ver todas
            </Link>
          }
          bodyClassName=""
        >
          {searches.length === 0 ? (
            <p className="hint px-5 pb-5">Todavía no hay búsquedas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-left text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">Búsqueda</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                    <th className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {searches.slice(0, 6).map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="max-w-[260px] px-5 py-3">
                        <Link href={`/resultados?search=${r.id}`} className="block truncate font-medium text-fg underline-offset-2 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.leadCount}</td>
                      <td className="hidden whitespace-nowrap px-5 py-3 text-right text-muted sm:table-cell">{timeAgo(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card
          className="xl:col-span-2"
          title="Mejor valorados"
          description="Valoración ponderada por nº de reseñas"
          bodyClassName="px-2 pb-3"
        >
          {s && s.top.length > 0 ? (
            <ul>
              {s.top.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/resultados?search=${l.searchId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.name}</span>
                      <span className="block truncate text-xs text-muted">{l.category ?? "Sin categoría"}</span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="font-semibold">{l.rating?.toLocaleString("es")}</span>
                      <span className="block text-xs text-muted">{l.reviewCount ?? 0} reseñas</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint px-3">Sin valoraciones todavía.</p>
          )}
        </Card>
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted">
        <SearchIcon className="size-3.5" aria-hidden />
        Las métricas cuentan cada negocio una sola vez aunque aparezca en varias búsquedas.
      </p>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <Loading label="Cargando el panel…">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card title="Embudo de conversión" description="Leads guardados por etapa">
          <div className="flex flex-col gap-3.5">
            {[80, 60, 35, 15].map((w) => (
              <div key={w} className="grid grid-cols-[8.5rem_1fr] items-center gap-3">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Tareas para hoy">
          <ListSkeleton rows={4} />
        </Card>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Negocios extraídos" description="Últimos 14 días">
          <ChartSkeleton height={220} />
        </Card>
        <Card title="Datos de contacto" description="Qué parte de lo encontrado puedes contactar">
          <div className="flex flex-col gap-6 pt-1">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card title="Categorías" description="Tipos de negocio más frecuentes">
          <div className="flex flex-col gap-3.5">
            {[90, 75, 60, 45, 30, 20].map((w) => (
              <div key={w} className="grid grid-cols-[8.5rem_1fr] items-center gap-3">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Valoraciones" description="Cuántos leads hay en cada rango de estrellas">
          <ChartSkeleton height={170} bars={5} />
        </Card>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Búsquedas recientes" bodyClassName="">
          <RowsSkeleton rows={5} cols={4} />
        </Card>
        <Card className="xl:col-span-2" title="Mejor valorados" description="Valoración ponderada por nº de reseñas">
          <ListSkeleton rows={5} />
        </Card>
      </div>
    </Loading>
  );
}

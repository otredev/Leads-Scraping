"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Briefcase, CalendarClock, Plus, Search, Users, Wallet } from "lucide-react";
import { formatMoney, type Client } from "@/core/clients";
import { api } from "../data/DataProvider";
import { ClientForm } from "../clients/ClientForm";
import { Card, EmptyState, Loading, Notice, PageHeader, RowsSkeleton, StatCard, StatCardSkeleton } from "../ui";

export interface ClientRow extends Client {
  projects: number;
  openProjects: number;
  progress?: number;
  nextDelivery?: { date: string; label: string };
  overdue: boolean;
  pending: { currency: string; amount: number }[];
  pendingTasks: number;
}

interface Overview {
  clients: ClientRow[];
  stats: { active: number; openProjects: number; dueThisWeek: number; overdue: number; pending: { currency: string; amount: number }[] };
  defaultCurrency: string;
}

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const fmtDay = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`));
const money = (list: { currency: string; amount: number }[], fallback: string) =>
  list.length ? list.map((x) => formatMoney(x.amount, x.currency)).join(" + ") : formatMoney(0, fallback);

/** Clientes: lista con el estado de sus proyectos, entregas y cobros. */
export function Clients() {
  const router = useRouter();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () =>
      api<Overview>("/api/clients")
        .then(setData)
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.clients ?? [])
      .filter((c) => Boolean(c.archived) === archived)
      .filter((c) => !s || [c.name, c.contactName, c.email, c.phone].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => Number(b.openProjects > 0) - Number(a.openProjects > 0) || (a.nextDelivery?.date ?? "9").localeCompare(b.nextDelivery?.date ?? "9"));
  }, [data, q, archived]);
  const archivedCount = data?.clients.filter((c) => c.archived).length ?? 0;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Tus clientes, sus proyectos, entregas y cobros."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Nuevo cliente
          </button>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data ? (
          <>
            <StatCard label="Clientes activos" value={data.stats.active} detail={`${data.stats.openProjects} proyectos abiertos`} icon={<Users className="size-4" />} />
            <StatCard label="Entregas esta semana" value={data.stats.dueThisWeek} detail="Próximos 7 días" icon={<CalendarClock className="size-4" />} />
            <StatCard
              label="Con retraso"
              value={data.stats.overdue}
              detail={data.stats.overdue ? "Entregas o hitos vencidos" : "Todo al día"}
              icon={<AlertTriangle className="size-4" />}
            />
            <StatCard label="Pendiente de cobro" value={money(data.stats.pending, data.defaultCurrency)} detail="Presupuesto menos pagos" icon={<Wallet className="size-4" />} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        )}
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className="input pl-9" placeholder="Buscar cliente, contacto, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" />
          </div>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" className="size-4 accent-primary" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
              Archivados ({archivedCount})
            </label>
          )}
        </div>

        {!data ? (
          <Loading label="Cargando clientes…">
            <div className="p-5">
              <RowsSkeleton rows={5} cols={4} />
            </div>
          </Loading>
        ) : data.clients.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Aún no tienes clientes"
              action={
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden /> Nuevo cliente
                </button>
              }
            >
              Crea uno a mano o convierte un lead desde su ficha (&ldquo;Convertir en cliente&rdquo;). Después añade sus proyectos con hitos, tareas,
              presupuesto y horas.
            </EmptyState>
          </div>
        ) : rows.length === 0 ? (
          <p className="hint p-5">Ningún cliente coincide con la búsqueda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-surface-2 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{[c.contactName, c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[13px]">
                    <Briefcase className="size-3.5 text-muted" aria-hidden />
                    {c.openProjects ? `${c.openProjects} ${c.openProjects === 1 ? "proyecto" : "proyectos"} en marcha` : c.projects ? "Sin proyectos abiertos" : "Sin proyectos"}
                    {c.progress !== undefined && (
                      <span className="ml-auto flex items-center gap-1.5 md:ml-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-primary-track" aria-hidden>
                          <span className="block h-full rounded-full bg-chart" style={{ width: `${c.progress}%` }} />
                        </span>
                        <span className="tabular-nums text-xs text-muted">{c.progress}%</span>
                      </span>
                    )}
                  </span>
                  <span className={`min-w-0 truncate text-[13px] ${c.overdue ? "text-danger" : "text-fg-2"}`}>
                    {c.nextDelivery ? (
                      <>
                        {c.overdue ? "Vencido · " : ""}
                        {fmtDay(c.nextDelivery.date)} · {c.nextDelivery.label}
                      </>
                    ) : (
                      <span className="text-muted">Sin entregas programadas</span>
                    )}
                  </span>
                  <span className="text-[13px] tabular-nums md:text-right">
                    {c.pending.length ? (
                      <span title="Pendiente de cobro">{money(c.pending, data.defaultCurrency)}</span>
                    ) : (
                      <span className="text-muted">Al día</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creating && (
        <ClientForm
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false);
            router.push(`/clientes/${c.id}`);
          }}
        />
      )}
    </>
  );
}

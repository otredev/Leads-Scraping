"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Repeat, Search } from "lucide-react";
import { formatMinutes, formatMoney } from "@/core/clients";
import { categoryLabel, monthlyAmount, occurrences, typeLabel, type ExpenseView, type FinanceReport, type SegmentRow } from "@/core/finance";
import { BarList } from "../charts";
import { Card, EmptyState } from "../ui";
import { PnlChart, costsOf, monthLabel } from "./PnlChart";
import { insights } from "./insights";

/* Pestañas de la página Finanzas. Todas reciben el informe del periodo. */

export const useMoney = (currency: string) => (n: number | undefined, decimals = false) =>
  n === undefined ? "—" : formatMoney(decimals ? Math.round(n * 100) / 100 : Math.round(n), currency);

const pctText = (n?: number) => (n === undefined ? "—" : `${n.toLocaleString("es")} %`);
const tone = (n: number) => (n < 0 ? "text-danger" : "");
const dayFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T12:00:00`));

/** Tabla con cabecera fija a la izquierda y desplazamiento horizontal en pantallas pequeñas. */
function Table({ head, children, caption }: { head: { label: string; right?: boolean }[]; children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h.label} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap first:pl-5 last:pr-5 ${h.right ? "text-right" : ""}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}
const td = "px-3 py-2.5 first:pl-5 last:pr-5 whitespace-nowrap";
const tdr = `${td} text-right`;

// ── Resumen ──

export function SummaryTab({ report: r }: { report: FinanceReport }) {
  const money = useMoney(r.currency);
  const tips = useMemo(() => insights(r), [r]);
  const months = r.months.length > 36 ? r.months.slice(-36) : r.months;
  const expensesTotal = r.totals.direct + r.totals.overhead + r.totals.acquisition;
  const Icon = { good: CheckCircle2, warn: AlertTriangle, info: Info };

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card title="Ingresos y gastos por mes" description="Pasa el ratón por un mes para ver el beneficio">
        {r.totals.revenue || costsOf(r.totals) ? <PnlChart months={months} currency={r.currency} /> : <p className="hint">Sin movimientos en este periodo.</p>}
      </Card>

      <div className="flex flex-col gap-5">
        <Card title="Recomendaciones" description="Qué funciona y qué revisar">
          {tips.length ? (
            <ul className="flex flex-col gap-3 text-[13.5px]">
              {tips.map((t) => {
                const I = Icon[t.tone];
                return (
                  <li key={t.text} className="flex gap-2.5">
                    <I className={`mt-0.5 size-4 ${t.tone === "warn" ? "text-warning" : t.tone === "good" ? "text-success" : "text-muted"}`} aria-hidden />
                    <span className="text-fg-2">{t.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hint">Registra pagos en tus proyectos y tus gastos para ver recomendaciones.</p>
          )}
        </Card>

        <Card title="Gastos por categoría" description={`${money(expensesTotal)} en el periodo, sin contar tus horas`}>
          {r.byCategory.length ? (
            <BarList
              unit={r.currency}
              caption="Gastos por categoría"
              data={r.byCategory.map((c) => ({ label: categoryLabel(c.category), value: Math.round(c.amount), tip: `${categoryLabel(c.category)}: ${money(c.amount)}` }))}
            />
          ) : (
            <p className="hint">Sin gastos en este periodo.</p>
          )}
        </Card>
      </div>

      <Card title="Cuenta de resultados" description="Por mes, en el periodo elegido" bodyClassName="pb-2" className="xl:col-span-2">
        <Table
          caption="Cuenta de resultados por mes"
          head={[
            { label: "Mes" },
            { label: "Ingresos", right: true },
            { label: "Directos", right: true },
            { label: "Generales", right: true },
            { label: "Captación", right: true },
            { label: "Tus horas", right: true },
            { label: "Beneficio", right: true },
            { label: "Margen", right: true },
          ]}
        >
          {[...months].reverse().map((m) => (
            <tr key={m.month}>
              <td className={td}>{monthLabel(m.month, true)}</td>
              <td className={tdr}>{money(m.revenue)}</td>
              <td className={tdr}>{money(m.direct)}</td>
              <td className={tdr}>{money(m.overhead)}</td>
              <td className={tdr}>{money(m.acquisition)}</td>
              <td className={tdr}>{money(m.timeCost)}</td>
              <td className={`${tdr} font-semibold ${tone(m.net)}`}>{money(m.net)}</td>
              <td className={`${tdr} text-muted`}>{pctText(m.margin)}</td>
            </tr>
          ))}
          <tr className="bg-surface-2 font-semibold">
            <td className={td}>Total</td>
            <td className={tdr}>{money(r.totals.revenue)}</td>
            <td className={tdr}>{money(r.totals.direct)}</td>
            <td className={tdr}>{money(r.totals.overhead)}</td>
            <td className={tdr}>{money(r.totals.acquisition)}</td>
            <td className={tdr}>{money(r.totals.timeCost)}</td>
            <td className={`${tdr} ${tone(r.totals.net)}`}>{money(r.totals.net)}</td>
            <td className={tdr}>{pctText(r.totals.margin)}</td>
          </tr>
        </Table>
      </Card>

    </div>
  );
}

// ── Clientes ──

type ClientSort = "net" | "revenue" | "margin" | "perHour";

export function ClientsTab({ report: r }: { report: FinanceReport }) {
  const money = useMoney(r.currency);
  const [sort, setSort] = useState<ClientSort>("net");
  const [all, setAll] = useState(false);
  const rows = useMemo(
    () =>
      r.clients
        .filter((c) => all || c.revenue || c.direct || c.timeCost || c.minutes)
        .sort((a, b) => ((b[sort] ?? -Infinity) as number) - ((a[sort] ?? -Infinity) as number)),
    [r, sort, all],
  );

  return (
    <Card
      title="Rentabilidad por cliente"
      description="Beneficio neto = ingresos − gastos directos − tus horas − su parte de los gastos generales y de captación"
      bodyClassName="pb-2"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-fg-2">
            <input type="checkbox" className="size-4 accent-primary" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Sin actividad
          </label>
          <select className="input w-auto py-1.5 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as ClientSort)} aria-label="Ordenar por">
            <option value="net">Más beneficio</option>
            <option value="revenue">Más ingresos</option>
            <option value="margin">Más margen</option>
            <option value="perHour">Más € por hora</option>
          </select>
        </div>
      }
    >
      {rows.length ? (
        <Table
          caption="Rentabilidad por cliente"
          head={[
            { label: "Cliente" },
            { label: "Ingresos", right: true },
            { label: "Directos", right: true },
            { label: "Tus horas", right: true },
            { label: "Generales", right: true },
            { label: "Captación", right: true },
            { label: "Beneficio neto", right: true },
            { label: "Margen", right: true },
            { label: "€ por hora", right: true },
          ]}
        >
          {rows.map((c) => (
            <tr key={c.clientId} className="hover:bg-surface-2">
              <td className={`${td} max-w-56`}>
                <Link href={`/clientes/${c.clientId}`} className="block truncate font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="block truncate text-xs text-muted">{[c.channel, c.category].filter(Boolean).join(" · ")}</span>
              </td>
              <td className={tdr}>{money(c.revenue)}</td>
              <td className={tdr}>{money(c.direct)}</td>
              <td className={tdr} title={c.minutes ? formatMinutes(c.minutes) : undefined}>
                {money(c.timeCost)}
                {c.minutes > 0 && <span className="block text-xs text-muted">{formatMinutes(c.minutes)}</span>}
              </td>
              <td className={tdr}>{money(c.overheadShare)}</td>
              <td className={tdr}>{money(c.acquisitionShare)}</td>
              <td className={`${tdr} font-semibold ${tone(c.net)}`}>{money(c.net)}</td>
              <td className={`${tdr} text-muted`}>{pctText(c.margin)}</td>
              <td className={`${tdr} ${r.hourlyCost && c.perHour !== undefined && c.perHour < r.hourlyCost ? "text-danger" : ""}`}>
                {c.perHour !== undefined ? money(c.perHour) : "—"}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="pb-3">
          <EmptyState title="Sin actividad en este periodo">Registra pagos y horas en los proyectos de tus clientes para ver su rentabilidad.</EmptyState>
        </div>
      )}
      {(r.unallocated.overhead > 0 || r.unallocated.acquisition > 0) && (
        <p className="hint px-5 pt-2 pb-3">
          Sin repartir: {money(r.unallocated.overhead + r.unallocated.acquisition)} (gastos de un periodo sin ingresos o de canales cuyos clientes no han pagado). Sí
          cuentan en el beneficio total.
        </p>
      )}
    </Card>
  );
}

// ── Gastos ──

export function ExpensesTab({ report: r, expenses, onEdit }: { report: FinanceReport; expenses: ExpenseView[]; onEdit(e: ExpenseView): void }) {
  const money = useMoney(r.currency);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return expenses
      .map((e) => ({ e, charges: occurrences(e, r.from, r.to).length }))
      .filter(({ e, charges }) => charges > 0 || (e.recurrence && (!e.endDate || e.endDate >= r.from) && e.date <= r.to))
      .filter(({ e }) => !type || e.type === type)
      .filter(({ e }) => !s || [e.concept, e.vendor, e.clientName, e.channel, categoryLabel(e.category)].some((v) => v?.toLowerCase().includes(s)));
  }, [expenses, r, type, q]);
  const total = rows.reduce((sum, { e, charges }) => sum + e.amount * charges, 0);

  return (
    <Card bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input pl-9" placeholder="Buscar gasto, proveedor, cliente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar gastos" />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          <option value="direct">De un cliente</option>
          <option value="overhead">Generales</option>
          <option value="acquisition">Captación</option>
        </select>
        <span className="ml-auto text-sm text-fg-2">
          {rows.length} {rows.length === 1 ? "gasto" : "gastos"} · <strong className="text-fg">{money(total)}</strong> en el periodo
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title={expenses.length ? "Ningún gasto en este periodo" : "Aún no has registrado gastos"}>
            Añade tus suscripciones, colaboradores, anuncios y demás gastos. Los recurrentes se cuentan solos cada mes o cada año.
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ e, charges }) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2 sm:px-5 md:grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="hidden text-[13px] text-muted md:block">{fmtDay(e.date)}</span>
                <span className="col-start-1 row-start-1 min-w-0 md:col-start-auto md:row-start-auto">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{e.concept}</span>
                    {e.recurrence && <Repeat className="size-3.5 shrink-0 text-muted" aria-label="Recurrente" />}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[categoryLabel(e.category), e.vendor, e.recurrence && (e.endDate ? `hasta ${fmtDay(e.endDate)}` : "activo")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs md:col-span-1">
                  <span className="badge bg-surface-2 text-fg-2">{typeLabel(e.type)}</span>
                  {e.clientName && <span className="truncate text-fg-2">{[e.clientName, e.projectName].filter(Boolean).join(" · ")}</span>}
                  {e.channel && <span className="truncate text-fg-2">{e.channel}</span>}
                </span>
                <span className="col-start-2 row-start-1 text-right tabular-nums md:col-start-auto md:row-start-auto">
                  <span className="block font-semibold">{money(e.amount, true)}</span>
                  {e.recurrence && (
                    <span className="block text-xs text-muted">
                      {e.recurrence === "yearly" ? "al año" : "al mes"}
                      {charges > 1 ? ` · ${charges} cargos` : ""}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Inversión ──

const SEGMENTS = [
  { id: "category", label: "Sector" },
  { id: "city", label: "Ciudad" },
  { id: "channel", label: "Canal" },
] as const;

export function InvestmentTab({ report: r }: { report: FinanceReport }) {
  const money = useMoney(r.currency);
  const [by, setBy] = useState<(typeof SEGMENTS)[number]["id"]>("category");
  const segments: SegmentRow[] = r.segments[by];
  const fixed = r.recurring.filter((x) => x.active);
  const fixedTotal = fixed.reduce((s, x) => s + x.monthly, 0);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Retorno por canal de captación" description="Lo que inviertes para conseguir clientes y lo que te devuelven" bodyClassName="pb-2">
        {r.channels.length ? (
          <Table
            caption="Retorno por canal"
            head={[
              { label: "Canal" },
              { label: "Invertido", right: true },
              { label: "Clientes nuevos", right: true },
              { label: "Coste por cliente", right: true },
              { label: "Leads", right: true },
              { label: "Coste por lead", right: true },
              { label: "Ingresos", right: true },
              { label: "Beneficio", right: true },
              { label: "Retorno", right: true },
            ]}
          >
            {r.channels.map((c) => (
              <tr key={c.channel}>
                <td className={`${td} font-medium`}>{c.channel}</td>
                <td className={tdr}>{money(c.spend)}</td>
                <td className={tdr}>{c.newClients}</td>
                <td className={tdr}>{money(c.cac)}</td>
                <td className={tdr}>{c.leads ?? "—"}</td>
                <td className={tdr}>{money(c.costPerLead, true)}</td>
                <td className={tdr}>{money(c.revenue)}</td>
                <td className={`${tdr} ${tone(c.profitBeforeAcquisition - c.spend)}`} title="Beneficio de sus clientes menos lo invertido en el canal">
                  {money(c.profitBeforeAcquisition - c.spend)}
                </td>
                <td className={`${tdr} font-semibold ${c.roi !== undefined ? tone(c.roi) : "text-muted"}`}>{c.roi !== undefined ? pctText(c.roi) : "Sin inversión"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="hint pb-3">Registra gastos de captación con su canal (p. ej. proxies o anuncios) y pon el canal a tus clientes.</p>
        )}
        <p className="hint px-5 pt-2 pb-3">
          Retorno = (beneficio de los clientes del canal antes de captación − inversión) / inversión. Un 200 % significa que cada euro invertido te deja 2 € de
          beneficio. Los leads son los guardados en el periodo.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Rentabilidad por segmento"
          description="Dónde enfocar la búsqueda de clientes"
          actions={
            <div role="radiogroup" aria-label="Agrupar por" className="flex gap-1 rounded-lg border border-line p-0.5">
              {SEGMENTS.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={by === s.id}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${by === s.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
                  onClick={() => setBy(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          }
        >
          {segments.length ? (
            <ul className="divide-y divide-line text-sm">
              {segments.map((s) => (
                <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.key}</span>
                    <span className="block text-xs text-muted">
                      {s.clients} {s.clients === 1 ? "cliente" : "clientes"} · {money(s.revenue)} ingresos · margen {pctText(s.margin)}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className={`block font-semibold ${tone(s.net)}`}>{money(s.net)}</span>
                    <span className="block text-xs text-muted">{money(s.netPerClient)} por cliente</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Sin clientes con actividad en este periodo.</p>
          )}
          <p className="hint mt-3">El sector y la ciudad salen del lead de origen o de la ficha del cliente (puedes cambiarlos al editarlo).</p>
        </Card>

        <Card title="Gastos recurrentes" description={fixed.length ? `${money(fixedTotal)} al mes · ${money(fixedTotal * 12)} al año` : "Suscripciones y cuotas"} bodyClassName="pb-2">
          {r.recurring.length ? (
            <ul className="divide-y divide-line text-sm">
              {r.recurring.map((x) => (
                <li key={x.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 py-2.5 ${x.active ? "" : "opacity-60"}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{x.concept}</span>
                    <span className="block truncate text-xs text-muted">
                      {[categoryLabel(x.category), x.channel, !x.active && "terminado"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{money(x.monthly, true)}/mes</span>
                    <span className="block text-xs text-muted">
                      {[x.perClient !== undefined && `${money(x.perClient, true)} por cliente`, x.shareOfRevenue !== undefined && `${pctText(x.shareOfRevenue)} de ingresos`]
                        .filter(Boolean)
                        .join(" · ") || `${money(monthlyAmount(x) * 12)}/año`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint px-5 pb-3">Marca tus suscripciones como &ldquo;Se repite&rdquo; al añadirlas y verás aquí cuánto pesan cada mes.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

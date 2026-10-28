"use client";

import { formatMoney } from "@/core/clients";
import type { MonthRow } from "@/core/finance";

const monthFmt = new Intl.DateTimeFormat("es", { month: "short" });
const monthLong = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
export const monthLabel = (m: string, long = false) => {
  const s = (long ? monthLong : monthFmt).format(new Date(`${m}-15T12:00:00`)).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export const costsOf = (m: Pick<MonthRow, "direct" | "overhead" | "acquisition" | "timeCost">) => m.direct + m.overhead + m.acquisition + m.timeCost;

/** Ingresos y gastos por mes (dos columnas por mes) con el beneficio en el tooltip. */
export function PnlChart({ months, currency, height = 220 }: { months: MonthRow[]; currency: string; height?: number }) {
  const max = niceMax(Math.max(0, ...months.flatMap((m) => [m.revenue, costsOf(m)])));
  const ticks = [max, max / 2, 0];
  const every = months.length > 18 ? 3 : months.length > 9 ? 2 : 1;
  const money = (n: number) => formatMoney(Math.round(n), currency);

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-fg-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted/50" /> Gastos (incl. tus horas)
        </span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" aria-hidden>
        <div className="relative w-9 text-right text-[11px] text-muted tabular-nums" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {compact.format(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {ticks.map((t, i) => (
            <div key={t} className={`absolute inset-x-0 h-px ${i === ticks.length - 1 ? "bg-line-strong" : "bg-line"}`} style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1">
            {months.map((m) => {
              const costs = costsOf(m);
              return (
                <div key={m.month} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none">
                  <div className="w-full max-w-4 rounded-t-[3px] bg-chart" style={{ height: m.revenue ? `max(${(m.revenue / max) * 100}%, 2px)` : 0 }} />
                  <div className="w-full max-w-4 rounded-t-[3px] bg-muted/50" style={{ height: costs ? `max(${(costs / max) * 100}%, 2px)` : 0 }} />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-fg px-2.5 py-1.5 text-xs whitespace-nowrap text-bg shadow-pop group-hover:block group-focus-visible:block">
                    <p className="font-semibold">{monthLabel(m.month, true)}</p>
                    <p>Ingresos: {money(m.revenue)}</p>
                    <p>Gastos: {money(costs)}</p>
                    <p className="font-semibold">Beneficio: {money(m.net)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div />
        <div className="mt-2 flex gap-1 text-[11px] text-muted">
          {months.map((m, i) => (
            <span key={m.month} className="flex flex-1 justify-center overflow-visible whitespace-nowrap">
              {i % every === 0 ? monthLabel(m.month) : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Ingresos, gastos y beneficio por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Gastos</th>
            <th>Beneficio</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{monthLabel(m.month, true)}</td>
              <td>{money(m.revenue)}</td>
              <td>{money(costsOf(m))}</td>
              <td>{money(m.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

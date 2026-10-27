"use client";

/*
 * Gráficos ligeros en HTML/CSS (sin librerías). Una sola serie por gráfico,
 * en el azul primario; los textos siempre en tokens de texto, nunca en color
 * de dato. Cada gráfico incluye una tabla oculta para lectores de pantalla.
 */

export interface Datum {
  label: string;
  value: number;
  /** Texto del tooltip; por defecto "label: value". */
  tip?: string;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

function SrTable({ caption, data, unit }: { caption: string; data: Datum[]; unit: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Elemento</th>
          <th>{unit}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <td>{d.label}</td>
            <td>{d.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Columnas verticales con eje Y, rejilla y tooltip al pasar el ratón o enfocar. */
export function ColumnChart({
  data,
  caption,
  unit = "Leads",
  height = 200,
  labelEvery = 1,
}: {
  data: Datum[];
  caption: string;
  unit?: string;
  height?: number;
  /** Mostrar 1 de cada N etiquetas del eje X (para series largas). */
  labelEvery?: number;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [max, max / 2, 0];
  return (
    <figure className="m-0">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" aria-hidden>
        <div className="relative w-8 text-right text-[11px] text-muted tabular-nums" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {compact.format(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {ticks.map((t, i) => (
            <div
              key={t}
              className={`absolute inset-x-0 h-px ${i === ticks.length - 1 ? "bg-line-strong" : "bg-line"}`}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {data.map((d) => (
              <div
                key={d.label}
                tabIndex={0}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ height: d.value ? `max(${(d.value / max) * 100}%, 3px)` : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg shadow-pop group-hover:block group-focus-visible:block">
                  {d.tip ?? `${d.label}: ${d.value}`}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div />
        <div className="mt-2 flex gap-0.5 text-[11px] text-muted">
          {data.map((d, i) => (
            <span key={d.label} className="flex flex-1 justify-center overflow-visible whitespace-nowrap">
              {i % labelEvery === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <SrTable caption={caption} data={data} unit={unit} />
    </figure>
  );
}

/** Barras horizontales con etiqueta a la izquierda y valor en la punta. */
export function BarList({ data, caption, unit = "Leads" }: { data: Datum[]; caption: string; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <figure className="m-0">
      <ul className="flex flex-col gap-3" aria-hidden>
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 text-[13px]" title={d.tip ?? `${d.label}: ${d.value}`}>
            <span className="truncate text-fg-2">{d.label}</span>
            <span className="flex items-center gap-2">
              <span
                className="h-3 rounded-r-[4px] bg-chart"
                style={{ width: `${Math.max((d.value / max) * 100, 1.5)}%`, maxWidth: "calc(100% - 3rem)" }}
              />
              <span className="tabular-nums text-fg-2">{d.value}</span>
            </span>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} data={data} unit={unit} />
    </figure>
  );
}

/** Proporción de un total, con pista del mismo azul en un tono más claro. */
export function MeterRow({ label, value, total }: { label: string; value: number; total: number }) {
  const p = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-fg-2">{label}</span>
        <span className="tabular-nums text-muted">
          <span className="font-semibold text-fg">{p}%</span> · {value} de {total}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-primary-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
      >
        <div className="h-full rounded-full bg-chart" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

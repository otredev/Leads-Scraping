import type { CSSProperties, ReactNode } from "react";
import type { SearchStatus } from "@/core/search";

/* Componentes de presentación compartidos por todas las páginas. */

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "px-5 pb-5",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-sub">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  meter,
  hero = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  /** 0–100: barra de proporción bajo el valor. */
  meter?: number;
  hero?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-fg-2">{label}</span>
        {icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className={`font-semibold tracking-tight text-fg ${hero ? "text-[40px] leading-none" : "text-[28px] leading-none"}`}>
        {value}
      </div>
      {meter !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-primary-track" aria-hidden>
          <div className="h-full rounded-full bg-chart" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      )}
      {detail && <p className="text-[13px] text-muted">{detail}</p>}
    </div>
  );
}

const STATUS: Record<SearchStatus, { label: string; cls: string; dot: string }> = {
  queued: { label: "En cola", cls: "bg-primary-soft text-primary", dot: "bg-primary" },
  running: { label: "En curso", cls: "bg-primary-soft text-primary", dot: "bg-primary animate-pulse" },
  completed: { label: "Terminada", cls: "bg-success-soft text-success", dot: "bg-success" },
  failed: { label: "Error", cls: "bg-danger-soft text-danger", dot: "bg-danger" },
  cancelled: { label: "Cancelada", cls: "bg-surface-2 text-muted", dot: "bg-muted" },
};

export function StatusBadge({ status }: { status: SearchStatus }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.cls}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="font-semibold text-fg">{title}</p>
      {children && <div className="max-w-md text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ProgressBar({ percent }: { percent?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-track" aria-hidden>
      <div className="h-full rounded-full bg-chart transition-[width] duration-700" style={{ width: `${percent ?? 4}%` }} />
    </div>
  );
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es");
}

export const nf = new Intl.NumberFormat("es");

export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

/* ─── Skeletons de carga ─────────────────────────────────────────────── */

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden style={style} className={`block animate-pulse rounded-md bg-skeleton ${className}`} />;
}

/** Envoltorio accesible: anuncia "Cargando…" una vez y oculta los bloques. */
export function Loading({ label = "Cargando…", children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function ChartSkeleton({ height = 200, bars = 14 }: { height?: number; bars?: number }) {
  // Alturas fijas (no aleatorias) para que servidor y cliente coincidan.
  const heights = [45, 70, 35, 60, 85, 50, 40, 75, 55, 90, 30, 65, 80, 50];
  return (
    <div className="flex items-end gap-1.5 pl-10" style={{ height }}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="flex h-full flex-1 items-end justify-center">
          <span
            aria-hidden
            className="block w-full max-w-6 animate-pulse rounded-t-[4px] bg-skeleton"
            style={{ height: `${heights[i % heights.length]}%` }}
          />
        </span>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-5/6", "w-2/5"];
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className={c === 0 ? "flex-[2]" : "flex-1"}>
              <Skeleton className={`h-3.5 ${widths[(r + c) % widths.length]}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={`h-3.5 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

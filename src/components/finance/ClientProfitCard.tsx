"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { formatMinutes } from "@/core/clients";
import type { ExpenseView, FinanceReport } from "@/core/finance";
import { api } from "../data/DataProvider";
import { Card, Skeleton } from "../ui";
import { ExpenseForm } from "./ExpenseForm";
import { useMoney } from "./sections";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Rentabilidad de un cliente (desde el principio) y sus gastos directos. */
export function ClientProfitCard({ clientId, projectId, version }: { clientId: string; projectId?: string; version?: unknown }) {
  const [report, setReport] = useState<FinanceReport>();
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [editing, setEditing] = useState<ExpenseView | "new">();

  const load = useCallback(async () => {
    const [r, e] = await Promise.all([
      api<FinanceReport>(`/api/finance?period=all&to=${todayStr()}&clientId=${clientId}`),
      api<ExpenseView[]>(`/api/expenses?clientId=${clientId}`),
    ]).catch(() => [undefined, []] as const);
    setReport(r);
    setExpenses([...e]);
  }, [clientId]);

  // Se recalcula al cambiar los proyectos (pagos u horas nuevas).
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, version]);

  const money = useMoney(report?.currency ?? "EUR");
  const c = report?.clients[0];

  return (
    <Card
      title="Rentabilidad"
      description="Desde el principio, con su parte de gastos generales"
      actions={
        <Link href="/finanzas" className="text-xs text-fg-2 hover:text-fg hover:underline">
          Finanzas
        </Link>
      }
    >
      {!report ? (
        <Skeleton className="h-24 w-full" />
      ) : !c ? (
        <p className="hint">Sin datos.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className={`text-2xl font-semibold tracking-tight ${c.net < 0 ? "text-danger" : ""}`}>{money(c.net)}</p>
            <p className="text-[13px] text-muted">
              Beneficio neto{c.margin !== undefined ? ` · margen ${c.margin.toLocaleString("es")} %` : ""}
              {c.perHour !== undefined ? ` · ${money(c.perHour)}/h` : ""}
            </p>
          </div>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-fg-2">Ingresos</dt>
            <dd className="text-right tabular-nums">{money(c.revenue)}</dd>
            <dt className="text-fg-2">Gastos directos</dt>
            <dd className="text-right tabular-nums">−{money(c.direct)}</dd>
            <dt className="text-fg-2">Tus horas{c.minutes ? ` (${formatMinutes(c.minutes)})` : ""}</dt>
            <dd className="text-right tabular-nums">−{money(c.timeCost)}</dd>
            <dt className="text-fg-2">Generales y captación</dt>
            <dd className="text-right tabular-nums">−{money(c.overheadShare + c.acquisitionShare)}</dd>
          </dl>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium">Gastos del cliente</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing("new")}>
                <Plus className="size-3.5" aria-hidden /> Añadir
              </button>
            </div>
            {expenses.length ? (
              <ul className="divide-y divide-line text-[13px]">
                {expenses.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:text-fg" onClick={() => setEditing(e)}>
                      <span className="min-w-0 truncate text-fg-2">
                        {e.concept}
                        {e.projectName && <span className="text-muted"> · {e.projectName}</span>}
                      </span>
                      <span className="tabular-nums">
                        {money(e.amount, true)}
                        {e.recurrence ? (e.recurrence === "yearly" ? "/año" : "/mes") : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">Colaboradores, licencias o material de este cliente.</p>
            )}
            {expenses.length > 5 && <p className="hint">Y {expenses.length - 5} más en Finanzas → Gastos.</p>}
          </div>
        </div>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? undefined : editing}
          defaults={{ type: "direct", clientId, projectId }}
          currency={report?.currency ?? "EUR"}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
    </Card>
  );
}

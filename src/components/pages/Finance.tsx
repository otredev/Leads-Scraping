"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Plus, Settings2, TrendingUp, Wallet, Receipt } from "lucide-react";
import type { ExpenseView, FinanceReport } from "@/core/finance";
import { api, useData } from "../data/DataProvider";
import { Card, Loading, Notice, PageHeader, RowsSkeleton, StatCard, StatCardSkeleton } from "../ui";
import { ExpenseForm } from "../finance/ExpenseForm";
import { FinanceSettingsDialog } from "../finance/FinanceSettingsDialog";
import { ClientsTab, ExpensesTab, InvestmentTab, SummaryTab, useMoney } from "../finance/sections";

const PERIODS = [
  { id: "month", label: "Este mes" },
  { id: "3m", label: "Últimos 3 meses" },
  { id: "ytd", label: "Este año" },
  { id: "12m", label: "Últimos 12 meses" },
  { id: "lastyear", label: "Año pasado" },
  { id: "all", label: "Todo" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const TABS = [
  { id: "summary", label: "Resumen" },
  { id: "clients", label: "Clientes" },
  { id: "expenses", label: "Gastos" },
  { id: "investment", label: "Inversión" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Consulta de la API para un periodo (se calcula al cargar, con la fecha local). */
function periodQuery(id: PeriodId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const to = ymd(now);
  switch (id) {
    case "month":
      return `from=${ymd(new Date(y, m, 1))}&to=${to}`;
    case "3m":
      return `from=${ymd(new Date(y, m - 2, 1))}&to=${to}`;
    case "ytd":
      return `from=${y}-01-01&to=${to}`;
    case "12m":
      return `from=${ymd(new Date(y, m - 11, 1))}&to=${to}`;
    case "lastyear":
      return `from=${y - 1}-01-01&to=${y - 1}-12-31`;
    case "all":
      return `period=all&to=${to}`;
  }
}

/** Finanzas: gastos, beneficio neto por cliente y retorno de lo que inviertes. */
export function Finance() {
  const { settings } = useData();
  const [period, setPeriod] = useState<PeriodId>("12m");
  const [tab, setTab] = useState<TabId>("summary");
  const [report, setReport] = useState<FinanceReport>();
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<ExpenseView | "new">();
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async (p: PeriodId) => {
    try {
      const [r, e] = await Promise.all([api<FinanceReport>(`/api/finance?${periodQuery(p)}`), api<ExpenseView[]>("/api/expenses")]);
      setReport(r);
      setExpenses(e);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load(period));
  }, [load, period]);

  const currency = report?.currency ?? settings?.finance?.currency ?? "EUR";
  const money = useMoney(currency);
  const t = report?.totals;
  const costs = t ? t.direct + t.overhead + t.acquisition + t.timeCost : 0;
  const perHour = t && t.minutes ? (t.revenue - t.direct) / (t.minutes / 60) : undefined;

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Gastos, beneficio neto por cliente y retorno de lo que inviertes en captar clientes."
        actions={
          <>
            <button className="btn" onClick={() => setShowSettings(true)}>
              <Settings2 className="size-4" aria-hidden /> Ajustes
            </button>
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Añadir gasto
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}
      {report && report.otherCurrencies.length > 0 && (
        <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
          Hay pagos en otras monedas que no se suman: {report.otherCurrencies.map((c) => `${c.amount} ${c.currency}`).join(", ")}. Finanzas usa {currency} (cámbiala en
          Ajustes).
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Secciones" className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${tab === x.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
              onClick={() => setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)} aria-label="Periodo">
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {t ? (
          <>
            <StatCard label="Ingresos" value={money(t.revenue)} detail="Pagos cobrados en el periodo" icon={<Wallet className="size-4" />} />
            <StatCard
              label="Gastos"
              value={money(costs)}
              detail={t.timeCost ? `${money(costs - t.timeCost)} + ${money(t.timeCost)} de tus horas` : "Sin contar tus horas"}
              icon={<Receipt className="size-4" />}
            />
            <StatCard
              label="Beneficio neto"
              value={<span className={t.net < 0 ? "text-danger" : ""}>{money(t.net)}</span>}
              detail={t.margin !== undefined ? `Margen del ${t.margin.toLocaleString("es")} %` : "Sin ingresos en el periodo"}
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="Ganas por hora"
              value={perHour !== undefined ? money(perHour) : "—"}
              detail={
                report.hourlyCost
                  ? `Tu hora cuesta ${money(report.hourlyCost)}`
                  : t.minutes
                    ? "Ingresos menos gastos directos, por hora"
                    : "Registra horas en tus proyectos"
              }
              icon={<Clock className="size-4" />}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        )}
      </div>

      {!report ? (
        <Card>
          <Loading label="Calculando…">
            <div className="pt-5">
              <RowsSkeleton rows={6} cols={5} />
            </div>
          </Loading>
        </Card>
      ) : (
        <div role="tabpanel" aria-label={TABS.find((x) => x.id === tab)?.label}>
          {tab === "summary" && <SummaryTab report={report} />}
          {tab === "clients" && <ClientsTab report={report} />}
          {tab === "expenses" && <ExpensesTab report={report} expenses={expenses} onEdit={setEditing} />}
          {tab === "investment" && <InvestmentTab report={report} />}
        </div>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? undefined : editing}
          currency={currency}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load(period);
          }}
        />
      )}
      {showSettings && (
        <FinanceSettingsDialog
          current={settings?.finance}
          currency={currency}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            void load(period);
          }}
        />
      )}
    </>
  );
}

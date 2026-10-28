import "server-only";
import { randomUUID } from "node:crypto";
import { CURRENCIES } from "@/core/clients";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  RECURRENCES,
  financeReport,
  type Expense,
  type ExpenseView,
  type ExpenseCategory,
  type ExpenseType,
  type FinanceReport,
  type FinanceSettings,
  type Recurrence,
} from "@/core/finance";
import type { CrmSettings } from "@/core/crm";
import { getStore } from "./registry";
import { defaultCurrency } from "./clients";

/**
 * Finanzas: gastos (CRUD), ajustes (coste de tu hora y moneda) e informe de
 * rentabilidad. El cálculo está en src/core/finance.ts.
 */

const bad = (m: string) => Object.assign(new Error(m), { status: 400 });
const notFound = (m: string) => Object.assign(new Error(m), { status: 404 });
const now = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

function day(v: unknown, label = "Fecha"): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${label} no válida (AAAA-MM-DD)`);
  return v;
}

function amount(v: unknown, label = "Importe"): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw bad(`${label} no válido`);
  return Math.round(n * 100) / 100;
}

export async function financeSettings(settings?: CrmSettings): Promise<Required<Pick<FinanceSettings, "currency">> & FinanceSettings> {
  const f = (settings ?? (await getStore().getSettings())).finance ?? {};
  return { ...f, currency: f.currency ?? defaultCurrency() };
}

/** Guarda el coste de tu hora y la moneda de Finanzas. */
export async function saveFinanceSettings(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const settings = await store.getSettings();
  const finance: FinanceSettings = { ...settings.finance };
  if ("hourlyCost" in r) {
    const v = amount(r.hourlyCost, "Coste por hora");
    if (v) finance.hourlyCost = v;
    else delete finance.hourlyCost;
  }
  if ("currency" in r) {
    const c = str(r.currency, 3)?.toUpperCase();
    if (c && !(CURRENCIES as readonly string[]).includes(c)) throw bad("Moneda no admitida");
    if (c) finance.currency = c;
    else delete finance.currency;
  }
  const next: CrmSettings = { ...settings, finance };
  await store.saveSettings(next);
  return next;
}

// ── Gastos ──

/** Valida un gasto completo (al crear, o el actual con los cambios al editar). */
async function validate(r: Record<string, unknown>, current?: Expense): Promise<Expense> {
  const pick = (k: string) => (k in r ? r[k] : current?.[k as keyof Expense]);
  const concept = str(pick("concept"));
  if (!concept) throw bad("Escribe el concepto del gasto");
  const value = amount(pick("amount"));
  if (!value) throw bad("Escribe el importe");
  const type = (pick("type") ?? "overhead") as ExpenseType;
  if (!EXPENSE_TYPES.some((t) => t.id === type)) throw bad("Tipo de gasto no válido");
  const category = (pick("category") || "other") as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.some((c) => c.id === category)) throw bad("Categoría no válida");
  const date = day(pick("date")) ?? today();
  const recurrence = (pick("recurrence") || undefined) as Recurrence | undefined;
  if (recurrence && !RECURRENCES.some((x) => x.id === recurrence)) throw bad("Repetición no válida");
  const endDate = recurrence ? day(pick("endDate"), "Fecha de fin") : undefined;
  if (endDate && endDate < date) throw bad("La fecha de fin no puede ser anterior al primer cargo");

  const e: Expense = {
    id: current?.id ?? randomUUID(),
    date,
    amount: value,
    concept,
    category,
    type,
    createdAt: current?.createdAt ?? now(),
    updatedAt: now(),
  };
  if (type === "direct") {
    const store = getStore();
    const clientId = str(pick("clientId"), 100);
    if (!clientId || !(await store.getClient(clientId))) throw bad("Elige el cliente del gasto");
    e.clientId = clientId;
    const projectId = str(pick("projectId"), 100);
    if (projectId) {
      const project = await store.getProject(projectId);
      if (!project || project.clientId !== clientId) throw bad("El proyecto no es de ese cliente");
      e.projectId = projectId;
    }
  }
  if (type === "acquisition") {
    const channel = str(pick("channel"), 60);
    if (!channel) throw bad("Indica el canal de captación (p. ej. Google Maps o Anuncios)");
    e.channel = channel;
  }
  if (recurrence) e.recurrence = recurrence;
  if (endDate) e.endDate = endDate;
  const vendor = str(pick("vendor"), 120);
  if (vendor) e.vendor = vendor;
  const notes = str(pick("notes"), 2000);
  if (notes) e.notes = notes;
  return e;
}


export async function listExpenses(opts: { clientId?: string } = {}): Promise<ExpenseView[]> {
  const store = getStore();
  const [expenses, clients, projects] = await Promise.all([store.listExpenses(), store.listClients(), store.listProjects()]);
  const cn = new Map(clients.map((c) => [c.id, c.name]));
  const pn = new Map(projects.map((p) => [p.id, p.name]));
  return expenses
    .filter((e) => !opts.clientId || e.clientId === opts.clientId)
    .map((e) => ({
      ...e,
      ...(e.clientId && cn.has(e.clientId) ? { clientName: cn.get(e.clientId) } : {}),
      ...(e.projectId && pn.has(e.projectId) ? { projectName: pn.get(e.projectId) } : {}),
    }));
}

export async function createExpense(raw: unknown) {
  const e = await validate((raw ?? {}) as Record<string, unknown>);
  await getStore().putExpense(e);
  return e;
}

export async function updateExpense(id: string, raw: unknown) {
  const store = getStore();
  const current = await store.getExpense(id);
  if (!current) throw notFound("Gasto no encontrado");
  const e = await validate((raw ?? {}) as Record<string, unknown>, current);
  await store.putExpense(e);
  return e;
}

export async function deleteExpense(id: string) {
  const store = getStore();
  if (!(await store.getExpense(id))) throw notFound("Gasto no encontrado");
  await store.deleteExpense(id);
}

/**
 * Al borrar un cliente o un proyecto, sus gastos no desaparecen (el dinero se
 * gastó): los de un cliente borrado pasan a generales y los de un proyecto
 * borrado se quedan en el cliente.
 */
export async function detachExpenses(target: { clientId?: string; projectId?: string }) {
  const store = getStore();
  for (const e of await store.listExpenses()) {
    if (target.clientId && e.clientId === target.clientId) {
      const next: Expense = { ...e, type: "overhead", notes: [e.notes, "Era de un cliente borrado."].filter(Boolean).join(" "), updatedAt: now() };
      delete next.clientId;
      delete next.projectId;
      await store.putExpense(next);
    } else if (target.projectId && e.projectId === target.projectId) {
      const next: Expense = { ...e, updatedAt: now() };
      delete next.projectId;
      await store.putExpense(next);
    }
  }
}

// ── Informe ──

export type Period = { from: string; to: string };

/** Primer día con datos (pagos, horas o gastos), para el periodo "Todo". */
async function firstDate(): Promise<string> {
  const store = getStore();
  const [projects, expenses] = await Promise.all([store.listProjects(), store.listExpenses()]);
  const dates = [...projects.flatMap((p) => [...p.payments.map((x) => x.date), ...p.time.map((x) => x.date)]), ...expenses.map((e) => e.date)].sort();
  return dates[0] ?? today();
}

/** Periodo a partir de la consulta: ?from=AAAA-MM-DD&to=AAAA-MM-DD, o ?period=all. */
export async function parsePeriod(params: URLSearchParams): Promise<Period> {
  const to = day(params.get("to"), "Fecha final") ?? today();
  const from = params.get("period") === "all" || !params.get("from") ? await firstDate() : day(params.get("from"), "Fecha inicial")!;
  if (from > to) throw bad("La fecha inicial es posterior a la final");
  return { from, to };
}

export async function getFinanceReport(period: Period, opts: { clientId?: string } = {}): Promise<FinanceReport> {
  const store = getStore();
  const [settings, clients, projects, expenses, leads] = await Promise.all([
    store.getSettings(),
    store.listClients(),
    store.listProjects(),
    store.listExpenses(),
    store.listSavedLeads(),
  ]);
  const leadIds = new Set(clients.map((c) => c.leadId).filter(Boolean));
  const leadInfo = Object.fromEntries(leads.filter((l) => leadIds.has(l.id)).map((l) => [l.id, { category: l.category, address: l.address }]));
  const report = financeReport({
    clients,
    projects,
    expenses,
    leadInfo,
    leadsSaved: leads.map((l) => l.savedAt),
    settings: await financeSettings(settings),
    ...period,
  });
  if (!opts.clientId) return report;
  // Vista de un cliente: el reparto se calcula con todos y luego se filtra.
  return { ...report, clients: report.clients.filter((c) => c.clientId === opts.clientId) };
}

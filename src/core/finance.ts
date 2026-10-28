/**
 * Finanzas: gastos y rentabilidad.
 *
 * Ingresos = pagos registrados en los proyectos (criterio de caja: cuentan en
 * la fecha en que se cobran). Gastos de tres tipos:
 *   - direct:      de un cliente o proyecto (colaboradores, licencias…).
 *   - overhead:    generales del negocio; se reparten entre los clientes en
 *                  proporción a lo que paga cada uno en el periodo.
 *   - acquisition: captación (anuncios, herramientas, proxies…), con un canal;
 *                  se reparten entre los clientes de ese canal según lo que pagan.
 * Además, tus horas cuentan como coste (horas × coste de tu hora) salvo en
 * los proyectos marcados para no contarlas (p. ej. a precio cerrado).
 *
 * Todo el cálculo es puro (sin base de datos) para poder probarlo y reutilizarlo
 * en la API, la página y el MCP.
 */
import type { Client, Project } from "./clients";

export const EXPENSE_TYPES = [
  { id: "direct", label: "De un cliente", hint: "Gasto de un cliente o proyecto concreto: colaboradores, licencias, material…" },
  { id: "overhead", label: "General", hint: "Gastos del negocio: software, cuota, gestoría… Se reparten entre los clientes según lo que paga cada uno." },
  { id: "acquisition", label: "Captación", hint: "Para conseguir clientes: anuncios, herramientas, proxies… Se reparten entre los clientes de ese canal." },
] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number]["id"];

export const EXPENSE_CATEGORIES = [
  { id: "software", label: "Software y suscripciones" },
  { id: "hosting", label: "Hosting y dominios" },
  { id: "ads", label: "Publicidad" },
  { id: "freelance", label: "Colaboradores" },
  { id: "equipment", label: "Equipo" },
  { id: "office", label: "Oficina y suministros" },
  { id: "services", label: "Gestoría y servicios" },
  { id: "fees", label: "Comisiones y tasas" },
  { id: "training", label: "Formación" },
  { id: "travel", label: "Desplazamientos" },
  { id: "other", label: "Otros" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];
export const categoryLabel = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const typeLabel = (id: string) => EXPENSE_TYPES.find((t) => t.id === id)?.label ?? id;

/** Canales de captación sugeridos (se puede escribir cualquier otro). */
export const CHANNELS = ["Google Maps", "Referido", "Redes sociales", "Anuncios", "Web", "Email en frío", "Otro"] as const;
/** Canal por defecto de un cliente que viene de un lead (los leads salen de Google Maps). */
export const LEAD_CHANNEL = "Google Maps";
export const NO_CHANNEL = "Sin canal";

export const RECURRENCES = [
  { id: "monthly", label: "Cada mes" },
  { id: "yearly", label: "Cada año" },
] as const;
export type Recurrence = (typeof RECURRENCES)[number]["id"];

export interface Expense {
  id: string;
  /** Fecha (YYYY-MM-DD). En los recurrentes, la del primer cargo. */
  date: string;
  /** Importe sin IVA, en la moneda de Finanzas. */
  amount: number;
  concept: string;
  category: ExpenseCategory;
  type: ExpenseType;
  /** Solo en gastos de un cliente (direct). */
  clientId?: string;
  projectId?: string;
  /** Solo en captación (acquisition). */
  channel?: string;
  recurrence?: Recurrence;
  /** Último cargo de un recurrente (YYYY-MM-DD); sin fecha, sigue activo. */
  endDate?: string;
  vendor?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Gasto con los nombres de su cliente y proyecto (para listarlo). */
export interface ExpenseView extends Expense {
  clientName?: string;
  projectName?: string;
}

export interface FinanceSettings {
  /** Lo que te cuesta una hora de tu trabajo. Sin valor, las horas no cuentan como coste. */
  hourlyCost?: number;
  /** Moneda de Finanzas: los pagos en otras monedas no se suman. */
  currency?: string;
}

// ── Fechas ──

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const monthOf = (date: string) => date.slice(0, 7);

/** Meses "AAAA-MM" entre dos fechas (incluidas). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 600; guard++) {
    const key = `${y}-${pad(m)}`;
    if (key > end) break;
    out.push(key);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Cargos de un gasto entre `from` y `to` (incluidas): uno si es único, varios si es recurrente. */
export function occurrences(e: Pick<Expense, "date" | "recurrence" | "endDate">, from: string, to: string): string[] {
  if (!e.recurrence) return e.date >= from && e.date <= to ? [e.date] : [];
  const last = e.endDate && e.endDate < to ? e.endDate : to;
  const [y0, m0, d0] = e.date.split("-").map(Number);
  const step = e.recurrence === "yearly" ? 12 : 1;
  const out: string[] = [];
  for (let i = 0; i < 1200; i += step) {
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const m = ((m0 - 1 + i) % 12) + 1;
    const date = ymd(y, m, Math.min(d0, daysIn(y, m)));
    if (date > last) break;
    if (date >= from) out.push(date);
  }
  return out;
}

/** Equivalente mensual de un gasto recurrente. */
export const monthlyAmount = (e: Pick<Expense, "amount" | "recurrence">) => (e.recurrence === "yearly" ? e.amount / 12 : e.amount);

/** Ciudad a partir de una dirección ("Calle Mayor 1, 46001 Valencia, España" → "Valencia"). */
export function cityOf(address?: string): string | undefined {
  if (!address) return undefined;
  const postal = address.match(/\b\d{4,5}\s+([^,\d][^,]*)/);
  if (postal) return postal[1].trim();
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const countries = /^(españa|spain|méxico|mexico|colombia|argentina|chile|perú|peru|portugal|france|francia|italia|united states|usa)$/i;
  const rest = parts.filter((p) => !countries.test(p));
  return rest.length > 1 ? rest.at(-1)!.replace(/^\d+\s*/, "") || undefined : undefined;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ── Informe ──

export interface FinanceInput {
  clients: (Pick<Client, "id" | "name" | "leadId" | "address" | "createdAt" | "archived"> & { channel?: string; category?: string })[];
  projects: Pick<Project, "id" | "clientId" | "name" | "currency" | "payments" | "time" | "countHours" | "status">[];
  expenses: Expense[];
  /** Categoría y dirección del lead de origen de cada cliente (para segmentar). */
  leadInfo?: Record<string, { category?: string; address?: string }>;
  /** Fechas de guardado de leads (para coste por lead de Google Maps). */
  leadsSaved?: string[];
  settings: FinanceSettings;
  from: string;
  to: string;
}

export interface Totals {
  revenue: number;
  direct: number;
  overhead: number;
  acquisition: number;
  timeCost: number;
  /** Ingresos − todos los gastos − coste de tus horas. */
  net: number;
  /** % del beneficio sobre ingresos (sin ingresos: undefined). */
  margin?: number;
  minutes: number;
}

export interface ClientProfit extends Totals {
  clientId: string;
  name: string;
  channel: string;
  category?: string;
  city?: string;
  archived?: boolean;
  /** Parte de los gastos generales y de captación que le toca. */
  overheadShare: number;
  acquisitionShare: number;
  /** Lo que ganas por hora trabajada: (ingresos − gastos directos) / horas. */
  perHour?: number;
}

export interface MonthRow extends Totals {
  month: string;
}

export interface ChannelRow {
  channel: string;
  spend: number;
  /** Clientes nuevos del canal en el periodo. */
  newClients: number;
  /** Clientes del canal con ingresos en el periodo. */
  payingClients: number;
  revenue: number;
  /** Beneficio de sus clientes antes de descontar la captación. */
  profitBeforeAcquisition: number;
  /** Retorno por euro invertido: (beneficio antes de captación − inversión) / inversión. */
  roi?: number;
  /** Coste por cliente nuevo. */
  cac?: number;
  /** Solo Google Maps: leads guardados en el periodo y coste por lead. */
  leads?: number;
  costPerLead?: number;
}

export interface SegmentRow {
  key: string;
  clients: number;
  revenue: number;
  net: number;
  margin?: number;
  /** Beneficio medio por cliente. */
  netPerClient: number;
}

export interface RecurringRow {
  id: string;
  concept: string;
  category: string;
  type: ExpenseType;
  channel?: string;
  recurrence: Recurrence;
  amount: number;
  monthly: number;
  yearly: number;
  /** Coste al mes por cliente con ingresos en el periodo. */
  perClient?: number;
  /** % sobre los ingresos medios mensuales del periodo. */
  shareOfRevenue?: number;
  /** Activo hoy (sin fecha de fin o con fin en el futuro). */
  active: boolean;
}

export interface FinanceReport {
  from: string;
  to: string;
  currency: string;
  hourlyCost?: number;
  totals: Totals;
  months: MonthRow[];
  clients: ClientProfit[];
  channels: ChannelRow[];
  segments: { category: SegmentRow[]; city: SegmentRow[]; channel: SegmentRow[] };
  byCategory: { category: string; amount: number }[];
  recurring: RecurringRow[];
  /** Gastos que no se pudieron repartir (no hubo ingresos o ningún cliente del canal pagó). */
  unallocated: { overhead: number; acquisition: number };
  /** Pagos en otras monedas, que no se suman. */
  otherCurrencies: { currency: string; amount: number }[];
}

const empty = (): Totals => ({ revenue: 0, direct: 0, overhead: 0, acquisition: 0, timeCost: 0, net: 0, minutes: 0 });

function finish<T extends Totals>(t: T): T {
  t.net = round(t.revenue - t.direct - t.overhead - t.acquisition - t.timeCost);
  t.margin = t.revenue > 0 ? Math.round((t.net / t.revenue) * 1000) / 10 : undefined;
  for (const k of ["revenue", "direct", "overhead", "acquisition", "timeCost"] as const) t[k] = round(t[k]);
  return t;
}

export function clientChannel(c: { channel?: string; leadId?: string }) {
  return c.channel?.trim() || (c.leadId ? LEAD_CHANNEL : NO_CHANNEL);
}

export function financeReport(input: FinanceInput): FinanceReport {
  const { from, to, settings } = input;
  const currency = settings.currency ?? "EUR";
  const hourly = settings.hourlyCost && settings.hourlyCost > 0 ? settings.hourlyCost : 0;
  const inRange = (d: string) => d >= from && d <= to;
  const months = new Map(monthsBetween(from, to).map((m) => [m, { month: m, ...empty() }]));
  const monthRow = (d: string) => months.get(monthOf(d));

  // Clientes
  const rows = new Map<string, ClientProfit>();
  for (const c of input.clients) {
    const lead = c.leadId ? input.leadInfo?.[c.leadId] : undefined;
    rows.set(c.id, {
      clientId: c.id,
      name: c.name,
      channel: clientChannel(c),
      category: c.category?.trim() || lead?.category,
      city: cityOf(c.address) ?? cityOf(lead?.address),
      ...(c.archived ? { archived: true } : {}),
      ...empty(),
      overheadShare: 0,
      acquisitionShare: 0,
    });
  }

  // Ingresos y horas
  const other = new Map<string, number>();
  for (const p of input.projects) {
    const row = rows.get(p.clientId);
    if (!row) continue;
    for (const pay of p.payments) {
      if (!inRange(pay.date)) continue;
      if ((p.currency || "EUR") !== currency) {
        other.set(p.currency, (other.get(p.currency) ?? 0) + pay.amount);
        continue;
      }
      row.revenue += pay.amount;
      monthRow(pay.date)!.revenue += pay.amount;
    }
    for (const t of p.time) {
      if (!inRange(t.date)) continue;
      row.minutes += t.minutes;
      monthRow(t.date)!.minutes += t.minutes;
      if (hourly && p.countHours !== false) {
        const cost = (t.minutes / 60) * hourly;
        row.timeCost += cost;
        monthRow(t.date)!.timeCost += cost;
      }
    }
  }

  // Gastos
  let overheadTotal = 0;
  const acquisitionByChannel = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const e of input.expenses) {
    for (const d of occurrences(e, from, to)) {
      const m = monthRow(d)!;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      const owner = e.type === "direct" && e.clientId ? rows.get(e.clientId) : undefined;
      if (owner) {
        owner.direct += e.amount;
        m.direct += e.amount;
      } else if (e.type === "acquisition") {
        const ch = e.channel?.trim() || NO_CHANNEL;
        acquisitionByChannel.set(ch, (acquisitionByChannel.get(ch) ?? 0) + e.amount);
        m.acquisition += e.amount;
      } else {
        // General (o de un cliente que ya no existe): se reparte.
        overheadTotal += e.amount;
        m.overhead += e.amount;
      }
    }
  }

  // Reparto de generales por ingresos
  const clientsList = [...rows.values()];
  const revenueTotal = clientsList.reduce((s, r) => s + r.revenue, 0);
  if (revenueTotal > 0) for (const r of clientsList) r.overheadShare = (overheadTotal * r.revenue) / revenueTotal;

  // Reparto de captación por canal (entre los clientes del canal, según ingresos)
  let unallocatedAcq = 0;
  for (const [ch, spend] of acquisitionByChannel) {
    const own = clientsList.filter((r) => r.channel === ch);
    const rev = own.reduce((s, r) => s + r.revenue, 0);
    if (rev > 0) for (const r of own) r.acquisitionShare = (spend * r.revenue) / rev;
    else unallocatedAcq += spend;
  }

  for (const r of clientsList) {
    r.overhead = r.overheadShare;
    r.acquisition = r.acquisitionShare;
    finish(r);
    r.overheadShare = round(r.overheadShare);
    r.acquisitionShare = round(r.acquisitionShare);
    // Sin cobros todavía (proyecto recién empezado) no tiene sentido hablar de € por hora.
    r.perHour = r.minutes > 0 && r.revenue > 0 ? round((r.revenue - r.direct) / (r.minutes / 60)) : undefined;
  }

  const totals = finish(
    clientsList.reduce(
      (t, r) => ({ ...t, revenue: t.revenue + r.revenue, direct: t.direct + r.direct, timeCost: t.timeCost + r.timeCost, minutes: t.minutes + r.minutes }),
      { ...empty(), overhead: overheadTotal, acquisition: [...acquisitionByChannel.values()].reduce((s, v) => s + v, 0) },
    ),
  );
  const monthRows = [...months.values()].map((m) => finish(m));

  // Canales
  const leadsInRange = (input.leadsSaved ?? []).filter((d) => inRange(d.slice(0, 10))).length;
  const channelNames = new Set([...acquisitionByChannel.keys(), ...clientsList.filter((r) => r.revenue > 0).map((r) => r.channel)]);
  const channels: ChannelRow[] = [...channelNames]
    .map((ch) => {
      const own = clientsList.filter((r) => r.channel === ch);
      const spend = round(acquisitionByChannel.get(ch) ?? 0);
      const revenue = round(own.reduce((s, r) => s + r.revenue, 0));
      const profitBeforeAcquisition = round(own.reduce((s, r) => s + r.net + r.acquisitionShare, 0));
      const newClients = input.clients.filter((c) => clientChannel(c) === ch && inRange(c.createdAt.slice(0, 10))).length;
      const row: ChannelRow = {
        channel: ch,
        spend,
        newClients,
        payingClients: own.filter((r) => r.revenue > 0).length,
        revenue,
        profitBeforeAcquisition,
        ...(spend > 0 ? { roi: Math.round(((profitBeforeAcquisition - spend) / spend) * 1000) / 10 } : {}),
        ...(spend > 0 && newClients ? { cac: round(spend / newClients) } : {}),
      };
      if (ch === LEAD_CHANNEL && input.leadsSaved) {
        row.leads = leadsInRange;
        if (spend > 0 && leadsInRange) row.costPerLead = round(spend / leadsInRange);
      }
      return row;
    })
    .sort((a, b) => b.revenue - a.revenue || b.spend - a.spend);

  // Segmentos (solo clientes con actividad en el periodo)
  const active = clientsList.filter((r) => r.revenue || r.direct || r.timeCost);
  const segment = (key: (r: ClientProfit) => string | undefined): SegmentRow[] => {
    const groups = new Map<string, ClientProfit[]>();
    for (const r of active) {
      const k = key(r)?.trim() || "Sin datos";
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups]
      .map(([k, list]) => {
        const revenue = round(list.reduce((s, r) => s + r.revenue, 0));
        const net = round(list.reduce((s, r) => s + r.net, 0));
        return { key: k, clients: list.length, revenue, net, margin: revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : undefined, netPerClient: round(net / list.length) };
      })
      .sort((a, b) => b.net - a.net);
  };

  // Recurrentes
  const today = new Date().toISOString().slice(0, 10);
  const payingClients = clientsList.filter((r) => r.revenue > 0).length;
  const monthsCount = Math.max(1, months.size);
  const avgMonthlyRevenue = totals.revenue / monthsCount;
  const recurring: RecurringRow[] = input.expenses
    .filter((e) => e.recurrence)
    .map((e) => {
      const monthly = round(monthlyAmount(e));
      return {
        id: e.id,
        concept: e.concept,
        category: e.category,
        type: e.type,
        ...(e.channel ? { channel: e.channel } : {}),
        recurrence: e.recurrence!,
        amount: e.amount,
        monthly,
        yearly: round(monthly * 12),
        ...(payingClients && e.type !== "direct" ? { perClient: round(monthly / payingClients) } : {}),
        ...(avgMonthlyRevenue > 0 ? { shareOfRevenue: Math.round((monthly / avgMonthlyRevenue) * 1000) / 10 } : {}),
        active: !e.endDate || e.endDate >= today,
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);

  return {
    from,
    to,
    currency,
    ...(hourly ? { hourlyCost: hourly } : {}),
    totals,
    months: monthRows,
    clients: clientsList.sort((a, b) => b.net - a.net),
    channels,
    segments: { category: segment((r) => r.category), city: segment((r) => r.city), channel: segment((r) => r.channel) },
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount: round(amount) })).sort((a, b) => b.amount - a.amount),
    recurring,
    unallocated: { overhead: revenueTotal > 0 ? 0 : round(overheadTotal), acquisition: round(unallocatedAcq) },
    otherCurrencies: [...other].map(([c, amount]) => ({ currency: c, amount: round(amount) })),
  };
}

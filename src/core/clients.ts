/**
 * Clientes y proyectos (gestión de trabajos para clientes).
 *
 * Un cliente puede venir de un lead (se convierte con un clic y queda
 * enlazado por `leadId`) o crearse a mano. Cada cliente tiene proyectos con
 * hitos (el cronograma), tareas (las de siempre, con `projectId`),
 * presupuesto, pagos y horas.
 *
 * `visibleToClient` en hitos y tareas marca lo que podrá ver el cliente en
 * su portal (fase B).
 */

import type { PortalConsent } from "./messages";

export const PROJECT_STATUSES = [
  { id: "proposal", label: "Propuesta" },
  { id: "active", label: "En curso" },
  { id: "review", label: "En revisión" },
  { id: "delivered", label: "Entregado" },
  { id: "paused", label: "Pausado" },
  { id: "cancelled", label: "Cancelado" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["id"];
/** Estados abiertos, de más a menos "vivo". */
export const OPEN_STATUSES: ProjectStatus[] = ["active", "review", "proposal", "paused"];
export const statusLabel = (id: string) => PROJECT_STATUSES.find((s) => s.id === id)?.label ?? id;

export const CURRENCIES = ["EUR", "USD", "MXN", "COP", "ARS", "CLP", "PEN", "GBP"] as const;

export interface Client {
  id: string;
  name: string;
  /** Persona de contacto. */
  contactName?: string;
  email?: string;
  phone?: string;
  phoneE164?: string;
  website?: string;
  address?: string;
  notes?: string;
  /** Lead del que viene (si se convirtió desde Leads). */
  leadId?: string;
  /** Canal por el que llegó (Google Maps, Referido…). Sin valor: "Google Maps" si viene de un lead. */
  channel?: string;
  /** Sector o tipo de negocio (para Finanzas → segmentos). Sin valor: la categoría del lead. */
  category?: string;
  /** NIF / CIF para las facturas. */
  taxId?: string;
  /** Razón social si es distinta del nombre (para facturas y contratos). */
  legalName?: string;
  /** Aceptaciones de las políticas del portal (historial: una por versión de los textos). */
  consents?: PortalConsent[];
  /** Última vez que el cliente abrió sus mensajes en el portal. */
  messagesSeenAt?: string;
  archived?: boolean;
  /** Portal del cliente (enlace privado). El token solo se guarda aquí; el portal guarda su hash. */
  portal?: ClientPortal;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortal {
  token: string;
  enabledAt: string;
  publishedAt?: string;
  /** Último error al publicar (p. ej. el portal no responde). */
  lastError?: string;
}

export interface Milestone {
  id: string;
  title: string;
  /** Fecha prevista (ISO). */
  dueAt?: string;
  done: boolean;
  doneAt?: string;
  visibleToClient: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  /** Fecha (YYYY-MM-DD). */
  date: string;
  note?: string;
}

export interface TimeEntry {
  id: string;
  /** Fecha (YYYY-MM-DD). */
  date: string;
  minutes: number;
  note?: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  /** Fechas (YYYY-MM-DD). */
  startDate?: string;
  dueDate?: string;
  currency: string;
  budget?: number;
  hourlyRate?: number;
  milestones: Milestone[];
  /** Mostrar presupuesto y pagos en el portal del cliente. */
  showPaymentsToClient?: boolean;
  payments: Payment[];
  time: TimeEntry[];
  /** Contar las horas como coste en Finanzas (por defecto sí; no en proyectos a precio cerrado si así lo prefieres). */
  countHours?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Garantiza las listas (por si el almacenamiento omite arrays vacíos). */
export function normalizeProject(p: Project): Project {
  return { ...p, milestones: p.milestones ?? [], payments: p.payments ?? [], time: p.time ?? [], currency: p.currency || "EUR" };
}

export function projectTotals(p: Pick<Project, "budget" | "payments" | "time" | "hourlyRate">) {
  const paid = p.payments.reduce((s, x) => s + x.amount, 0);
  const minutes = p.time.reduce((s, x) => s + x.minutes, 0);
  return {
    paid,
    pending: p.budget !== undefined ? Math.max(0, p.budget - paid) : undefined,
    minutes,
    /** Coste de las horas al precio/hora (si lo tiene). */
    timeCost: p.hourlyRate ? Math.round((minutes / 60) * p.hourlyRate * 100) / 100 : undefined,
  };
}

/** Avance: hitos hechos / total; si no hay hitos, tareas hechas / total. */
export function projectProgress(p: Pick<Project, "milestones" | "status">, tasks: { done: boolean }[] = []): number {
  if (p.status === "delivered") return 100;
  const items = p.milestones.length ? p.milestones : tasks;
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

/** Próximo hito pendiente con fecha. */
export function nextMilestone(p: Pick<Project, "milestones">): Milestone | undefined {
  return p.milestones.filter((m) => !m.done && m.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))[0];
}

/** "2h 30min" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}

export function formatMoney(amount: number | undefined, currency = "EUR"): string {
  if (amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Portal del cliente: lo que la app publica para cada cliente.
 *
 * La app (local) construye este "snapshot" solo con lo marcado como visible
 * y lo envía al portal (Cloudflare Workers + D1). El portal no tiene acceso a
 * tu CRM: solo guarda y muestra lo último publicado. El mismo tipo lo usa el
 * portal (portal/src), así que cualquier cambio aquí debe ser compatible.
 */

export const PORTAL_SNAPSHOT_VERSION = 1;

export interface PortalBrand {
  /** Tu nombre o el de tu negocio. */
  name: string;
  email?: string;
  phone?: string;
  /** Número en formato internacional solo con dígitos (para wa.me). */
  whatsapp?: string;
  website?: string;
  /** Mensaje de bienvenida en la portada del portal. */
  welcome?: string;
}

export interface PortalItem {
  title: string;
  /** ISO. */
  dueAt?: string;
  done: boolean;
  doneAt?: string;
}

export interface PortalMoney {
  currency: string;
  budget?: number;
  paid: number;
  pending?: number;
  payments: { date: string; amount: number; note?: string }[];
}

export interface PortalProject {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  description?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  dueDate?: string;
  /** 0–100 */
  progress: number;
  milestones: PortalItem[];
  tasks: PortalItem[];
  /** Solo si el proyecto tiene activado "mostrar presupuesto y pagos". */
  money?: PortalMoney;
  updatedAt: string;
}

export interface PortalSnapshot {
  version: typeof PORTAL_SNAPSHOT_VERSION;
  client: { id: string; name: string; contactName?: string };
  brand: PortalBrand;
  projects: PortalProject[];
  /** Zona horaria para mostrar fechas y horas (la de tu app). */
  timeZone: string;
  publishedAt: string;
}

/** Estado del portal de un cliente según el servidor del portal. */
export interface PortalStatus {
  publishedAt?: string;
  lastViewedAt?: string;
  views: number;
}

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

/** Propuesta, contrato o factura visible en el portal (ya enviada o emitida). */
export interface PortalDocument {
  id: string;
  type: "proposal" | "contract" | "invoice";
  /** "Propuesta", "Contrato", "Factura" o "Factura rectificativa". */
  typeLabel: string;
  title: string;
  number?: string;
  status: string;
  statusLabel: string;
  /** AAAA-MM-DD */
  date: string;
  dueDate?: string;
  currency: string;
  /** Texto ya convertido a HTML (sin scripts: el HTML escrito a mano se escapa). */
  html: string;
  lines: { description: string; quantity: number; unitPrice: number; vat: number }[];
  totals: { base: number; vat: { rate: number; base: number; amount: number }[]; irpf: number; total: number };
  irpf?: number;
  notes?: string;
  issuer?: { name: string; tradeName?: string; taxId?: string; address?: string; email?: string; phone?: string };
  customer?: { name: string; tradeName?: string; taxId?: string; address?: string; email?: string; phone?: string };
  rectifies?: { number: string; date: string };
  /** SVG del QR tributario (facturas). */
  qrSvg?: string;
  /** Forma de pago y pie (facturas). */
  footer?: { iban?: string; text?: string };
  /** El cliente puede aceptarlo (propuesta o contrato enviado). Identifica la versión enviada. */
  acceptable?: { sentAt: string; action: string };
  acceptance?: { name: string; at: string };
}

export interface PortalSnapshot {
  version: typeof PORTAL_SNAPSHOT_VERSION;
  client: { id: string; name: string; contactName?: string };
  brand: PortalBrand;
  projects: PortalProject[];
  /** Documentos visibles (opcional: los portales anteriores no lo tienen). */
  documents?: PortalDocument[];
  /** Zona horaria para mostrar fechas y horas (la de tu app). */
  timeZone: string;
  publishedAt: string;
}

/** Datos legales del titular del portal (aviso legal, LSSI art. 10). */
export interface PortalLegal {
  /** Nombre y apellidos o razón social. */
  holder?: string;
  /** NIF / CIF. */
  taxId?: string;
  /** Domicilio. */
  address?: string;
  /** Datos registrales o colegio profesional, si aplica. */
  registry?: string;
}

export const PORTAL_SITE_VERSION = 1;

/**
 * Datos comunes del portal (no de un cliente): tu marca y tus datos legales.
 * Con ellos se generan las páginas /legal/* del portal.
 */
export interface PortalSite {
  version: typeof PORTAL_SITE_VERSION;
  brand: PortalBrand;
  legal: PortalLegal;
  timeZone: string;
  updatedAt: string;
}

/** Estado del portal de un cliente según el servidor del portal. */
export interface PortalStatus {
  publishedAt?: string;
  lastViewedAt?: string;
  views: number;
}

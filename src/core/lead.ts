/**
 * Modelo normalizado de un lead.
 *
 * Todos los proveedores convierten sus datos a esta forma, así el resto de la
 * app (tabla, filtros, exportadores, almacenamiento) no sabe de dónde vienen.
 *
 * Para añadir un campo nuevo:
 *   1. Añádelo aquí (opcional, para no romper proveedores existentes).
 *   2. Añade su definición en `core/fields.ts` (columna + exportación).
 *   3. Rellénalo en el mapper de los proveedores que lo soporten.
 * Mientras tanto, cualquier dato extra puede vivir en `extra`.
 */

export interface Review {
  author?: string;
  rating?: number;
  text?: string;
  /** Fecha tal como la da la fuente ("hace 2 meses", ISO, etc.). */
  date?: string;
}

/** Día de la semana (como lo nombra la fuente) → franjas horarias. */
export type OpeningHours = Record<string, string[]>;

export interface Lead {
  /** Id interno, único en todo el almacenamiento. */
  id: string;
  searchId: string;
  sourceId: string;
  providerId: string;
  /** Id del negocio en la fuente (place_id, cid…). Se usa para deduplicar. */
  externalId?: string;

  name: string;
  category?: string;
  emails: string[];
  /** Teléfono en formato internacional legible (+34 963 00 00 00). */
  phone?: string;
  /** Teléfono en formato E.164 (+34963000000), listo para WhatsApp/llamadas. */
  phoneE164?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  reviews: Review[];
  openingHours?: OpeningHours;
  latitude?: number;
  longitude?: number;
  /** Enlace a la ficha original (p. ej. Google Maps). */
  url?: string;

  /** Datos específicos del proveedor que aún no forman parte del modelo. */
  extra: Record<string, unknown>;
  collectedAt: string;
}

/** Lo que emite un proveedor: el lead sin los metadatos que añade la app. */
export type LeadInput = Omit<
  Lead,
  "id" | "searchId" | "sourceId" | "providerId" | "collectedAt" | "emails" | "reviews" | "extra"
> & {
  emails?: string[];
  reviews?: Review[];
  extra?: Record<string, unknown>;
};

/** Garantiza los campos obligatorios de tipo lista/objeto (por si el almacenamiento los omite). */
export function normalizeLead<T extends Lead>(lead: T): T {
  return { ...lead, emails: lead.emails ?? [], reviews: lead.reviews ?? [], extra: lead.extra ?? {} };
}

/** Quita duplicados (p. ej. el mismo negocio en dos búsquedas), conservando el más reciente. */
export function dedupeLeads(leads: Lead[]): Lead[] {
  const byKey = new Map<string, Lead>();
  for (const lead of leads) {
    const key = leadDedupeKey(lead);
    const prev = byKey.get(key);
    if (!prev || prev.collectedAt < lead.collectedAt) byKey.set(key, lead);
  }
  return [...byKey.values()];
}

/** Clave usada para no guardar el mismo negocio dos veces en una búsqueda. */
export function leadDedupeKey(lead: Pick<Lead, "externalId" | "name" | "address">): string {
  if (lead.externalId) return `id:${lead.externalId}`;
  return `na:${lead.name.trim().toLowerCase()}|${(lead.address ?? "").trim().toLowerCase()}`;
}

/**
 * Lead guardado en tu CRM (separado de los resultados de búsqueda).
 * Se identifica por `key` (la misma clave de deduplicación), así que guardar el
 * mismo negocio desde otra búsqueda actualiza sus datos en lugar de duplicarlo.
 */
export interface SavedLead extends Lead {
  key: string;
  /** Búsquedas de las que se ha guardado. */
  searchIds: string[];
  savedAt: string;
  updatedAt: string;
  /** En la papelera desde esta fecha. */
  deletedAt?: string;
  /** Se eliminará definitivamente en esta fecha. */
  purgeAt?: string;
}

/** Campos de datos que se refrescan al volver a guardar un lead (no los del CRM). */
export const LEAD_DATA_FIELDS = [
  "sourceId", "providerId", "externalId", "name", "category", "emails", "phone", "phoneE164",
  "website", "address", "rating", "reviewCount", "reviews", "openingHours", "latitude",
  "longitude", "url", "extra", "collectedAt",
] as const satisfies readonly (keyof Lead)[];

export function pickLeadData(lead: Lead): Partial<Lead> {
  const out: Record<string, unknown> = {};
  for (const k of LEAD_DATA_FIELDS) if (lead[k] !== undefined) out[k] = lead[k];
  return out as Partial<Lead>;
}

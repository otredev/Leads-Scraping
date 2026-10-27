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
  phone?: string;
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

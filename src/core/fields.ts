import type { Lead } from "./lead";

/**
 * Catálogo de campos de un lead: define columnas de la tabla, ordenación y
 * exportación en un solo sitio. Añadir un campo aquí lo hace aparecer en la
 * tabla y en todos los exportadores.
 */
export interface LeadField {
  key: string;
  label: string;
  kind: "text" | "number" | "url" | "list" | "hours" | "reviews";
  /** Valor para ordenar/filtrar. */
  value(lead: Lead): string | number | undefined;
  /** Texto plano para exportar o mostrar. */
  format(lead: Lead): string;
  /** Mostrar como columna por defecto en la tabla. */
  defaultVisible: boolean;
}

const text = (v: string | undefined) => v ?? "";

export function formatHours(hours: Lead["openingHours"]): string {
  if (!hours) return "";
  return Object.entries(hours)
    .map(([day, ranges]) => `${day}: ${ranges.length ? ranges.join(", ") : "Cerrado"}`)
    .join(" | ");
}

export function formatReviews(reviews: Lead["reviews"]): string {
  return reviews
    .map((r) => {
      const head = [r.author, r.rating !== undefined ? `${r.rating}★` : undefined, r.date]
        .filter(Boolean)
        .join(", ");
      return `[${head}] ${(r.text ?? "").replace(/\s+/g, " ").trim()}`;
    })
    .join(" || ");
}

export const LEAD_FIELDS: LeadField[] = [
  { key: "name", label: "Nombre", kind: "text", value: (l) => l.name, format: (l) => l.name, defaultVisible: true },
  { key: "category", label: "Categoría", kind: "text", value: (l) => l.category, format: (l) => text(l.category), defaultVisible: true },
  {
    key: "emails",
    label: "Email",
    kind: "list",
    value: (l) => l.emails[0],
    format: (l) => l.emails.join(", "),
    defaultVisible: true,
  },
  { key: "phone", label: "Teléfono", kind: "text", value: (l) => l.phone, format: (l) => text(l.phone), defaultVisible: true },
  { key: "website", label: "Web", kind: "url", value: (l) => l.website, format: (l) => text(l.website), defaultVisible: true },
  { key: "address", label: "Dirección", kind: "text", value: (l) => l.address, format: (l) => text(l.address), defaultVisible: true },
  {
    key: "rating",
    label: "Valoración",
    kind: "number",
    value: (l) => l.rating,
    format: (l) => (l.rating !== undefined ? String(l.rating) : ""),
    defaultVisible: true,
  },
  {
    key: "reviewCount",
    label: "Nº reseñas",
    kind: "number",
    value: (l) => l.reviewCount,
    format: (l) => (l.reviewCount !== undefined ? String(l.reviewCount) : ""),
    defaultVisible: true,
  },
  {
    key: "openingHours",
    label: "Horario",
    kind: "hours",
    value: (l) => (l.openingHours ? Object.keys(l.openingHours).length : undefined),
    format: (l) => formatHours(l.openingHours),
    defaultVisible: false,
  },
  {
    key: "reviews",
    label: "Reseñas",
    kind: "reviews",
    value: (l) => l.reviews.length,
    format: (l) => formatReviews(l.reviews),
    defaultVisible: false,
  },
  {
    key: "latitude",
    label: "Latitud",
    kind: "number",
    value: (l) => l.latitude,
    format: (l) => (l.latitude !== undefined ? String(l.latitude) : ""),
    defaultVisible: false,
  },
  {
    key: "longitude",
    label: "Longitud",
    kind: "number",
    value: (l) => l.longitude,
    format: (l) => (l.longitude !== undefined ? String(l.longitude) : ""),
    defaultVisible: false,
  },
  { key: "url", label: "Enlace a la ficha", kind: "url", value: (l) => l.url, format: (l) => text(l.url), defaultVisible: false },
  { key: "sourceId", label: "Fuente", kind: "text", value: (l) => l.sourceId, format: (l) => l.sourceId, defaultVisible: false },
  { key: "providerId", label: "Proveedor", kind: "text", value: (l) => l.providerId, format: (l) => l.providerId, defaultVisible: false },
  { key: "collectedAt", label: "Fecha de extracción", kind: "text", value: (l) => l.collectedAt, format: (l) => l.collectedAt, defaultVisible: false },
];

export function getField(key: string): LeadField | undefined {
  return LEAD_FIELDS.find((f) => f.key === key);
}

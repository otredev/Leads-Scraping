import type { Lead, SavedLead } from "./lead";
import type { CrmSettings, TableId } from "./crm";
import { LABEL_COLORS } from "./crm";
import { AUTO_TAGS, autoTags, leadScore } from "./score";

/**
 * Catálogo de campos de un lead: define columnas de la tabla, ordenación y
 * exportación en un solo sitio. Añadir un campo aquí lo hace aparecer en la
 * tabla y en todos los exportadores.
 */
export interface LeadField {
  key: string;
  label: string;
  kind: "text" | "number" | "url" | "list" | "hours" | "reviews" | "tags";
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
  {
    key: "phoneE164",
    label: "Teléfono (E.164)",
    kind: "text",
    value: (l) => l.phoneE164,
    format: (l) => text(l.phoneE164),
    defaultVisible: false,
  },
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
    key: "score",
    label: "Puntuación",
    kind: "number",
    value: (l) => leadScore(l),
    format: (l) => String(leadScore(l)),
    defaultVisible: true,
  },
  autoTagsField(3.5),
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

function autoTagsField(lowRating: number): LeadField {
  const names = (l: Lead) => autoTags(l, lowRating).map((id) => AUTO_TAGS.find((t) => t.id === id)!.name);
  return {
    key: "autoTags",
    label: "Etiquetas auto",
    kind: "tags",
    value: (l) => names(l).join(", ") || undefined,
    format: (l) => names(l).join(", "),
    defaultVisible: false,
  };
}

const saved = (l: Lead) => l as Partial<SavedLead>;

/** Campos del CRM (solo leads guardados). Necesitan los nombres de etapas y etiquetas. */
function crmFields(settings: CrmSettings): LeadField[] {
  const stageName = (id?: string) => settings.stages.find((s) => s.id === id)?.name ?? id ?? "";
  const stageIndex = (id?: string) => settings.stages.findIndex((s) => s.id === id);
  const tagNames = (l: Lead) =>
    (saved(l).tags ?? []).map((id) => settings.tags.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  return [
    {
      key: "stage",
      label: "Etapa",
      kind: "text",
      value: (l) => (stageIndex(saved(l).stage) >= 0 ? stageIndex(saved(l).stage) : undefined),
      format: (l) => stageName(saved(l).stage),
      defaultVisible: true,
    },
    {
      key: "tags",
      label: "Etiquetas",
      kind: "tags",
      value: (l) => tagNames(l).join(", ") || undefined,
      format: (l) => tagNames(l).join(", "),
      defaultVisible: true,
    },
    {
      key: "color",
      label: "Color",
      kind: "text",
      value: (l) => saved(l).color,
      format: (l) => LABEL_COLORS.find((c) => c.id === saved(l).color)?.name ?? "",
      defaultVisible: false,
    },
    {
      key: "notes",
      label: "Notas",
      kind: "number",
      value: (l) => saved(l).notes?.length || undefined,
      format: (l) => (saved(l).notes ?? []).map((n) => `[${n.createdAt.slice(0, 10)}] ${n.text.replace(/\s+/g, " ")}`).join(" || "),
      defaultVisible: false,
    },
    {
      key: "doNotContact",
      label: "No contactar",
      kind: "text",
      value: (l) => (saved(l).doNotContact ? "Sí" : undefined),
      format: (l) => {
        const d = saved(l).doNotContact;
        return d ? `Sí (${d.at.slice(0, 10)}${d.reason ? `: ${d.reason}` : ""})` : "";
      },
      defaultVisible: false,
    },
    {
      key: "lastContactAt",
      label: "Último contacto",
      kind: "text",
      value: (l) => saved(l).lastContactAt,
      format: (l) => saved(l).lastContactAt ?? "",
      defaultVisible: false,
    },
    {
      key: "pageUrl",
      label: "Página",
      kind: "text",
      value: (l) => saved(l).pageUrl,
      format: (l) => saved(l).pageUrl ?? "",
      defaultVisible: false,
    },
    {
      key: "savedAt",
      label: "Guardado",
      kind: "text",
      value: (l) => saved(l).savedAt,
      format: (l) => saved(l).savedAt ?? "",
      defaultVisible: false,
    },
  ];
}

/**
 * Campos disponibles para una tabla. En "saved" se añaden los del CRM tras el
 * nombre. Si hay ajustes, "Etiquetas auto" usa su umbral de valoración baja.
 */
export function buildFields(table: TableId, settings?: CrmSettings): LeadField[] {
  const base = LEAD_FIELDS.map((f) => (f.key === "autoTags" && settings ? autoTagsField(settings.lowRating) : f));
  if (table !== "saved" || !settings) return base;
  const crm = crmFields(settings);
  const i = base.findIndex((f) => f.key === "category");
  return [...base.slice(0, i), ...crm.slice(0, 2), ...base.slice(i), ...crm.slice(2)];
}

/** Columnas visibles por defecto, en orden. */
export function defaultColumns(fields: LeadField[]): string[] {
  return fields.filter((f) => f.defaultVisible).map((f) => f.key);
}

export function getField(key: string, fields: LeadField[] = LEAD_FIELDS): LeadField | undefined {
  return fields.find((f) => f.key === key);
}

/**
 * Importación de leads desde CSV: detección automática de columnas y
 * conversión de filas. Código puro (el navegador lee el CSV, el servidor guarda).
 */

export const IMPORT_TARGETS = [
  { id: "name", label: "Nombre", synonyms: ["nombre", "name", "title", "titulo", "negocio", "empresa", "business", "company", "razon social"] },
  { id: "category", label: "Categoría", synonyms: ["categoria", "category", "tipo", "type", "sector", "rubro"] },
  { id: "emails", label: "Email", synonyms: ["email", "emails", "correo", "e mail", "mail", "correo electronico"] },
  { id: "phone", label: "Teléfono", synonyms: ["telefono", "phone", "tel", "movil", "celular", "telefono e164", "whatsapp", "phone number"] },
  { id: "website", label: "Web", synonyms: ["web", "website", "sitio web", "pagina web", "url web", "site", "web site"] },
  { id: "address", label: "Dirección", synonyms: ["direccion", "address", "domicilio", "ubicacion", "complete address"] },
  { id: "rating", label: "Valoración", synonyms: ["valoracion", "rating", "review rating", "estrellas", "puntuacion google", "nota"] },
  { id: "reviewCount", label: "Nº reseñas", synonyms: ["n resenas", "no resenas", "resenas", "review count", "reviews", "num resenas", "numero de resenas"] },
  { id: "latitude", label: "Latitud", synonyms: ["latitud", "latitude", "lat"] },
  { id: "longitude", label: "Longitud", synonyms: ["longitud", "longitude", "lng", "lon"] },
  { id: "url", label: "Enlace a la ficha", synonyms: ["enlace a la ficha", "link", "google maps", "maps url", "url", "ficha"] },
  { id: "externalId", label: "Id de Google (place_id)", synonyms: ["place id", "place_id", "id google", "cid"] },
  { id: "stage", label: "Etapa", synonyms: ["etapa", "stage", "estado", "status", "fase"] },
  { id: "tags", label: "Etiquetas", synonyms: ["etiquetas", "tags", "etiqueta", "tag", "labels"] },
  { id: "notes", label: "Notas", synonyms: ["notas", "notes", "nota interna", "comentarios", "comments", "observaciones"] },
] as const;

export type ImportTarget = (typeof IMPORT_TARGETS)[number]["id"];

/** Columna del CSV → campo destino ("" = ignorar). */
export type ImportMapping = Record<string, ImportTarget | "">;

const normHeader = (h: string) =>
  h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Asigna cada columna al campo más probable (cada campo, a una sola columna). */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const taken = new Set<string>();
  // Primero coincidencias exactas, luego parciales.
  for (const pass of ["exact", "partial"] as const) {
    for (const h of headers) {
      if (mapping[h]) continue;
      const n = normHeader(h);
      const target = IMPORT_TARGETS.find(
        (t) =>
          !taken.has(t.id) &&
          (normHeader(t.label) === n ||
            t.synonyms.some((s) => (pass === "exact" ? s === n : n.startsWith(s + " ") || n.endsWith(" " + s)))),
      );
      if (target) {
        mapping[h] = target.id;
        taken.add(target.id);
      }
    }
  }
  for (const h of headers) mapping[h] ??= "";
  return mapping;
}

/** Fila lista para enviar al servidor. */
export interface ImportRow {
  name: string;
  category?: string;
  emails?: string[];
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  url?: string;
  externalId?: string;
  /** Nombre o id de etapa. */
  stage?: string;
  /** Nombres de etiquetas. */
  tags?: string[];
  notes?: string;
}

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};
const list = (v: string) =>
  v
    .split(/[,;|]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export function toImportRows(rows: Record<string, string>[], mapping: ImportMapping): ImportRow[] {
  const out: ImportRow[] = [];
  for (const raw of rows) {
    const r: Partial<ImportRow> = {};
    for (const [col, target] of Object.entries(mapping)) {
      const v = (raw[col] ?? "").toString().trim();
      if (!target || !v) continue;
      switch (target) {
        case "emails":
          r.emails = [...new Set([...(r.emails ?? []), ...list(v).filter((e) => e.includes("@")).map((e) => e.toLowerCase())])];
          break;
        case "tags":
          r.tags = list(v);
          break;
        case "rating":
        case "reviewCount":
        case "latitude":
        case "longitude":
          r[target] = num(v);
          break;
        case "website":
          r.website = /^https?:\/\//i.test(v) ? v : `https://${v}`;
          break;
        default:
          r[target] = v;
      }
    }
    if (r.name) out.push(r as ImportRow);
  }
  return out;
}

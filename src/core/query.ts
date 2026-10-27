import type { Lead, SavedLead } from "./lead";
import { LEAD_FIELDS, type LeadField } from "./fields";
import { autoTags, isAutoTag, leadScore } from "./score";

/**
 * Filtros y orden de leads. Es código puro: lo usan tanto la tabla (cliente)
 * como la exportación (servidor), así lo que ves es exactamente lo que exportas.
 */
export interface LeadFilters {
  q?: string;
  category?: string;
  minRating?: number;
  minReviews?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  /** Solo negocios sin web (oportunidad para ofrecerles una). */
  noWebsite?: boolean;
  /** Con al menos una red social. */
  hasSocials?: boolean;
  minScore?: number;
  /** Etiqueta (manual o automática "auto:…"). */
  tag?: string;
  // Solo leads guardados:
  stage?: string;
  color?: string;
  /** "hide": oculta los marcados "no contactar"; "only": solo esos. */
  dnc?: "hide" | "only";
}

/** Contexto necesario para algunos filtros (umbral de valoración baja). */
export interface QueryContext {
  lowRating?: number;
  fields?: LeadField[];
}

export interface LeadSort {
  field: string;
  dir: "asc" | "desc";
}

export function filterLeads<T extends Lead>(leads: T[], f: LeadFilters, ctx: QueryContext = {}): T[] {
  const q = f.q?.trim().toLowerCase();
  return leads.filter((l) => {
    if (q) {
      const hay = [l.name, l.category, l.address, l.phone, l.website, ...l.emails]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.category && l.category !== f.category) return false;
    if (f.minRating !== undefined && (l.rating ?? 0) < f.minRating) return false;
    if (f.minReviews !== undefined && (l.reviewCount ?? 0) < f.minReviews) return false;
    if (f.hasEmail && l.emails.length === 0) return false;
    if (f.hasPhone && !l.phone) return false;
    if (f.hasWebsite && !l.website) return false;
    if (f.noWebsite && l.website) return false;
    if (f.hasSocials && !Object.keys(l.socials ?? {}).length) return false;
    if (f.minScore !== undefined && leadScore(l) < f.minScore) return false;
    const crm = l as Partial<SavedLead>;
    if (f.tag) {
      const has = isAutoTag(f.tag)
        ? (autoTags(l, ctx.lowRating) as string[]).includes(f.tag)
        : (crm.tags ?? []).includes(f.tag);
      if (!has) return false;
    }
    if (f.stage && crm.stage !== f.stage) return false;
    if (f.color && (f.color === "none" ? Boolean(crm.color) : crm.color !== f.color)) return false;
    if (f.dnc === "hide" && crm.doNotContact) return false;
    if (f.dnc === "only" && !crm.doNotContact) return false;
    return true;
  });
}

export function sortLeads<T extends Lead>(leads: T[], sort?: LeadSort, fields: LeadField[] = LEAD_FIELDS): T[] {
  if (!sort) return leads;
  const field = fields.find((f) => f.key === sort.field);
  if (!field) return leads;
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...leads].sort((a, b) => {
    const va = field.value(a);
    const vb = field.value(b);
    // Los vacíos ("—") cuentan como el valor más bajo: primero de menor a
    // mayor y últimos de mayor a menor.
    const ea = va === undefined || va === "";
    const eb = vb === undefined || vb === "";
    if (ea && eb) return 0;
    if (ea) return -mul;
    if (eb) return mul;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) * mul;
  });
}

export function queryLeads<T extends Lead>(leads: T[], filters: LeadFilters, sort?: LeadSort, ctx: QueryContext = {}): T[] {
  return sortLeads(filterLeads(leads, filters, ctx), sort, ctx.fields);
}

const NUM_KEYS = ["minRating", "minReviews", "minScore"] as const;
const BOOL_KEYS = ["hasEmail", "hasPhone", "hasWebsite", "noWebsite", "hasSocials"] as const;
const STR_KEYS = ["q", "category", "tag", "stage", "color"] as const;

/** Serializa filtros y orden a parámetros de URL (para la exportación). */
export function toSearchParams(filters: LeadFilters, sort?: LeadSort): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  if (sort) {
    p.set("sort", sort.field);
    p.set("dir", sort.dir);
  }
  return p;
}

export function fromSearchParams(p: URLSearchParams): { filters: LeadFilters; sort?: LeadSort } {
  const num = (k: string) => {
    const v = p.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const filters: LeadFilters = {};
  for (const k of STR_KEYS) if (p.get(k)) filters[k] = p.get(k) as string;
  for (const k of NUM_KEYS) filters[k] = num(k);
  for (const k of BOOL_KEYS) if (p.get(k) === "true") filters[k] = true;
  const dnc = p.get("dnc");
  if (dnc === "hide" || dnc === "only") filters.dnc = dnc;
  const field = p.get("sort");
  const sort: LeadSort | undefined = field
    ? { field, dir: p.get("dir") === "desc" ? "desc" : "asc" }
    : undefined;
  return { filters, sort };
}

/** Normaliza filtros guardados (descarta claves desconocidas o vacías). */
export function cleanFilters(f: unknown): LeadFilters {
  const raw = (f ?? {}) as Record<string, unknown>;
  const out: LeadFilters = {};
  for (const k of STR_KEYS) if (typeof raw[k] === "string" && raw[k]) out[k] = raw[k] as string;
  for (const k of NUM_KEYS) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) out[k] = raw[k] as number;
  for (const k of BOOL_KEYS) if (raw[k] === true) out[k] = true;
  if (raw.dnc === "hide" || raw.dnc === "only") out.dnc = raw.dnc;
  return out;
}

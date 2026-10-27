import type { Lead } from "./lead";
import { getField } from "./fields";

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
}

export interface LeadSort {
  field: string;
  dir: "asc" | "desc";
}

export function filterLeads(leads: Lead[], f: LeadFilters): Lead[] {
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
    return true;
  });
}

export function sortLeads(leads: Lead[], sort?: LeadSort): Lead[] {
  if (!sort) return leads;
  const field = getField(sort.field);
  if (!field) return leads;
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...leads].sort((a, b) => {
    const va = field.value(a);
    const vb = field.value(b);
    // Los vacíos siempre al final, independientemente de la dirección.
    const ea = va === undefined || va === "";
    const eb = vb === undefined || vb === "";
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) * mul;
  });
}

export function queryLeads(leads: Lead[], filters: LeadFilters, sort?: LeadSort): Lead[] {
  return sortLeads(filterLeads(leads, filters), sort);
}

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
  const filters: LeadFilters = {
    q: p.get("q") ?? undefined,
    category: p.get("category") ?? undefined,
    minRating: num("minRating"),
    minReviews: num("minReviews"),
    hasEmail: p.get("hasEmail") === "true",
    hasPhone: p.get("hasPhone") === "true",
    hasWebsite: p.get("hasWebsite") === "true",
  };
  const field = p.get("sort");
  const sort: LeadSort | undefined = field
    ? { field, dir: p.get("dir") === "desc" ? "desc" : "asc" }
    : undefined;
  return { filters, sort };
}

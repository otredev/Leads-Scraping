import type { Lead } from "./lead";

/** Métricas agregadas para el panel. Código puro, reutilizable (p. ej. desde un MCP). */
export interface LeadStats {
  total: number;
  withEmail: number;
  withPhone: number;
  withWebsite: number;
  /** Media de valoración entre los leads que tienen valoración. */
  avgRating?: number;
  /** Leads extraídos por día, últimos `days` días (incluye días a 0). */
  byDay: { date: string; value: number }[];
  /** Categorías más frecuentes; el resto se agrupa en "Otras". */
  byCategory: { label: string; value: number }[];
  ratingBuckets: { label: string; value: number }[];
  /** Mejores leads: valoración ponderada por número de reseñas. */
  top: Pick<Lead, "id" | "name" | "category" | "rating" | "reviewCount" | "phone" | "website" | "emails" | "searchId">[];
}

const BUCKETS = [
  { label: "< 3", min: 0, max: 3 },
  { label: "3 – 3,5", min: 3, max: 3.5 },
  { label: "3,5 – 4", min: 3.5, max: 4 },
  { label: "4 – 4,5", min: 4, max: 4.5 },
  { label: "4,5 – 5", min: 4.5, max: 5.01 },
];

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeStats(leads: Lead[], { days = 14, categories = 6, now = new Date() } = {}): LeadStats {
  const rated = leads.filter((l) => l.rating !== undefined);

  const perDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    perDay.set(dayKey(d), 0);
  }
  for (const l of leads) {
    const k = l.collectedAt.slice(0, 10);
    if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }

  const cats = new Map<string, number>();
  for (const l of leads) {
    const c = l.category?.trim() || "Sin categoría";
    cats.set(c, (cats.get(c) ?? 0) + 1);
  }
  const sortedCats = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  const byCategory = sortedCats.slice(0, categories).map(([label, value]) => ({ label, value }));
  const rest = sortedCats.slice(categories).reduce((n, [, v]) => n + v, 0);
  if (rest > 0) byCategory.push({ label: "Otras", value: rest });

  // Media bayesiana sencilla: evita que un 5,0 con 2 reseñas gane a un 4,8 con 300.
  const prior = 10;
  const mean = rated.length ? rated.reduce((n, l) => n + (l.rating ?? 0), 0) / rated.length : 0;
  const score = (l: Lead) => {
    const n = l.reviewCount ?? 0;
    return ((l.rating ?? 0) * n + mean * prior) / (n + prior);
  };

  return {
    total: leads.length,
    withEmail: leads.filter((l) => l.emails.length > 0).length,
    withPhone: leads.filter((l) => l.phone).length,
    withWebsite: leads.filter((l) => l.website).length,
    avgRating: rated.length ? Math.round(mean * 100) / 100 : undefined,
    byDay: [...perDay.entries()].map(([date, value]) => ({ date, value })),
    byCategory,
    ratingBuckets: BUCKETS.map((b) => ({
      label: b.label,
      value: rated.filter((l) => (l.rating ?? 0) >= b.min && (l.rating ?? 0) < b.max).length,
    })),
    top: [...rated]
      .sort((a, b) => score(b) - score(a))
      .slice(0, 6)
      .map(({ id, name, category, rating, reviewCount, phone, website, emails, searchId }) => ({
        id,
        name,
        category,
        rating,
        reviewCount,
        phone,
        website,
        emails,
        searchId,
      })),
  };
}

import type { LeadInput, OpeningHours, Review } from "@/core/lead";

/** Fila del CSV de gosom (columnas en `gmaps/entry.go → CsvHeaders`). */
export type GosomRow = Record<string, string | undefined>;

function parseJson<T>(value: string | undefined): T | undefined {
  if (!value || value === "null") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function num(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function str(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

interface GosomReview {
  Name?: string;
  Rating?: number;
  Description?: string;
  When?: string;
}

function mapReviews(row: GosomRow): Review[] {
  const extended = parseJson<GosomReview[]>(row.user_reviews_extended) ?? [];
  const basic = parseJson<GosomReview[]>(row.user_reviews) ?? [];
  const source = extended.length > 0 ? extended : basic;
  return source.map((r) => ({
    author: str(r.Name),
    rating: typeof r.Rating === "number" ? r.Rating : undefined,
    text: str(r.Description),
    date: str(r.When),
  }));
}

function mapHours(row: GosomRow): OpeningHours | undefined {
  const h = parseJson<Record<string, string[] | null>>(row.open_hours);
  if (!h || Object.keys(h).length === 0) return undefined;
  return Object.fromEntries(Object.entries(h).map(([day, ranges]) => [day, ranges ?? []]));
}

function mapEmails(row: GosomRow): string[] {
  return (row.emails ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"))
    .filter((e, i, arr) => arr.indexOf(e) === i);
}

/** Columnas que ya se mapean al modelo y no hace falta repetir en `extra`. */
const MAPPED = new Set([
  "title", "category", "address", "open_hours", "website", "phone", "review_count",
  "review_rating", "latitude", "longitude", "link", "place_id", "user_reviews",
  "user_reviews_extended", "emails",
]);

/** Columnas pesadas que no aportan a un lead y se descartan. */
const DROPPED = new Set(["popular_times", "images"]);

export function mapGosomRow(row: GosomRow): LeadInput | undefined {
  const name = str(row.title);
  if (!name) return undefined;

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (MAPPED.has(key) || DROPPED.has(key) || !str(value)) continue;
    extra[key] = parseJson(value) ?? value;
  }

  return {
    externalId: str(row.place_id) ?? str(row.cid) ?? str(row.data_id),
    name,
    category: str(row.category),
    emails: mapEmails(row),
    phone: str(row.phone),
    website: str(row.website),
    address: str(row.address),
    rating: num(row.review_rating),
    reviewCount: num(row.review_count),
    reviews: mapReviews(row),
    openingHours: mapHours(row),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    url: str(row.link),
    extra,
  };
}

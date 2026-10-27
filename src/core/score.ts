import type { Lead } from "./lead";

/**
 * Puntuación de un lead (0–100) según lo fácil y valioso que es contactarlo.
 *
 *   Contacto (hasta 60): email 25 · teléfono 20 · web 15
 *   Valoración (hasta 25): de 3,0★ (0 puntos) a 5,0★ (25 puntos)
 *   Reseñas (hasta 15): escala logarítmica, 500+ reseñas = 15
 *
 * Para cambiar los pesos, edita solo esta función: tabla, filtros, orden y
 * exportación la usan automáticamente.
 */
export function leadScore(l: Pick<Lead, "emails" | "phone" | "website" | "rating" | "reviewCount">): number {
  let s = 0;
  if (l.emails?.length) s += 25;
  if (l.phone) s += 20;
  if (l.website) s += 15;
  if (l.rating !== undefined) s += Math.max(0, Math.min(1, (l.rating - 3) / 2)) * 25;
  if (l.reviewCount) s += Math.min(1, Math.log10(l.reviewCount + 1) / Math.log10(501)) * 15;
  return Math.round(s);
}

/** Etiquetas automáticas: se calculan, no se guardan. */
export const AUTO_TAGS = [
  { id: "auto:no-web", name: "Sin web" },
  { id: "auto:no-contact", name: "Sin contacto" },
  { id: "auto:low-rating", name: "Valoración baja" },
] as const;

export type AutoTagId = (typeof AUTO_TAGS)[number]["id"];

export function autoTags(
  l: Pick<Lead, "emails" | "phone" | "website" | "rating">,
  lowRating = 3.5,
): AutoTagId[] {
  const out: AutoTagId[] = [];
  if (!l.website) out.push("auto:no-web");
  if (!l.emails?.length && !l.phone) out.push("auto:no-contact");
  if (l.rating !== undefined && l.rating < lowRating) out.push("auto:low-rating");
  return out;
}

export function isAutoTag(id: string): id is AutoTagId {
  return id.startsWith("auto:");
}

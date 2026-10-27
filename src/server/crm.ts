import "server-only";
import { leadDedupeKey, type SavedLead } from "@/core/lead";
import { withNormalizedPhone } from "@/core/phone";
import { getStore } from "./registry";
import { defaultCountry } from "./runner";

/** Días que un lead pasa en la papelera antes de borrarse (TRASH_DAYS, por defecto 30). */
export function trashDays() {
  const n = Number(process.env.TRASH_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/**
 * Guarda en el CRM resultados de búsqueda por id.
 * `searchId` limita la búsqueda de ids a esa búsqueda (más rápido); sin él,
 * se buscan entre todos los resultados.
 */
export async function saveResults(ids: string[], searchId?: string) {
  const store = getStore();
  const wanted = new Set(ids);
  const results = (await store.listLeads(searchId)).filter((l) => wanted.has(l.id));
  if (!results.length) return { created: 0, updated: 0, found: 0 };

  const countries = new Map((await store.listSearches()).map((s) => [s.id, s.params.country]));
  const now = new Date().toISOString();
  const saved: SavedLead[] = results.map((r) => ({
    ...withNormalizedPhone(r, countries.get(r.searchId) ?? defaultCountry()),
    key: leadDedupeKey(r),
    searchIds: [r.searchId],
    savedAt: now,
    updatedAt: now,
  }));
  const res = await store.saveLeads(saved);
  return { ...res, found: results.length };
}

export async function trashSaved(ids: string[]) {
  const purgeAt = new Date(Date.now() + trashDays() * 86_400_000);
  return getStore().trashLeads(ids, purgeAt);
}

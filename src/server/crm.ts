import "server-only";
import { leadDedupeKey, type SavedLead } from "@/core/lead";
import { withNormalizedPhone } from "@/core/phone";
import {
  initialStage,
  isLabelColor,
  sanitizeUpdate,
  uniqueId,
  type CrmSettings,
  type Stage,
  type TableId,
  type TablePrefs,
  type Tag,
} from "@/core/crm";
import { cleanFilters } from "@/core/query";
import { getStore } from "./registry";
import { defaultCountry } from "./runner";

/** Días que un lead pasa en la papelera antes de borrarse (TRASH_DAYS, por defecto 30). */
export function trashDays() {
  const n = Number(process.env.TRASH_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
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

  const [searches, settings] = await Promise.all([store.listSearches(), store.getSettings()]);
  const countries = new Map(searches.map((s) => [s.id, s.params.country]));
  const stage = initialStage(settings);
  const now = new Date().toISOString();
  const saved: SavedLead[] = results.map((r) => ({
    ...withNormalizedPhone(r, countries.get(r.searchId) ?? defaultCountry()),
    key: leadDedupeKey(r),
    searchIds: [r.searchId],
    savedAt: now,
    updatedAt: now,
    stage,
    tags: [],
    notes: [],
  }));
  const res = await store.saveLeads(saved);
  return { ...res, found: results.length };
}

export async function trashSaved(ids: string[]) {
  const purgeAt = new Date(Date.now() + trashDays() * 86_400_000);
  return getStore().trashLeads(ids, purgeAt);
}

/** Aplica una actualización del CRM validada contra los ajustes actuales. */
export async function updateSaved(ids: string[], raw: unknown) {
  const store = getStore();
  const update = sanitizeUpdate(raw, await store.getSettings());
  if (!Object.keys(update).length) throw badRequest("No hay cambios que aplicar");
  return store.updateLeads(ids, update);
}

// ── Ajustes: etapas, etiquetas y preferencias de tablas ──

function cleanName(v: unknown, what: string) {
  const name = typeof v === "string" ? v.trim().slice(0, 40) : "";
  if (!name) throw badRequest(`El nombre de la ${what} no puede estar vacío`);
  return name;
}

/**
 * Sustituye la lista de etapas. Las etapas que desaparecen pasan sus leads a
 * `moveTo` (o a la primera etapa que quede).
 */
export async function saveStages(raw: unknown, moveTo?: string) {
  const store = getStore();
  const settings = await store.getSettings();
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest("Debe haber al menos una etapa");
  const ids = new Set<string>();
  const stages: Stage[] = raw.map((r: Partial<Stage>) => {
    const name = cleanName(r?.name, "etapa");
    const id = typeof r?.id === "string" && r.id && !ids.has(r.id) ? r.id : uniqueId(name, [...ids, ...settings.stages.map((s) => s.id)]);
    ids.add(id);
    return { id, name, color: isLabelColor(r?.color) ? r.color : "gray" };
  });
  const removed = settings.stages.filter((s) => !ids.has(s.id));
  const target = moveTo && ids.has(moveTo) ? moveTo : stages[0].id;
  for (const s of removed) await store.reassignStage(s.id, target);
  const next: CrmSettings = { ...settings, stages };
  await store.saveSettings(next);
  return next;
}

/** Sustituye la lista de etiquetas. Las que desaparecen se quitan de todos los leads. */
export async function saveTags(raw: unknown) {
  const store = getStore();
  const settings = await store.getSettings();
  if (!Array.isArray(raw)) throw badRequest("Formato de etiquetas no válido");
  const ids = new Set<string>();
  const names = new Set<string>();
  const tags: Tag[] = [];
  for (const r of raw as Partial<Tag>[]) {
    const name = cleanName(r?.name, "etiqueta");
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    const id = typeof r?.id === "string" && r.id && !ids.has(r.id) ? r.id : uniqueId(name, [...ids, ...settings.tags.map((t) => t.id)]);
    ids.add(id);
    tags.push({ id, name, color: isLabelColor(r?.color) ? r.color : "gray" });
  }
  for (const t of settings.tags) if (!ids.has(t.id)) await store.removeTag(t.id);
  const next: CrmSettings = { ...settings, tags };
  await store.saveSettings(next);
  return next;
}

/** Crea una etiqueta (o devuelve la existente con ese nombre). */
export async function createTag(name: unknown, color?: unknown) {
  const store = getStore();
  const settings = await store.getSettings();
  const clean = cleanName(name, "etiqueta");
  const existing = settings.tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { tag: existing, settings };
  const tag: Tag = {
    id: uniqueId(clean, settings.tags.map((t) => t.id)),
    name: clean,
    color: isLabelColor(color) ? color : "gray",
  };
  const next = { ...settings, tags: [...settings.tags, tag] };
  await store.saveSettings(next);
  return { tag, settings: next };
}

export async function saveTablePrefs(table: TableId, raw: unknown) {
  const store = getStore();
  const settings = await store.getSettings();
  const r = (raw ?? {}) as Partial<TablePrefs>;
  const prefs: TablePrefs = {
    filters: cleanFilters(r.filters),
    sort:
      r.sort && typeof r.sort.field === "string"
        ? { field: r.sort.field, dir: r.sort.dir === "desc" ? "desc" : "asc" }
        : undefined,
    columns: Array.isArray(r.columns) ? r.columns.map(String).slice(0, 50) : [],
    widths: Object.fromEntries(
      Object.entries(r.widths && typeof r.widths === "object" ? r.widths : {})
        .filter(([k, v]) => k.length < 40 && typeof v === "number" && Number.isFinite(v))
        .slice(0, 50)
        .map(([k, v]) => [k, Math.round(Math.min(1000, Math.max(60, v as number)))]),
    ),
  };
  const next: CrmSettings = { ...settings, tables: { ...settings.tables, [table]: prefs } };
  await store.saveSettings(next);
  return next;
}

export async function saveLowRating(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 5) throw badRequest("El umbral debe estar entre 1 y 5");
  const store = getStore();
  const next = { ...(await store.getSettings()), lowRating: Math.round(n * 10) / 10 };
  await store.saveSettings(next);
  return next;
}

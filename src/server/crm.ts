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
  type MessageTemplate,
} from "@/core/crm";
import { cleanFilters } from "@/core/query";
import { getProvider, getStore, providers } from "./registry";
import { defaultCountry } from "./config";
import { startSearch } from "./runner";
import { parseMapsUrl } from "@/core/mapsUrl";
import type { ImportRow } from "@/core/importCsv";
import { randomUUID } from "node:crypto";

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

/**
 * Vuelve a extraer los datos de leads guardados: lanza una búsqueda con la URL
 * de su ficha (o nombre + dirección) y, al terminar, actualiza los leads.
 */
export async function startRefresh(ids: string[]) {
  const store = getStore();
  const leads = (await Promise.all(ids.slice(0, 200).map((id) => store.getSavedLead(id)))).filter(Boolean) as SavedLead[];
  if (!leads.length) throw badRequest("No hay leads que actualizar");

  // Proveedor: el del lead si admite URLs; si no, el primero que las admita.
  const own = getProvider(leads[0].providerId);
  const provider = own?.acceptsMapsUrls ? own : providers.find((p) => p.acceptsMapsUrls);
  if (!provider) throw badRequest("Ningún proveedor instalado permite volver a extraer datos (hace falta gosom).");

  const queries = leads.map((l) =>
    l.url && parseMapsUrl(l.url) ? l.url : [l.name, l.address].filter(Boolean).join(", "),
  );
  const countries = new Map((await store.listSearches()).map((s) => [s.id, s.params.country]));
  return startSearch({
    name: leads.length === 1 ? `Actualizar: ${leads[0].name}` : `Actualizar ${leads.length} leads`,
    providerId: provider.id,
    queries,
    country: countries.get(leads[0].searchId) ?? defaultCountry(),
    // Una ficha por consulta: poca profundidad y el tiempo mínimo.
    options: { depth: 1, maxTimeMinutes: 3, email: true },
    refreshLeadIds: leads.map((l) => l.id),
  });
}

const normName = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Importa leads (filas ya mapeadas desde un CSV) directamente a Leads.
 * Los que ya existen (mismo place_id, o mismo nombre + dirección) actualizan
 * sus datos; su etapa, etiquetas y notas no se tocan.
 */
export async function importLeads(
  rawRows: unknown,
  opts: { stage?: string; tags?: string[]; country?: string } = {},
) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) throw badRequest("El archivo no tiene filas con nombre");
  if (rawRows.length > 10_000) throw badRequest("Máximo 10.000 filas por importación");
  const rows = (rawRows as ImportRow[]).filter((r) => r && typeof r.name === "string" && r.name.trim());

  const store = getStore();
  let settings = await store.getSettings();

  // Etiquetas: se crean las que no existan (por nombre).
  const tagByName = new Map(settings.tags.map((t) => [normName(t.name), t.id]));
  const newTags: Tag[] = [];
  for (const r of rows) {
    for (const name of r.tags ?? []) {
      const n = normName(name);
      if (!n || tagByName.has(n)) continue;
      const tag: Tag = { id: uniqueId(name, [...settings.tags, ...newTags].map((t) => t.id)), name: name.trim().slice(0, 40), color: "gray" };
      newTags.push(tag);
      tagByName.set(n, tag.id);
    }
  }
  if (newTags.length) {
    settings = { ...settings, tags: [...settings.tags, ...newTags] };
    await store.saveSettings(settings);
  }

  const stageOf = (v?: string) =>
    v ? settings.stages.find((s) => s.id === v || normName(s.name) === normName(v))?.id : undefined;
  const defaultStage = stageOf(opts.stage) ?? initialStage(settings);
  const extraTags = (opts.tags ?? []).filter((id) => settings.tags.some((t) => t.id === id));
  const country = (opts.country || defaultCountry()).toUpperCase();
  const now = new Date().toISOString();

  const leads: SavedLead[] = rows.map((r) => {
    const base = withNormalizedPhone(
      {
        id: randomUUID(),
        searchId: "import",
        sourceId: "import",
        providerId: "csv",
        externalId: r.externalId?.trim() || undefined,
        name: r.name.trim(),
        category: r.category,
        emails: r.emails ?? [],
        phone: r.phone,
        website: r.website,
        address: r.address,
        rating: r.rating,
        reviewCount: r.reviewCount,
        reviews: [],
        latitude: r.latitude,
        longitude: r.longitude,
        url: r.url,
        extra: {},
        collectedAt: now,
      },
      country,
    );
    return {
      ...base,
      key: leadDedupeKey(base),
      searchIds: ["import"],
      savedAt: now,
      updatedAt: now,
      stage: stageOf(r.stage) ?? defaultStage,
      tags: [...new Set([...(r.tags ?? []).map((n) => tagByName.get(normName(n))!).filter(Boolean), ...extraTags])],
      notes: r.notes?.trim() ? [{ id: randomUUID(), text: r.notes.trim(), createdAt: now }] : [],
    };
  });

  // Filas repetidas del mismo negocio dentro del archivo: se combinan
  // (gana el primer valor no vacío; etiquetas, emails y notas se suman).
  const byKey = new Map<string, SavedLead>();
  for (const l of leads) {
    const prev = byKey.get(l.key);
    if (!prev) {
      byKey.set(l.key, l);
      continue;
    }
    const merged = { ...l, ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== undefined && v !== "")) } as SavedLead;
    merged.emails = [...new Set([...prev.emails, ...l.emails])];
    merged.tags = [...new Set([...prev.tags, ...l.tags])];
    merged.notes = [...prev.notes, ...l.notes];
    merged.stage = prev.stage !== defaultStage ? prev.stage : l.stage;
    byKey.set(l.key, merged);
  }
  const unique = [...byKey.values()];
  const res = await store.saveLeads(unique);
  return { ...res, skipped: (rawRows as unknown[]).length - rows.length, duplicates: leads.length - unique.length, newTags: newTags.length };
}

/** Sustituye la lista de plantillas de mensaje. */
export async function saveTemplates(raw: unknown) {
  if (!Array.isArray(raw)) throw badRequest("Formato de plantillas no válido");
  const store = getStore();
  const settings = await store.getSettings();
  const ids = new Set<string>();
  const templates: MessageTemplate[] = (raw as Partial<MessageTemplate>[]).map((t) => {
    const name = cleanName(t?.name, "plantilla");
    const body = typeof t?.body === "string" ? t.body.slice(0, 5000) : "";
    if (!body.trim()) throw badRequest(`La plantilla "${name}" no tiene texto`);
    const channel = t?.channel === "email" ? "email" : "whatsapp";
    const id = typeof t?.id === "string" && t.id && !ids.has(t.id) ? t.id : uniqueId(`${name}-${channel}`, ids);
    ids.add(id);
    return { id, name, channel, body, ...(channel === "email" && typeof t?.subject === "string" ? { subject: t.subject.slice(0, 300) } : {}) };
  });
  const next: CrmSettings = { ...settings, templates };
  await store.saveSettings(next);
  return next;
}

/** Datos de tu negocio que ven los clientes en su portal. */
export async function savePortalBrand(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (k: string, max = 200) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).trim().slice(0, max) : undefined);
  const email = text("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Email no válido");
  let website = text("website", 300);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const portal = {
    brandName: text("brandName", 80),
    email,
    phone: text("phone", 40),
    whatsapp: text("whatsapp", 40),
    website,
    welcome: text("welcome", 500),
    legalName: text("legalName", 120),
    taxId: text("taxId", 30)?.toUpperCase(),
    legalAddress: text("legalAddress", 300),
    registry: text("registry", 300),
  };
  const store = getStore();
  const next: CrmSettings = { ...(await store.getSettings()), portal: Object.fromEntries(Object.entries(portal).filter(([, v]) => v)) };
  await store.saveSettings(next);
  const { scheduleAll, publishSite, portalConfig } = await import("./portal");
  await scheduleAll();
  // Marca y datos legales del portal (páginas /legal/*). Si falla, se reintenta al activar o publicar un portal.
  if (portalConfig().configured) await publishSite().catch((err: Error) => console.error(`[portal] datos legales: ${err.message}`));
  return next;
}

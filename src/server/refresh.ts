import "server-only";
import { leadDedupeKey, type Lead, type SavedLead } from "@/core/lead";
import { parseMapsUrl } from "@/core/mapsUrl";
import { getStore } from "./registry";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Empareja los resultados de una búsqueda de actualización con los leads
 * guardados y refresca sus datos (nunca toca etapa, etiquetas, notas…).
 *   1. misma clave (place_id de Google)
 *   2. mismo nombre normalizado
 *   3. si se buscó un único lead por la URL de su ficha y hay un único resultado, ese
 */
export async function applyRefresh(searchId: string, leadIds: string[]) {
  const store = getStore();
  const results = await store.listLeads(searchId);
  const leads = (await Promise.all(leadIds.map((id) => store.getSavedLead(id)))).filter(Boolean) as SavedLead[];
  const used = new Set<string>();
  const pairs: [SavedLead, Lead][] = [];

  for (const lead of leads) {
    const byKey = results.find((r) => !used.has(r.id) && leadDedupeKey(r) === lead.key);
    const byName = byKey ?? results.find((r) => !used.has(r.id) && norm(r.name) === norm(lead.name));
    // Sin coincidencia de nombre solo se acepta si se buscó por la URL de su ficha
    // (es el mismo negocio aunque haya cambiado de nombre).
    const byOwnUrl = lead.url && parseMapsUrl(lead.url) && leads.length === 1 && results.length === 1 ? results[0] : undefined;
    const match = byName ?? byOwnUrl;
    if (match) {
      used.add(match.id);
      pairs.push([lead, match]);
    }
  }

  const now = new Date().toISOString();
  if (pairs.length) {
    await store.saveLeads(
      pairs.map(([lead, r]) => ({
        ...lead,
        ...r,
        // Identidad y CRM del lead guardado; datos frescos del resultado.
        id: lead.id,
        key: lead.key,
        searchId: lead.searchId,
        searchIds: [searchId],
        savedAt: lead.savedAt,
        updatedAt: now,
        stage: lead.stage,
        tags: lead.tags,
        notes: lead.notes,
        color: lead.color,
        doNotContact: lead.doNotContact,
        // Si la fuente ya no da un dato, se conserva el anterior.
        phone: r.phone ?? lead.phone,
        phoneE164: r.phoneE164 ?? lead.phoneE164,
        website: r.website ?? lead.website,
        emails: r.emails.length ? r.emails : lead.emails,
        address: r.address ?? lead.address,
      })),
    );
  }
  return { updated: pairs.length, total: leads.length };
}

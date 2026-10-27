import "server-only";
import { randomUUID } from "node:crypto";
import type { Lead, LeadInput } from "@/core/lead";
import type { RunContext } from "@/core/provider";
import type { Search, SearchParams } from "@/core/search";
import { resolveOptions } from "@/core/options";
import { withNormalizedPhone } from "@/core/phone";
import { describeQueries, parseMapsUrl } from "@/core/mapsUrl";
import { defaultCountry } from "./config";
import { getProvider, getStore } from "./registry";
import { applyRefresh } from "./refresh";

export { defaultCountry };

/**
 * Ejecuta búsquedas en segundo plano dentro del propio proceso de Next.js.
 * Suficiente para uso local. Para desplegar en serverless habría que mover
 * esto a una cola/worker; los proveedores no cambiarían.
 */

const g = globalThis as unknown as {
  __running?: Map<string, AbortController>;
  __resumed?: boolean;
};
const running = (g.__running ??= new Map());

export interface StartSearchInput {
  name?: string;
  providerId: string;
  queries: string[];
  lang?: string;
  country?: string;
  limit?: number;
  options?: unknown;
  /** Si es una actualización de leads guardados, sus ids. */
  refreshLeadIds?: string[];
}

export async function startSearch(input: StartSearchInput): Promise<Search> {
  const provider = getProvider(input.providerId);
  if (!provider) throw new Error(`Proveedor desconocido: ${input.providerId}`);

  let queries = input.queries.map((q) => q.trim()).filter(Boolean);
  if (queries.length === 0) throw new Error("Escribe al menos una búsqueda.");

  // URLs de Google Maps: se pasan tal cual a los proveedores que las aceptan;
  // al resto se les da el texto que contiene la URL.
  if (!provider.acceptsMapsUrls) {
    queries = queries.map((q) => {
      const info = parseMapsUrl(q);
      if (!info) return q;
      if (!info.query) throw new Error(`"${provider.name}" no acepta enlaces de Google Maps sin texto de búsqueda. Usa gosom o escribe la búsqueda.`);
      return info.query;
    });
  }

  const lang = (input.lang || "es").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(lang)) throw new Error("El idioma debe ser un código de 2 letras (es, en…).");

  const country = (input.country || defaultCountry()).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("El país debe ser un código de 2 letras (ES, MX, US…).");

  const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : undefined;

  const params: SearchParams = {
    queries,
    lang,
    country,
    limit,
    options: resolveOptions(provider.options, input.options),
    ...(input.refreshLeadIds?.length ? { refreshLeadIds: input.refreshLeadIds } : {}),
  };
  const now = new Date().toISOString();
  const search: Search = {
    id: randomUUID(),
    name: input.name?.trim() || describeQueries(input.queries.map((q) => q.trim()).filter(Boolean)).slice(0, 160),
    providerId: provider.id,
    sourceId: provider.sourceId,
    params,
    status: "queued",
    leadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await getStore().createSearch(search);
  void execute(search);
  return search;
}

async function execute(search: Search): Promise<void> {
  const store = getStore();
  const provider = getProvider(search.providerId);
  if (!provider) {
    await store.updateSearch(search.id, {
      status: "failed",
      error: `El proveedor "${search.providerId}" ya no está registrado.`,
      finishedAt: new Date().toISOString(),
    });
    return;
  }

  const controller = new AbortController();
  running.set(search.id, controller);
  let leadCount = search.leadCount;
  const limit = search.params.limit;

  const ctx: RunContext = {
    signal: controller.signal,
    checkpoint: search.checkpoint,
    saveCheckpoint: async (data) => {
      await store.updateSearch(search.id, { checkpoint: data });
    },
    progress: (p) => {
      void store.updateSearch(search.id, { progress: p }).catch(() => undefined);
    },
    emit: async (inputs: LeadInput[]) => {
      let batch = inputs;
      if (limit !== undefined) batch = batch.slice(0, Math.max(0, limit - leadCount));
      if (batch.length === 0) return;
      const now = new Date().toISOString();
      const leads: Lead[] = batch.map((l) => ({
        ...withNormalizedPhone(l, search.params.country ?? defaultCountry()),
        emails: l.emails ?? [],
        reviews: l.reviews ?? [],
        extra: l.extra ?? {},
        id: randomUUID(),
        searchId: search.id,
        sourceId: provider.sourceId,
        providerId: provider.id,
        collectedAt: now,
      }));
      leadCount += await store.addLeads(search.id, leads);
      await store.updateSearch(search.id, { leadCount });
    },
    log: (msg) => console.log(`[search ${search.id.slice(0, 8)} · ${provider.id}] ${msg}`),
  };

  await store.updateSearch(search.id, { status: "running", error: undefined });
  try {
    await provider.run(search.params, ctx);
    let message = `${leadCount} ${leadCount === 1 ? "resultado" : "resultados"}`;
    if (search.params.refreshLeadIds?.length) {
      const r = await applyRefresh(search.id, search.params.refreshLeadIds);
      message = `${r.updated} de ${r.total} leads actualizados`;
    }
    await store.updateSearch(search.id, {
      status: "completed",
      progress: { message, percent: 100 },
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const aborted = controller.signal.aborted || (err as Error).name === "AbortError";
    if (aborted) {
      await provider.cancel?.((await store.getSearch(search.id))?.checkpoint);
    }
    await store.updateSearch(search.id, {
      status: aborted ? "cancelled" : "failed",
      error: aborted ? undefined : (err as Error).message,
      progress: aborted ? { message: "Cancelada" } : undefined,
      finishedAt: new Date().toISOString(),
    });
    if (!aborted) console.error(`[search ${search.id}]`, err);
  } finally {
    running.delete(search.id);
  }
}

export async function cancelSearch(id: string): Promise<void> {
  const controller = running.get(id);
  if (controller) {
    controller.abort();
    return;
  }
  // No está en memoria (p. ej. tras reiniciar): marcar como cancelada.
  const store = getStore();
  const s = await store.getSearch(id);
  if (s && (s.status === "running" || s.status === "queued")) {
    await getProvider(s.providerId)?.cancel?.(s.checkpoint);
    await store.updateSearch(id, { status: "cancelled", finishedAt: new Date().toISOString() });
  }
}

export async function deleteSearch(id: string): Promise<void> {
  const store = getStore();
  const s = await store.getSearch(id);
  if (!s) return;
  const controller = running.get(id);
  if (controller) controller.abort();
  else if (s.status === "running" || s.status === "queued") await getProvider(s.providerId)?.cancel?.(s.checkpoint);
  await store.deleteSearch(id);
}

/**
 * Reanuda búsquedas que quedaron a medias al reiniciar el servidor, usando
 * el checkpoint guardado por el proveedor. Se ejecuta una vez por proceso.
 */
export async function resumeInterrupted(): Promise<void> {
  if (g.__resumed) return;
  g.__resumed = true;
  let searches: Search[];
  try {
    searches = await getStore().listSearches();
  } catch (err) {
    g.__resumed = false; // reintentar en la próxima petición
    throw err;
  }
  for (const s of searches) {
    if ((s.status === "running" || s.status === "queued") && !running.has(s.id)) {
      void execute(s);
    }
  }
}

/** Lanza de nuevo una búsqueda del historial con los mismos parámetros. */
export async function rerunSearch(id: string): Promise<Search> {
  const prev = await getStore().getSearch(id);
  if (!prev) throw new Error("Búsqueda no encontrada");
  return startSearch({
    name: prev.name,
    providerId: prev.providerId,
    queries: prev.params.queries,
    lang: prev.params.lang,
    country: prev.params.country,
    limit: prev.params.limit,
    options: prev.params.options,
    refreshLeadIds: prev.params.refreshLeadIds,
  });
}

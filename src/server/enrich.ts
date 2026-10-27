import "server-only";
import { randomUUID } from "node:crypto";
import type { Enricher, EnrichResult } from "@/core/enricher";
import type { SavedLead } from "@/core/lead";
import { withNormalizedPhone } from "@/core/phone";
import type { SocialNetwork } from "@/core/socials";
import { defaultCountry } from "./config";
import { enrichers, getEnricher, getStore } from "./registry";

/**
 * Trabajos de enriquecimiento: completan datos de leads guardados con los
 * enriquecedores registrados. Corren en segundo plano dentro del proceso
 * (como las búsquedas) y su progreso se consulta por id.
 */

export interface EnrichLeadResult {
  leadId: string;
  name: string;
  status: "updated" | "nothing" | "skipped" | "error";
  addedEmails: number;
  addedSocials: SocialNetwork[];
  addedPhone?: boolean;
  note?: string;
}

export interface EnrichJob {
  id: string;
  enrichers: string[];
  total: number;
  done: number;
  updated: number;
  status: "running" | "done" | "cancelled";
  results: EnrichLeadResult[];
  startedAt: string;
  finishedAt?: string;
}

const g = globalThis as unknown as { __enrichJobs?: Map<string, { job: EnrichJob; abort: AbortController }> };
const jobs = (g.__enrichJobs ??= new Map());

const badRequest = (m: string) => Object.assign(new Error(m), { status: 400 });

/** Fusiona lo encontrado sin borrar nada: añade emails y redes, y rellena teléfono/web si faltaban. */
export function mergeEnrichment(lead: SavedLead, enricherId: string, r: EnrichResult, now: string) {
  const emails = [...new Set([...lead.emails, ...(r.emails ?? [])])].slice(0, 10);
  const socials = { ...(r.socials ?? {}), ...(lead.socials ?? {}) };
  const addedSocials = (Object.keys(r.socials ?? {}) as SocialNetwork[]).filter((k) => !lead.socials?.[k]);
  let next: SavedLead = {
    ...lead,
    emails,
    socials,
    website: lead.website ?? r.website,
    extra: r.extra ? { ...lead.extra, [enricherId]: r.extra } : lead.extra,
    enrichedAt: now,
    updatedAt: now,
  };
  const addedPhone = !lead.phone && Boolean(r.phone);
  if (addedPhone) next = withNormalizedPhone({ ...next, phone: r.phone, phoneE164: undefined }, defaultCountry());
  return { lead: next, addedEmails: emails.length - lead.emails.length, addedSocials, addedPhone };
}

async function enrichOne(lead: SavedLead, list: Enricher[], signal: AbortSignal): Promise<EnrichLeadResult> {
  const base = { leadId: lead.id, name: lead.name, addedEmails: 0, addedSocials: [] as SocialNetwork[] };
  const usable = list.filter((e) => e.canEnrich(lead));
  if (!usable.length) return { ...base, status: "skipped", note: list.map((e) => e.requirement).filter(Boolean).join(" · ") || "No aplica" };

  let current = lead;
  let addedEmails = 0;
  const addedSocials: SocialNetwork[] = [];
  let addedPhone = false;
  const notes: string[] = [];
  let failed = 0;
  const now = new Date().toISOString();
  for (const e of usable) {
    try {
      const r = await e.enrich(current, { signal });
      if (r.note) notes.push(r.note);
      const m = mergeEnrichment(current, e.id, r, now);
      current = m.lead;
      addedEmails += m.addedEmails;
      addedSocials.push(...m.addedSocials);
      addedPhone ||= m.addedPhone;
    } catch (err) {
      failed++;
      notes.push(`${e.label}: ${(err as Error).message}`);
    }
  }
  if (failed === usable.length) return { ...base, status: "error", note: notes.join(" · ") };
  // Se guarda siempre (aunque no haya novedades) para registrar cuándo se revisó.
  await getStore().saveLeads([current]);
  const changed = addedEmails > 0 || addedSocials.length > 0 || addedPhone;
  return {
    ...base,
    status: changed ? "updated" : "nothing",
    addedEmails,
    addedSocials,
    addedPhone,
    note: changed ? undefined : notes.join(" · ") || "Sin datos nuevos",
  };
}

export async function startEnrichment(ids: string[], enricherIds?: string[]): Promise<EnrichJob> {
  const list = (enricherIds?.length ? enricherIds.map((id) => getEnricher(id)) : enrichers).filter(Boolean) as Enricher[];
  if (!list.length) throw badRequest("No hay enriquecedores disponibles");
  const unique = [...new Set(ids)];
  if (!unique.length) throw badRequest("No hay leads seleccionados");
  if (unique.length > 2000) throw badRequest("Máximo 2000 leads por vez");

  const store = getStore();
  const leads = (await Promise.all(unique.map((id) => store.getSavedLead(id)))).filter((l): l is SavedLead => Boolean(l && !l.deletedAt));
  const job: EnrichJob = {
    id: randomUUID(),
    enrichers: list.map((e) => e.id),
    total: leads.length,
    done: 0,
    updated: 0,
    status: "running",
    results: [],
    startedAt: new Date().toISOString(),
  };
  const abort = new AbortController();
  jobs.set(job.id, { job, abort });

  // Cola con concurrencia limitada (la menor de los enriquecedores usados).
  const queue = [...leads];
  const workers = Math.max(1, Math.min(...list.map((e) => e.concurrency ?? 2)));
  const run = async () => {
    for (let lead = queue.shift(); lead && !abort.signal.aborted; lead = queue.shift()) {
      const r = await enrichOne(lead, list, abort.signal).catch(
        (err: Error): EnrichLeadResult => ({ leadId: lead!.id, name: lead!.name, status: "error", addedEmails: 0, addedSocials: [], note: err.message }),
      );
      job.results.push(r);
      job.done++;
      if (r.status === "updated") job.updated++;
    }
  };
  void Promise.all(Array.from({ length: workers }, run)).finally(() => {
    job.status = abort.signal.aborted ? "cancelled" : "done";
    job.finishedAt = new Date().toISOString();
    // Se olvidan los trabajos terminados pasada una hora.
    setTimeout(() => jobs.delete(job.id), 60 * 60_000).unref?.();
  });
  return job;
}

export function getEnrichJob(id: string) {
  return jobs.get(id)?.job;
}

export function cancelEnrichJob(id: string) {
  jobs.get(id)?.abort.abort();
}

/** Espera a que termine un trabajo (para enriquecer uno o pocos leads desde la ficha). */
export async function waitForJob(id: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = getEnrichJob(id);
    if (!job || job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 250));
  }
  return getEnrichJob(id);
}

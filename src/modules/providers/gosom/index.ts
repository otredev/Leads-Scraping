import Papa from "papaparse";
import { defineProvider, sleep } from "@/core/provider";
import type { LeadInput } from "@/core/lead";
import { GosomClient, GosomError } from "./client";
import { mapGosomRow, type GosomRow } from "./mapper";

/**
 * Proveedor basado en gosom/google-maps-scraper (open source, gratuito).
 * Se ejecuta como servicio aparte (Docker o binario) en modo web y esta app
 * habla con su REST API: crea un trabajo, consulta su estado y descarga el CSV.
 */

const POLL_MS = 5_000;

interface GosomCheckpoint {
  jobId: string;
  startedAt: string;
}

function baseUrl(): string {
  return process.env.GOSOM_URL || "http://localhost:8080";
}

function client() {
  return new GosomClient(baseUrl());
}

export default defineProvider({
  id: "gosom",
  name: "gosom (Google Maps scraper)",
  description:
    "Scraper open source que navega Google Maps con un navegador automatizado. Gratis, sin límites de volumen. Necesita el servicio de gosom levantado.",
  sourceId: "google-maps",
  acceptsMapsUrls: true,
  options: [
    {
      key: "depth",
      label: "Profundidad",
      type: "number",
      default: 5,
      min: 1,
      max: 50,
      help: "Cuántas veces hace scroll en los resultados. Más profundidad, más negocios y más tiempo.",
    },
    {
      key: "maxTimeMinutes",
      label: "Tiempo máximo (min)",
      type: "number",
      default: 10,
      min: 3,
      max: 180,
      help: "gosom tarda al menos 3 minutos en devolver resultados.",
    },
    {
      key: "email",
      label: "Buscar emails en la web del negocio",
      type: "boolean",
      default: true,
      help: "Google Maps no publica emails: gosom visita cada web para encontrarlos. Más lento.",
    },
    {
      key: "extraReviews",
      label: "Reseñas ampliadas (hasta ~300)",
      type: "boolean",
      default: false,
      help: "Sin esto se obtienen unas pocas reseñas por negocio.",
    },
    {
      key: "proxies",
      label: "Proxies (opcional)",
      type: "text",
      default: "",
      placeholder: "http://user:pass@host:port, socks5://host:port",
      help: "Separados por comas. Útil para volúmenes grandes.",
    },
  ],

  async health() {
    try {
      await client().ping(AbortSignal.timeout(2_500));
      return { ok: true, message: `Conectado a ${baseUrl()}` };
    } catch (err) {
      const msg =
        err instanceof GosomError ? err.message : `Sin respuesta de ${baseUrl()}. Levanta gosom con: docker compose up -d`;
      return { ok: false, message: msg };
    }
  },

  async run(params, ctx) {
    const api = client();
    const opts = params.options;
    const maxTime = Number(opts.maxTimeMinutes) * 60;

    let cp = ctx.checkpoint as GosomCheckpoint | undefined;
    if (!cp?.jobId) {
      ctx.progress({ message: "Creando trabajo en gosom…", percent: 0 });
      const proxies = String(opts.proxies ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const jobId = await api.createJob(
        {
          name: params.queries.join(" | ").slice(0, 120),
          keywords: params.queries,
          lang: params.lang,
          depth: Number(opts.depth),
          email: Boolean(opts.email),
          extra_reviews: Boolean(opts.extraReviews),
          max_time: maxTime,
          ...(proxies.length ? { proxies } : {}),
        },
        ctx.signal,
      );
      cp = { jobId, startedAt: new Date().toISOString() };
      await ctx.saveCheckpoint(cp);
      ctx.log(`Trabajo gosom creado: ${jobId}`);
    } else {
      ctx.log(`Reanudando trabajo gosom ${cp.jobId}`);
    }

    const started = new Date(cp.startedAt).getTime();
    for (;;) {
      const job = await api.getJob(cp.jobId, ctx.signal);
      if (job.Status === "ok") break;
      if (job.Status === "failed") throw new Error("gosom marcó el trabajo como fallido. Revisa los logs del contenedor.");

      const elapsed = (Date.now() - started) / 1000;
      const percent = Math.min(95, Math.round((elapsed / maxTime) * 100));
      const mins = Math.floor(elapsed / 60);
      ctx.progress({
        message:
          job.Status === "pending"
            ? "En cola en gosom…"
            : `Extrayendo de Google Maps · ${mins} min de ${Math.round(maxTime / 60)} como máximo`,
        percent,
      });
      await sleep(POLL_MS, ctx.signal);
    }

    ctx.progress({ message: "Descargando resultados…", percent: 97 });
    const csv = await api.downloadCsv(cp.jobId, ctx.signal);
    const parsed = Papa.parse<GosomRow>(csv, { header: true, skipEmptyLines: true });
    const leads = parsed.data.map(mapGosomRow).filter((l): l is LeadInput => Boolean(l));
    await ctx.emit(leads);
    ctx.log(`gosom devolvió ${parsed.data.length} filas, ${leads.length} leads válidos`);
  },

  async cancel(checkpoint) {
    const cp = checkpoint as GosomCheckpoint | undefined;
    if (!cp?.jobId) return;
    try {
      await client().deleteJob(cp.jobId);
    } catch {
      /* si gosom no está levantado no hay nada que limpiar */
    }
  },
});

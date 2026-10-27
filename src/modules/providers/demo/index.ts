import { defineProvider, sleep } from "@/core/provider";
import type { LeadInput } from "@/core/lead";

/**
 * Proveedor de demostración: genera leads FICTICIOS al instante.
 * Sirve para probar la interfaz y como plantilla mínima para escribir
 * proveedores nuevos. No usar sus datos para nada real.
 */

const STREETS = ["Calle Mayor", "Av. de la Constitución", "Calle del Sol", "Paseo del Río", "Plaza Nueva"];
const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const SNIPPETS = [
  "Muy buena atención, volveré.",
  "Rápidos y profesionales.",
  "Precio correcto, aunque hubo que esperar.",
  "Recomendable al cien por cien.",
  "No me convenció el trato.",
];

// Generador determinista para que los mismos parámetros den los mismos leads.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function fakeLead(query: string, i: number): LeadInput {
  const r = rng(`${query}#${i}`);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const topic = query.split(/\s+en\s+/i)[0].trim() || "Negocio";
  const slug = `${topic}-${i + 1}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  const hasWeb = r() > 0.25;
  const rating = Math.round((3 + r() * 2) * 10) / 10;
  return {
    externalId: `demo-${slug}`,
    name: `${topic[0].toUpperCase()}${topic.slice(1)} Demo ${i + 1}`,
    category: topic,
    emails: hasWeb && r() > 0.4 ? [`info@${slug}.example`] : [],
    phone: r() > 0.1 ? `+34 6${Math.floor(10000000 + r() * 89999999)}` : undefined,
    website: hasWeb ? `https://${slug}.example` : undefined,
    address: `${pick(STREETS)} ${Math.ceil(r() * 120)}, Ciudad Demo`,
    rating,
    reviewCount: Math.floor(r() * 400),
    reviews: Array.from({ length: 3 }, (_, k) => ({
      author: `Usuario ${k + 1}`,
      rating: Math.max(1, Math.min(5, Math.round(rating + (r() - 0.5) * 2))),
      text: pick(SNIPPETS),
      date: `hace ${Math.ceil(r() * 11)} meses`,
    })),
    openingHours: Object.fromEntries(DAYS.map((d, k) => [d, k === 6 ? [] : ["9:00–14:00", "17:00–20:00"]])),
    latitude: 39.47 + (r() - 0.5) / 10,
    longitude: -0.37 + (r() - 0.5) / 10,
    url: undefined,
    extra: { demo: true },
  };
}

export default defineProvider({
  id: "demo",
  name: "Demo (datos ficticios)",
  description: "Genera leads inventados en segundos para probar la app sin levantar ningún scraper.",
  sourceId: "google-maps",
  options: [
    { key: "count", label: "Leads por consulta", type: "number", default: 30, min: 1, max: 500 },
  ],
  async health() {
    return { ok: true, message: "Siempre disponible" };
  },
  async run(params, ctx) {
    const count = Number(params.options.count);
    const total = params.queries.length * count;
    let done = 0;
    for (const q of params.queries) {
      for (let i = 0; i < count; i += 10) {
        await sleep(300, ctx.signal);
        const batch = Array.from({ length: Math.min(10, count - i) }, (_, k) => fakeLead(q, i + k));
        await ctx.emit(batch);
        done += batch.length;
        ctx.progress({ message: `Generando datos de prueba (${done}/${total})`, percent: Math.round((done / total) * 100) });
      }
    }
  },
});

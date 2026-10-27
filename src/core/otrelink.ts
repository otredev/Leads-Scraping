import type { Lead, OpeningHours } from "./lead";
import { whatsappNumber } from "./templates";

/**
 * Brief para crear la página de un negocio en Otrelink con Claude.
 *
 * La app no llama a Otrelink: prepara los datos (y un texto para Claude) para
 * que Claude, con el MCP de Otrelink conectado, cree la página. Así este
 * módulo no necesita claves ni depende de su API.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface WeeklyRange {
  day: Weekday;
  from: string;
  to: string;
}

export interface OtrelinkBlock {
  /** Tipo de bloque de Otrelink (list_block_types). */
  type: string;
  /** Campos ya rellenados para add_block. */
  fields: Record<string, unknown>;
  why: string;
}

export interface OtrelinkBrief {
  leadId: string;
  business: {
    name: string;
    category?: string;
    description?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    googleMapsUrl?: string;
    rating?: number;
    reviewCount?: number;
    imageUrl?: string;
    timezone?: string;
    hours?: WeeklyRange[];
    topReviews: { author?: string; rating?: number; text: string }[];
  };
  template: { id: string; why: string };
  blocks: OtrelinkBlock[];
}

// ---------------------------------------------------------------------------
// Horarios: "9:00–14:00", "9 a.m.–2 p.m.", "4–8 p.m.", "8–20", "Abierto 24 horas"

const DAY_NAMES: Record<string, Weekday> = {
  lunes: "mon", martes: "tue", miercoles: "wed", jueves: "thu", viernes: "fri", sabado: "sat", domingo: "sun",
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  lun: "mon", mar: "tue", mie: "wed", jue: "thu", vie: "fri", sab: "sat", dom: "sun",
  mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
};
const ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function toDay(name: string): Weekday | undefined {
  const k = plain(name).replace(/[^a-z]/g, "");
  return DAY_NAMES[k] ?? DAY_NAMES[k.slice(0, 3)];
}

interface Clock {
  h: number;
  m: number;
  ampm?: "am" | "pm";
}

function parseClock(raw: string): Clock | undefined {
  const s = plain(raw).replace(/\s+/g, "").replace(/\./g, "");
  const m = s.match(/^(\d{1,2})(?:[:h](\d{2}))?(am|pm)?$/);
  if (!m) return undefined;
  return { h: Number(m[1]), m: Number(m[2] ?? 0), ampm: m[3] as Clock["ampm"] };
}

function to24({ h, m, ampm }: Clock): string | undefined {
  let hour = h;
  if (ampm === "pm" && h < 12) hour += 12;
  if (ampm === "am" && h === 12) hour = 0;
  if (hour > 24 || m > 59) return undefined;
  return `${String(hour % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Convierte una franja de texto en { from, to } en formato 24 h. */
export function parseRange(raw: string): { from: string; to: string } | undefined {
  const text = plain(raw);
  if (/24\s*h|24\s*horas|24\s*hours/.test(text)) return { from: "00:00", to: "23:59" };
  if (/cerrado|closed/.test(text)) return undefined;
  const parts = text.split(/\s*[–—-]|\s+a\s+|\s+to\s+/).filter(Boolean);
  if (parts.length !== 2) return undefined;
  const a = parseClock(parts[0]);
  const b = parseClock(parts[1]);
  if (!a || !b) return undefined;
  // "4–8 p.m.": el inicio hereda am/pm del final si no lo trae y tiene sentido.
  if (!a.ampm && b.ampm) a.ampm = b.ampm === "pm" && a.h > b.h && a.h !== 12 && b.h !== 12 ? "am" : b.ampm;
  const from = to24(a);
  const to = to24(b);
  return from && to ? { from, to } : undefined;
}

/** Horario de Google Maps → lista semanal { day, from, to } (orden lunes→domingo). */
export function weeklyHours(hours?: OpeningHours): WeeklyRange[] | undefined {
  if (!hours) return undefined;
  const out: WeeklyRange[] = [];
  for (const [name, ranges] of Object.entries(hours)) {
    const day = toDay(name);
    if (!day) continue;
    for (const r of ranges ?? []) {
      for (const piece of r.split(/,\s*/)) {
        const range = parseRange(piece);
        if (range) out.push({ day, ...range });
      }
    }
  }
  out.sort((x, y) => ORDER.indexOf(x.day) - ORDER.indexOf(y.day) || x.from.localeCompare(y.from));
  return out.length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Plantilla según la categoría

const TEMPLATE_RULES: [RegExp, string, string][] = [
  [/restaur|cafe|cafeter|bar\b|bistro|pizz|hamburg|sushi|taquer|comida|food|brunch/, "restaurant-v1", "restaurante o cafetería: carta, horario, mapa y reseñas"],
  [/panader|pasteler|reposter|bakery|dulce|heladeri/, "bakery-v1", "panadería o pastelería: catálogo con pedidos por WhatsApp"],
  [/peluquer|barber|estetica|belleza|salon|spa|unas|manicur|beauty/, "salon-v1", "salón de belleza: servicios con reserva, galería y ubicación"],
  [/dent|clinic|medic|fisio|psicolog|veterin|optic|salud|podolog|health|doctor/, "clinic-v1", "clínica o salud: horario, citas, preguntas frecuentes y ubicación"],
  [/gimnas|gym|fitness|crossfit|yoga|pilates|entrenad/, "fitness-v1", "gimnasio o entrenador: clases, reservas y horario"],
  [/inmobil|real estate/, "realestate-v1", "inmobiliaria: inmueble destacado, contacto y mapa"],
  [/tienda|store|shop|boutique|ferreter|floris|libreri|jugueter/, "store-v1", "tienda: productos, promoción y preguntas frecuentes"],
  [/academ|escuela|colegio|profesor|clases|idiomas|autoescuela/, "teacher-v1", "academia: cursos, horarios y reservas"],
  [/abogad|asesor|consult|gestor|notar|contab|coach|marketing/, "coach-v1", "servicios profesionales: reservas, testimonios y preguntas"],
  [/viaje|turism|tour|agencia de viajes/, "tours-v1", "turismo: próximas salidas, paquetes y reseñas"],
  [/fotograf/, "photographer-v1", "fotografía: portfolio, paquetes y reservas"],
];

export function suggestTemplate(category?: string): { id: string; why: string } {
  const c = plain(category ?? "");
  for (const [re, id, why] of TEMPLATE_RULES) if (re.test(c)) return { id, why };
  return { id: "businesscard-v1", why: "tarjeta de negocio: contacto rápido, enlaces y mapa" };
}

// ---------------------------------------------------------------------------

/** Zona horaria por prefijo telefónico, si la fuente no la trae. */
const TZ_BY_PREFIX: [string, string][] = [
  ["+34", "Europe/Madrid"], ["+52", "America/Mexico_City"], ["+54", "America/Argentina/Buenos_Aires"],
  ["+57", "America/Bogota"], ["+56", "America/Santiago"], ["+51", "America/Lima"], ["+58", "America/Caracas"],
  ["+593", "America/Guayaquil"], ["+598", "America/Montevideo"], ["+351", "Europe/Lisbon"], ["+33", "Europe/Paris"],
  ["+39", "Europe/Rome"], ["+49", "Europe/Berlin"], ["+44", "Europe/London"],
];

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) return str(v.filter((x) => typeof x === "string").join(" "));
  return undefined;
}

function timezoneOf(lead: Lead): string | undefined {
  const fromSource = str(lead.extra.timezone);
  if (fromSource) return fromSource;
  const e164 = lead.phoneE164 ?? "";
  return TZ_BY_PREFIX.sort((a, b) => b[0].length - a[0].length).find(([p]) => e164.startsWith(p))?.[1];
}

function googleMapsLink(lead: Lead) {
  if (lead.url) return lead.url;
  const q = [lead.name, lead.address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : undefined;
}

/** Arma el brief de Otrelink para un lead. */
export function otrelinkBrief(lead: Lead): OtrelinkBrief {
  const whatsapp = whatsappNumber(lead);
  const hours = weeklyHours(lead.openingHours);
  const timezone = timezoneOf(lead);
  const description = str(lead.extra.descriptions) ?? str(lead.extra.description);
  const imageUrl = str(lead.extra.thumbnail);
  const maps = googleMapsLink(lead);
  const topReviews = lead.reviews
    .filter((r) => r.text && (r.rating ?? 5) >= 4)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.text?.length ?? 0) - (a.text?.length ?? 0))
    .slice(0, 3)
    .map((r) => ({ author: r.author, rating: r.rating, text: r.text!.slice(0, 280) }));

  const blocks: OtrelinkBlock[] = [];
  if (hours?.length) {
    blocks.push({
      type: "status",
      fields: { source: "hours", hours: hours.map((h, i) => ({ id: `h${i}`, ...h })), timezone: timezone ?? "UTC", style: "pill", customTexts: true, openText: "Abierto ahora", closedText: "Cerrado", closesText: "Hasta las {time}", opensTodayText: "Abre hoy a las {time}", opensTomorrowText: "Abre mañana a las {time}", opensLaterText: "Abre el {day} a las {time}" },
      why: "Muestra si está abierto ahora",
    });
  }
  if (lead.phone || whatsapp || lead.emails[0]) {
    blocks.push({
      type: "contact",
      fields: {
        ...(lead.phoneE164 || lead.phone ? { phone: lead.phoneE164 ?? lead.phone, phoneLabel: "Llamar" } : {}),
        ...(whatsapp ? { whatsapp: `+${whatsapp}`, whatsappLabel: "Escribir por WhatsApp", whatsappMessage: `Hola ${lead.name}, os escribo desde vuestra página.` } : {}),
        ...(lead.emails[0] ? { email: lead.emails[0], emailLabel: "Enviar un email" } : {}),
        layout: "stack",
      },
      why: "Contacto en un toque",
    });
  }
  if (lead.website) blocks.push({ type: "link", fields: { title: "Nuestra web", url: lead.website, icon: "website" }, why: "Enlace a su web" });
  if (description) blocks.push({ type: "text", fields: { text: description }, why: "Descripción del negocio" });
  const mapAddress = lead.address ?? (lead.latitude != null && lead.longitude != null ? `${lead.latitude},${lead.longitude}` : undefined);
  if (mapAddress) {
    blocks.push({
      type: "map",
      fields: { address: mapAddress, title: "Dónde estamos", directions: true, directionsLabel: "Cómo llegar" },
      why: "Ubicación con botón de cómo llegar",
    });
  }
  if (maps) {
    blocks.push({
      type: "link",
      fields: {
        title: lead.rating ? `${lead.rating.toLocaleString("es")} ★ en Google` : "Ver en Google Maps",
        ...(lead.reviewCount ? { subtitle: `${lead.reviewCount} reseñas` } : {}),
        url: maps,
      },
      why: "Prueba social y enlace a la ficha",
    });
  }
  const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));
  blocks.push({
    type: "vcard",
    fields: clean({
      label: "Datos de contacto",
      name: lead.name,
      org: lead.category,
      phone: lead.phoneE164 ?? lead.phone,
      email: lead.emails[0],
      website: lead.website,
      address: lead.address,
      downloadLabel: "Guardar contacto",
    }),
    why: "Guardar el contacto en el móvil",
  });
  blocks.push({ type: "share", fields: {}, why: "Compartir la página" });

  return {
    leadId: lead.id,
    business: {
      name: lead.name,
      category: lead.category,
      description,
      address: lead.address,
      latitude: lead.latitude,
      longitude: lead.longitude,
      phone: lead.phoneE164 ?? lead.phone,
      whatsapp: whatsapp ? `+${whatsapp}` : undefined,
      email: lead.emails[0],
      website: lead.website,
      googleMapsUrl: maps,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      imageUrl,
      timezone,
      hours,
      topReviews,
    },
    template: suggestTemplate(lead.category),
    blocks,
  };
}

/** Texto listo para pegar en Claude (con el MCP de Otrelink conectado). */
export function otrelinkPrompt(brief: OtrelinkBrief, opts: { leadsMcp?: boolean } = {}): string {
  const b = brief.business;
  const lines = [
    `Crea con Otrelink una página para el negocio "${b.name}"${b.category ? ` (${b.category})` : ""}.`,
    "",
    "Pasos:",
    `1. get_account y list_pages para ver el plan y el límite de páginas.`,
    `2. create_page con la plantilla "${brief.template.id}" (${brief.template.why}); si no encaja, elige otra con list_templates. Usa un slug corto basado en el nombre (check_slug).`,
    "3. Sustituye el contenido de ejemplo de la plantilla por los datos reales del negocio (business). Antes de cada add_block/update_block consulta get_block_type para usar los campos exactos; los bloques sugeridos son un punto de partida.",
    "4. No inventes datos: si falta algo (precios, servicios, fotos), deja el bloque fuera o márcalo para revisar.",
    "5. Textos en español. No publiques la página: déjala en borrador y dime el enlace para revisarla.",
  ];
  lines.push(
    opts.leadsMcp
      ? `6. Cuando esté creada, guarda el enlace en el lead con set_lead_page (leadId "${brief.leadId}").`
      : `6. Cuando esté creada, si tienes conectado el MCP de Leads Scraping guarda el enlace con set_lead_page (leadId "${brief.leadId}"); si no, dime el enlace.`,
  );
  lines.push("", "Datos (JSON):", "```json", JSON.stringify({ business: b, blocks: brief.blocks }, null, 2), "```");
  return lines.join("\n");
}

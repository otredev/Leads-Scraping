import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { defineEnricher } from "@/core/enricher";
import { extractFromHtml, mergeFindings, type PageFindings } from "./extract";

/**
 * Enriquecedor gratuito y sin claves: visita la web del negocio (portada y
 * hasta 3 páginas de contacto/aviso legal) y saca redes sociales, emails y
 * teléfonos de sus enlaces, del texto y de los datos estructurados (JSON-LD).
 */

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_EXTRA_PAGES = 3;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function privateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Evita que una web de un lead lleve al servidor a la red local (salvo ENRICH_ALLOW_LOCAL=1, para pruebas). */
async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Enlace no válido");
  if (process.env.ENRICH_ALLOW_LOCAL === "1") return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Dirección local");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (ips.some(privateIp)) throw new Error("Dirección local");
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** Descarga una página HTML siguiendo hasta 5 redirecciones (comprobando cada salto). */
async function fetchPage(raw: string, signal: AbortSignal): Promise<{ url: string; html: string }> {
  let url = new URL(raw);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "es,en;q=0.8" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      void res.body?.cancel();
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`La web respondió ${res.status}`);
    if (!/html/i.test(res.headers.get("content-type") ?? "html")) throw new Error("No es una página web");
    return { url: url.toString(), html: await readLimited(res) };
  }
  throw new Error("Demasiadas redirecciones");
}

function normalizeWebsite(w: string) {
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export default defineEnricher({
  id: "website-contacts",
  label: "Web del negocio",
  description: "Visita la web de cada lead y saca sus redes sociales (Instagram, Facebook, TikTok, LinkedIn…), emails y teléfono. Gratis y sin claves.",
  provides: ["socials", "emails", "phone"],
  requirement: "Necesita que el lead tenga web",
  concurrency: 4,
  canEnrich: (lead) => Boolean(lead.website),
  async health() {
    return { ok: true, message: "Listo. No necesita claves." };
  },
  async enrich(lead, { signal }) {
    if (!lead.website) return { note: "Sin web" };
    let home: { url: string; html: string };
    try {
      home = await fetchPage(normalizeWebsite(lead.website), signal);
    } catch (err) {
      const msg = (err as Error).name === "TimeoutError" ? "La web no responde" : (err as Error).message;
      return { note: msg.startsWith("La web") || msg.startsWith("Dirección") ? msg : `No se pudo abrir la web (${msg})` };
    }
    const pages: PageFindings[] = [extractFromHtml(home.html, home.url)];
    for (const extra of pages[0].contactPages.slice(0, MAX_EXTRA_PAGES)) {
      if (signal.aborted) break;
      try {
        const p = await fetchPage(extra, signal);
        pages.push(extractFromHtml(p.html, p.url));
      } catch {
        /* una página de contacto que falla no impide usar el resto */
      }
    }
    const found = mergeFindings(pages, home.url);
    const n = Object.keys(found.socials).length + found.emails.length;
    return {
      emails: found.emails,
      socials: found.socials,
      phone: found.phones[0],
      extra: { pages: pages.length, checkedAt: new Date().toISOString() },
      note: n ? undefined : "No se encontraron redes ni emails en su web",
    };
  },
});

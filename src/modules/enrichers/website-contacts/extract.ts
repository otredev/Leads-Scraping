import { parseSocialUrl, type SocialNetwork, type Socials } from "@/core/socials";

/** Lo que se encuentra en una página. */
export interface PageFindings {
  emails: string[];
  phones: string[];
  /** Enlaces a perfiles con cuántas veces aparecen (y si vienen de datos estructurados). */
  socials: { network: SocialNetwork; url: string; weight: number }[];
  /** Enlaces internos que suelen tener los datos de contacto. */
  contactPages: string[];
}

const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|avif|ico|css|js|mjs|woff2?|ttf|mp4|webm|pdf)$/i;
const IGNORED_EMAIL_DOMAINS = [
  "example.com", "example.org", "domain.com", "email.com", "yourdomain.com", "tudominio.com", "dominio.com", "sentry.io",
  "wixpress.com", "sentry-next.wixpress.com", "godaddy.com", "squarespace.com", "w3.org", "schema.org", "mysite.com",
];
const CONTACT_PATH = /(contact|contacto|contactar|contacte|about|nosotros|quienes|sobre|aviso-legal|legal|impressum|equipo|empresa)/i;

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Emails ofuscados por Cloudflare (data-cfemail="…"). */
function decodeCfEmail(hex: string) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

export function cleanEmail(raw: string): string | undefined {
  const e = decodeURIComponent(raw.replace(/^mailto:/i, "").split("?")[0]).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e)) return undefined;
  if (ASSET_EXT.test(e)) return undefined; // logo@2x.png
  const domain = e.split("@")[1];
  if (IGNORED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return undefined;
  return e;
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* JSON-LD mal formado: se ignora */
    }
  }
  return out;
}

/** Recorre el JSON-LD buscando sameAs, email y telephone. */
function walkJsonLd(node: unknown, acc: { sameAs: string[]; emails: string[]; phones: string[] }) {
  if (Array.isArray(node)) return node.forEach((n) => walkJsonLd(n, acc));
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => typeof x === "string");
  acc.sameAs.push(...list(o.sameAs));
  acc.emails.push(...list(o.email));
  acc.phones.push(...list(o.telephone));
  for (const v of Object.values(o)) if (v && typeof v === "object") walkJsonLd(v, acc);
}

/** Extrae emails, teléfonos, redes y páginas de contacto de un HTML. */
export function extractFromHtml(html: string, pageUrl: string): PageFindings {
  const base = new URL(pageUrl);
  const emails = new Set<string>();
  const phones = new Set<string>();
  const socialCount = new Map<string, { network: SocialNetwork; url: string; weight: number }>();
  const contactPages = new Set<string>();

  const addSocial = (href: string, weight: number) => {
    const s = parseSocialUrl(href);
    if (!s) return;
    const prev = socialCount.get(s.url);
    socialCount.set(s.url, { ...s, weight: (prev?.weight ?? 0) + weight });
  };

  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = decodeEntities(m[1]).trim();
    if (/^mailto:/i.test(raw)) {
      const e = cleanEmail(raw);
      if (e) emails.add(e);
      continue;
    }
    if (/^tel:/i.test(raw)) {
      const p = decodeURIComponent(raw.slice(4)).replace(/[^\d+]/g, "");
      if (p.replace(/\D/g, "").length >= 7) phones.add(p);
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    if (abs.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) {
      if (CONTACT_PATH.test(abs.pathname) && !ASSET_EXT.test(abs.pathname)) {
        abs.hash = "";
        contactPages.add(abs.toString());
      }
    } else {
      addSocial(abs.toString(), 1);
    }
  }

  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) {
    const e = cleanEmail(decodeCfEmail(m[1]));
    if (e) emails.add(e);
  }

  // Texto visible (sin scripts ni estilos) para emails escritos a mano.
  const text = decodeEntities(
    html
      .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s*(\[at\]|\(at\)|\[arroba\]|\(arroba\))\s*/gi, "@");
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = cleanEmail(m[0]);
    if (e) emails.add(e);
  }

  const ld = { sameAs: [] as string[], emails: [] as string[], phones: [] as string[] };
  for (const block of jsonLdBlocks(html)) walkJsonLd(block, ld);
  ld.sameAs.forEach((u) => addSocial(u, 5)); // los datos estructurados pesan más
  ld.emails.map(cleanEmail).forEach((e) => e && emails.add(e));
  ld.phones.forEach((p) => p.replace(/\D/g, "").length >= 7 && phones.add(p.trim()));

  return { emails: [...emails], phones: [...phones], socials: [...socialCount.values()], contactPages: [...contactPages] };
}

/** Une varias páginas: un perfil por red (el más citado) y emails del dominio primero. */
export function mergeFindings(pages: PageFindings[], website: string) {
  const domain = new URL(website).hostname.replace(/^www\./, "");
  const emails = [...new Set(pages.flatMap((p) => p.emails))].sort(
    (a, b) => Number(b.endsWith(`@${domain}`) || b.endsWith(`.${domain}`)) - Number(a.endsWith(`@${domain}`) || a.endsWith(`.${domain}`)),
  );
  const best = new Map<SocialNetwork, { url: string; weight: number }>();
  const totals = new Map<string, { network: SocialNetwork; url: string; weight: number }>();
  for (const s of pages.flatMap((p) => p.socials)) {
    const prev = totals.get(s.url);
    totals.set(s.url, { ...s, weight: (prev?.weight ?? 0) + s.weight });
  }
  for (const s of totals.values()) {
    const cur = best.get(s.network);
    if (!cur || s.weight > cur.weight) best.set(s.network, s);
  }
  const socials: Socials = Object.fromEntries([...best].map(([k, v]) => [k, v.url]));
  return { emails: emails.slice(0, 5), phones: [...new Set(pages.flatMap((p) => p.phones))], socials };
}

/**
 * Detección de URLs de Google Maps pegadas en "Qué y dónde buscar".
 *
 * Formatos admitidos:
 *   https://www.google.com/maps/search/pizza/@39.47,-0.37,14z/…   búsqueda (con zona y filtros)
 *   https://www.google.es/maps/place/Nombre/@39.47,-0.37,17z/…     ficha de un negocio
 *   https://maps.google.com/maps?q=pizza&z=16                      búsqueda por parámetro
 *   https://maps.app.goo.gl/abc123  (o sin https://)               enlace corto para compartir
 */

export type MapsUrlKind = "search" | "place" | "short" | "map";

export interface MapsUrlInfo {
  url: string;
  kind: MapsUrlKind;
  /** Texto buscado o nombre del negocio, si viene en la URL. */
  query?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  /** Descripción legible para la interfaz. */
  label: string;
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  } catch {
    return s.replace(/\+/g, " ").trim();
  }
};

export function parseMapsUrl(line: string): MapsUrlInfo | undefined {
  const raw = line.trim();
  if (!raw) return undefined;

  // Enlaces cortos (con o sin esquema).
  if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(raw)) {
    return { url: raw, kind: "short", label: "Enlace corto de Google Maps" };
  }
  if (!/^https?:\/\//i.test(raw)) return undefined;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(host);
  if (!isGoogle || !(u.pathname.startsWith("/maps") || host.startsWith("maps."))) return undefined;

  const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
  const lat = at ? Number(at[1]) : undefined;
  const lng = at ? Number(at[2]) : undefined;
  const zoom = at ? Number(at[3]) : u.searchParams.get("z") ? Number(u.searchParams.get("z")) : undefined;
  const where = lat !== undefined && lng !== undefined ? ` · zona ${lat.toFixed(3)}, ${lng.toFixed(3)}` : "";

  const search = u.pathname.match(/\/maps\/search\/([^/@]+)/);
  if (search) {
    const query = decode(search[1]);
    return { url: raw, kind: "search", query, lat, lng, zoom, label: `Búsqueda “${query}”${where}` };
  }
  const place = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (place) {
    const query = decode(place[1]);
    return { url: raw, kind: "place", query, lat, lng, zoom, label: `Ficha de “${query}”` };
  }
  const q = u.searchParams.get("q") ?? u.searchParams.get("query");
  if (q) {
    const query = decode(q);
    return { url: raw, kind: "search", query, lat, lng, zoom, label: `Búsqueda “${query}”${where}` };
  }
  return { url: raw, kind: "map", lat, lng, zoom, label: `Mapa de Google Maps${where}` };
}

/** Nombre legible para una búsqueda a partir de sus líneas (URLs incluidas). */
export function describeQueries(queries: string[]): string {
  return queries
    .map((q) => {
      const info = parseMapsUrl(q);
      if (!info) return q;
      return info.query ? `${info.query} (URL)` : info.label;
    })
    .join(", ");
}

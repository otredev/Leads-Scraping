/** Redes sociales que se reconocen en las webs de los negocios. */
export const SOCIAL_NETWORKS = [
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { id: "x", label: "X (Twitter)", hosts: ["x.com", "twitter.com"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "api.whatsapp.com", "whatsapp.com"] },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"] },
  { id: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pinterest.es"] },
  { id: "threads", label: "Threads", hosts: ["threads.net", "threads.com"] },
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]["id"];
export type Socials = Partial<Record<SocialNetwork, string>>;

export const socialLabel = (id: string) => SOCIAL_NETWORKS.find((n) => n.id === id)?.label ?? id;

/** Rutas que no son perfiles (botones de compartir, publicaciones sueltas, widgets…). */
const NOT_PROFILE = new Set([
  "sharer", "sharer.php", "share", "share.php", "intent", "plugins", "dialog", "tr", "p", "reel", "reels", "explore",
  "watch", "embed", "hashtag", "home", "login", "signup", "privacy", "legal", "help", "policies", "search", "pin",
  "events", "groups", "stories", "tv", "shorts", "results", "feed",
]);

/**
 * Convierte un enlace en el perfil de una red (o undefined si no es un perfil).
 * Normaliza a https://<host>/<perfil> sin parámetros.
 */
export function parseSocialUrl(raw: string): { network: SocialNetwork; url: string } | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^\/\//, "https://"));
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web|es|business)\./, "");
  const net = SOCIAL_NETWORKS.find((n) => (n.hosts as readonly string[]).some((h) => host === h || host.endsWith(`.${h}`)));
  if (!net) return undefined;
  const parts = u.pathname.split("/").filter(Boolean);

  if (net.id === "whatsapp") {
    const phone = (host === "wa.me" ? parts[0] : u.searchParams.get("phone"))?.replace(/\D/g, "");
    return phone && phone.length >= 8 ? { network: "whatsapp", url: `https://wa.me/${phone}` } : undefined;
  }
  if (!parts.length || NOT_PROFILE.has(parts[0].toLowerCase())) return undefined;

  let path: string;
  if (net.id === "facebook" && parts[0] === "profile.php") {
    const id = u.searchParams.get("id");
    if (!id) return undefined;
    return { network: "facebook", url: `https://www.facebook.com/profile.php?id=${id}` };
  } else if (net.id === "linkedin") {
    if (!["company", "in", "school", "showcase"].includes(parts[0]) || !parts[1]) return undefined;
    path = `${parts[0]}/${parts[1]}`;
  } else if (net.id === "youtube") {
    path = ["channel", "c", "user"].includes(parts[0]) && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0].startsWith("@") ? parts[0] : "";
    if (!path) return undefined;
  } else if (net.id === "tiktok") {
    if (!parts[0].startsWith("@")) return undefined;
    path = parts[0];
  } else if (net.id === "facebook" && parts[0] === "pages" && parts[1]) {
    path = parts.slice(0, 3).join("/");
  } else {
    path = parts[0];
  }
  if (!/^[\w.@%-]+(\/[\w.@%-]+)*$/.test(path)) return undefined;
  const canonicalHost = { x: "x.com", whatsapp: "wa.me", telegram: "t.me" }[net.id as string] ?? `www.${net.hosts[0]}`;
  return { network: net.id, url: `https://${canonicalHost}/${path}` };
}

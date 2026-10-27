import type { MetadataRoute } from "next";

/** Manifiesto de la PWA: permite instalar la app en el escritorio o el móvil. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Leads Scraping",
    short_name: "Leads",
    description: "Extrae, organiza y contacta leads de negocios locales.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nueva búsqueda", url: "/busquedas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Leads", url: "/leads", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tareas", url: "/tareas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Calendario", url: "/calendario", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

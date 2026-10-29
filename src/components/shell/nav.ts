import {
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  ListFilter,
  MessageSquare,
  Search,
  Settings,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Menú lateral (por categorías) y el índice del buscador universal.
 * Para añadir una página: ponla en NAV_GROUPS y, si tiene secciones o
 * pestañas, añádelas a SECTIONS con palabras clave.
 */

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Palabras clave para el buscador. */
  keywords: string;
}

export interface NavGroup {
  /** Sin título: va arriba del todo (Panel). */
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Panel", Icon: LayoutDashboard, keywords: "inicio resumen métricas estadísticas embudo conversión hoy" }] },
  {
    label: "Prospección",
    items: [
      { href: "/busquedas", label: "Búsquedas", Icon: Search, keywords: "nueva búsqueda google maps scraping gosom extraer negocios url repetir historial" },
      { href: "/resultados", label: "Resultados", Icon: ListFilter, keywords: "encontrados filtrar ordenar exportar csv json guardar visibles" },
      { href: "/leads", label: "Leads", Icon: Users, keywords: "crm tabla lista tablero kanban mapa etapas etiquetas no contactar importar csv puntuación completar redes emails" },
    ],
  },
  {
    label: "Clientes",
    items: [
      { href: "/clientes", label: "Clientes", Icon: Briefcase, keywords: "proyectos hitos cronograma pagos presupuesto horas portal convertir lead" },
      { href: "/mensajes", label: "Mensajes", Icon: MessageSquare, keywords: "chat conversación responder notas internas portal sin leer" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/documentos", label: "Documentos", Icon: FileText, keywords: "propuestas contratos facturas presupuestos plantillas pdf firmar verifactu" },
      { href: "/finanzas", label: "Finanzas", Icon: ChartNoAxesCombined, keywords: "gastos beneficio rentabilidad ingresos inversión roi canales" },
    ],
  },
  {
    label: "Agenda",
    items: [
      { href: "/tareas", label: "Tareas", Icon: CalendarCheck, keywords: "pendientes seguimiento recordatorios vencidas hoy" },
      { href: "/calendario", label: "Calendario", Icon: CalendarDays, keywords: "mes semana fechas entregas hitos agenda" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/ajustes", label: "Ajustes", Icon: Settings, keywords: "configuración preferencias" },
      { href: "/perfil", label: "Perfil", Icon: UserRound, keywords: "cuenta usuario contraseña email sesiones dispositivos cerrar sesión recuperación eliminar cuenta token claude" },
      { href: "/papelera", label: "Papelera", Icon: Trash2, keywords: "borrados restaurar eliminar" },
      { href: "/ayuda", label: "Ayuda", Icon: BookOpen, keywords: "guías documentación manual cómo" },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export interface SearchEntry {
  title: string;
  /** Página (o grupo) a la que pertenece, para mostrarlo debajo. */
  context: string;
  href: string;
  keywords: string;
  kind: "page" | "section" | "help";
}

/** Secciones y pestañas dentro de las páginas. */
export const SECTIONS: SearchEntry[] = [
  // Ajustes
  { title: "Base de datos", context: "Ajustes · General", href: "/ajustes?seccion=general#base-de-datos", keywords: "mongodb atlas almacenamiento conexión json país teléfonos papelera días", kind: "section" },
  { title: "Copia de seguridad", context: "Ajustes · General", href: "/ajustes?seccion=general#copia", keywords: "backup descargar restaurar importar exportar json datos locales", kind: "section" },
  { title: "Etapas y etiquetas", context: "Ajustes · CRM", href: "/ajustes?seccion=crm#etapas", keywords: "etapas embudo etiquetas colores valoración baja crm", kind: "section" },
  { title: "Plantillas de mensaje", context: "Ajustes · CRM", href: "/ajustes?seccion=crm#plantillas", keywords: "whatsapp email plantillas variables contacto", kind: "section" },
  { title: "Marca del portal", context: "Ajustes · Portal del cliente", href: "/ajustes?seccion=portal#portal", keywords: "nombre negocio marca bienvenida whatsapp teléfono web email cloudflare conexión portal_url", kind: "section" },
  { title: "Avisos a tus clientes", context: "Ajustes · Portal del cliente", href: "/ajustes?seccion=portal#avisos-clientes", keywords: "push notificaciones clientes portal avisos móvil", kind: "section" },
  { title: "Datos legales", context: "Ajustes · Portal del cliente", href: "/ajustes?seccion=portal#datos-legales", keywords: "titular nif cif domicilio razón social registro aviso legal privacidad cookies rgpd", kind: "section" },
  { title: "Ajustes de documentos", context: "Ajustes · Documentos y finanzas", href: "/ajustes?seccion=facturacion#documentos", keywords: "iva irpf retención iban vencimiento pie de factura cobro", kind: "section" },
  { title: "Ajustes de finanzas", context: "Ajustes · Documentos y finanzas", href: "/ajustes?seccion=facturacion#finanzas", keywords: "coste hora moneda euros", kind: "section" },
  { title: "Notificaciones push", context: "Ajustes · Notificaciones y app", href: "/ajustes?seccion=notificaciones#push", keywords: "push avisos alertas dispositivos móvil recordatorios vapid", kind: "section" },
  { title: "Instalar la app", context: "Ajustes · Notificaciones y app", href: "/ajustes?seccion=notificaciones#instalar", keywords: "pwa instalar escritorio icono aplicación", kind: "section" },
  { title: "Claude (MCP)", context: "Ajustes · Integraciones", href: "/ajustes?seccion=integraciones#claude", keywords: "claude mcp ia asistente token conector otrelink", kind: "section" },
  { title: "Proveedores", context: "Ajustes · Módulos", href: "/ajustes?seccion=modulos#proveedores", keywords: "gosom scraper demo apify proveedor módulos", kind: "section" },
  { title: "Enriquecedores", context: "Ajustes · Módulos", href: "/ajustes?seccion=modulos#enriquecedores", keywords: "redes sociales emails web completar datos módulos", kind: "section" },
  { title: "Fuentes y exportación", context: "Ajustes · Módulos", href: "/ajustes?seccion=modulos#fuentes", keywords: "fuentes google maps formatos csv json exportar", kind: "section" },
  // Finanzas
  { title: "Resumen", context: "Finanzas", href: "/finanzas?vista=resumen", keywords: "ingresos gastos beneficio neto margen mes cuenta de resultados recomendaciones", kind: "section" },
  { title: "Rentabilidad por cliente", context: "Finanzas", href: "/finanzas?vista=clientes", keywords: "clientes beneficio margen euros por hora rentable", kind: "section" },
  { title: "Gastos", context: "Finanzas", href: "/finanzas?vista=gastos", keywords: "gastos suscripciones colaboradores añadir gasto recurrentes", kind: "section" },
  { title: "Inversión y retorno", context: "Finanzas", href: "/finanzas?vista=inversion", keywords: "roi retorno canales captación coste por cliente lead segmentos sector ciudad recurrentes", kind: "section" },
  // Documentos
  { title: "Propuestas", context: "Documentos", href: "/documentos?tipo=propuestas", keywords: "propuestas presupuestos aceptar", kind: "section" },
  { title: "Contratos", context: "Documentos", href: "/documentos?tipo=contratos", keywords: "contratos firmar firma", kind: "section" },
  { title: "Facturas", context: "Documentos", href: "/documentos?tipo=facturas", keywords: "facturas emitir rectificativa cobrada qr verifactu registro huella", kind: "section" },
  { title: "Plantillas de documentos", context: "Documentos", href: "/documentos?tipo=plantillas", keywords: "plantillas variables propuesta contrato factura", kind: "section" },
];

export function pageEntries(): SearchEntry[] {
  return NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ title: i.label, context: g.label ?? "Inicio", href: i.href, keywords: i.keywords, kind: "page" as const })));
}

/** Sin tildes, en minúsculas. */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Busca por palabras: todas deben aparecer (al principio de alguna palabra) en
 * el título, el contexto o las palabras clave. Puntúa más si están en el título.
 */
export function searchEntries(entries: SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of entries) {
    const title = normalize(e.title);
    const all = ` ${title} ${normalize(e.context)} ${normalize(e.keywords)}`;
    let score = 0;
    let ok = true;
    let inTitle = false;
    for (const w of words) {
      if (title.startsWith(w)) {
        score += 6;
        inTitle = true;
      } else if (title.includes(` ${w}`)) {
        score += 4;
        inTitle = true;
      } else if (all.includes(` ${w}`)) score += 2;
      else if (w.length >= 4 && all.includes(w)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    // Si coincide el título, primero la página; si solo coinciden palabras clave, lo más concreto (la sección).
    score += inTitle ? (e.kind === "page" ? 2 : e.kind === "section" ? 1 : 0) : e.kind === "section" ? 1 : 0;
    scored.push({ e, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title, "es"))
    .slice(0, limit)
    .map((s) => s.e);
}

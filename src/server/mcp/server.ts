import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { leadDedupeKey, type Lead, type SavedLead } from "@/core/lead";
import { CONTACT_CHANNELS, LABEL_COLORS, type ContactChannel, type CrmSettings, type LabelColor, type LeadUpdate } from "@/core/crm";
import { buildFields } from "@/core/fields";
import { queryLeads, type LeadFilters, type LeadSort } from "@/core/query";
import { autoTags, leadScore } from "@/core/score";
import { taskBucket, googleCalendarLink } from "@/core/calendar";
import { mailtoLink, renderTemplate, whatsappLink } from "@/core/templates";
import { otrelinkBrief, otrelinkPrompt } from "@/core/otrelink";
import { createTag, saveResults, trashSaved, updateSaved } from "../crm";
import { getProvider, getStore, providers } from "../registry";
import { startSearch } from "../runner";
import { getStats } from "../stats";
import { createTask, listTasks, updateTask } from "../tasks";

/**
 * Servidor MCP: expone el CRM a Claude (u otro cliente MCP).
 *
 * Las herramientas llaman a las mismas funciones que la API HTTP, así que
 * validaciones, almacenamiento y reglas (p. ej. "no contactar") son idénticas.
 */

const VERSION = "1.0.0";
const COLOR_IDS = LABEL_COLORS.map((c) => c.id) as [LabelColor, ...LabelColor[]];

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

/** Ejecuta una herramienta devolviendo los errores como texto para Claude. */
function run<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return json(await fn(args));
    } catch (err) {
      return fail((err as Error).message || "Error inesperado");
    }
  };
}

const badRequest = (m: string) => Object.assign(new Error(m), { status: 400 });

// ── Resolución por id o por nombre (Claude suele usar nombres) ──

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function resolveStage(settings: CrmSettings, v?: string) {
  if (!v) return undefined;
  const s = settings.stages.find((st) => st.id === v || norm(st.name) === norm(v));
  if (!s) throw badRequest(`Etapa desconocida: "${v}". Disponibles: ${settings.stages.map((st) => st.name).join(", ")}`);
  return s.id;
}

function findTag(settings: CrmSettings, v: string) {
  return settings.tags.find((t) => t.id === v || norm(t.name) === norm(v));
}

async function resolveTags(settings: CrmSettings, names: string[] | undefined, create: boolean) {
  const ids: string[] = [];
  for (const n of names ?? []) {
    const t = findTag(settings, n);
    if (t) ids.push(t.id);
    else if (create) ids.push((await createTag(n)).tag.id);
    else throw badRequest(`Etiqueta desconocida: "${n}". Usa createMissingTags para crearla.`);
  }
  return ids;
}

// ── Formatos compactos para no llenar el contexto de Claude ──

function summary(l: SavedLead, settings: CrmSettings) {
  return {
    id: l.id,
    name: l.name,
    category: l.category,
    stage: settings.stages.find((s) => s.id === l.stage)?.name ?? l.stage,
    tags: l.tags.map((t) => settings.tags.find((x) => x.id === t)?.name ?? t),
    color: l.color,
    phone: l.phone,
    email: l.emails[0],
    website: l.website,
    address: l.address,
    rating: l.rating,
    reviewCount: l.reviewCount,
    score: leadScore(l),
    lastContactAt: l.lastContactAt,
    pageUrl: l.pageUrl,
    doNotContact: l.doNotContact ? true : undefined,
  };
}

function resultSummary(l: Lead, savedKeys: Set<string>) {
  return {
    id: l.id,
    searchId: l.searchId,
    name: l.name,
    category: l.category,
    phone: l.phone,
    email: l.emails[0],
    website: l.website,
    address: l.address,
    rating: l.rating,
    reviewCount: l.reviewCount,
    score: leadScore(l),
    saved: savedKeys.has(l.id) || undefined,
  };
}

const filterShape = {
  q: z.string().optional().describe("Texto libre: nombre, dirección, categoría, teléfono, web o email"),
  category: z.string().optional().describe("Categoría exacta (tal como aparece en los leads)"),
  minRating: z.number().min(0).max(5).optional(),
  minReviews: z.number().int().min(0).optional(),
  minScore: z.number().int().min(0).max(100).optional().describe("Puntuación mínima del lead (0-100)"),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  noWebsite: z.boolean().optional().describe("Solo negocios sin web"),
};

const sortShape = {
  sortBy: z.string().optional().describe("Campo: name, rating, reviewCount, score, category, savedAt, lastContactAt…"),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(200).optional().describe("Máximo de filas (por defecto 25)"),
  offset: z.number().int().min(0).optional(),
};

function page<T>(rows: T[], limit = 25, offset = 0) {
  return { total: rows.length, offset, returned: Math.min(limit, Math.max(0, rows.length - offset)), rows: rows.slice(offset, offset + limit) };
}

export function createMcpServer() {
  const server = new McpServer(
    { name: "leads-scraping", title: "Leads Scraping", version: VERSION },
    {
      instructions: [
        "CRM local de leads sacados de Google Maps.",
        "Flujo típico: start_search → get_search hasta que termine → list_results → save_results → trabajar los leads con list_leads/get_lead/update_lead, tareas y mensajes.",
        "Etapas y etiquetas se pueden indicar por nombre. Respeta 'doNotContact': no prepares mensajes para esos leads.",
        "Para crear la página de un negocio en Otrelink usa otrelink_brief y, al terminar, set_lead_page con el enlace.",
      ].join(" "),
    },
  );

  server.registerTool(
    "get_overview",
    {
      title: "Resumen del CRM",
      description: "Métricas generales, embudo por etapa, etapas, etiquetas, plantillas y tareas pendientes. Úsalo primero para orientarte.",
      annotations: { readOnlyHint: true },
    },
    run(async () => {
      const store = getStore();
      const [stats, settings, tasks] = await Promise.all([getStats(), store.getSettings(), store.listTasks()]);
      const buckets = { overdue: 0, today: 0, upcoming: 0 };
      for (const t of tasks) {
        const b = taskBucket(t);
        if (b !== "done") buckets[b]++;
      }
      return {
        results: { total: stats.total, withEmail: stats.withEmail, withPhone: stats.withPhone, withWebsite: stats.withWebsite, avgRating: stats.avgRating },
        savedLeads: stats.saved,
        funnel: stats.funnel,
        stages: settings.stages.map((s) => ({ id: s.id, name: s.name })),
        tags: settings.tags.map((t) => ({ id: t.id, name: t.name })),
        templates: settings.templates.map((t) => ({ id: t.id, name: t.name, channel: t.channel })),
        tasks: buckets,
        providers: providers.map((p) => ({ id: p.id, name: p.name, acceptsMapsUrls: Boolean(p.acceptsMapsUrls) })),
      };
    }),
  );

  // ── Leads guardados ──

  server.registerTool(
    "list_leads",
    {
      title: "Listar leads",
      description: "Busca entre los leads guardados en el CRM con filtros y orden. Devuelve un resumen por lead; usa get_lead para el detalle.",
      inputSchema: {
        ...filterShape,
        stage: z.string().optional().describe("Etapa (id o nombre)"),
        tag: z.string().optional().describe("Etiqueta (id o nombre). Automáticas: auto:no-web, auto:no-contact, auto:low-rating"),
        color: z.enum(COLOR_IDS).optional(),
        doNotContact: z.enum(["hide", "only"]).optional().describe("hide oculta los 'no contactar'; only muestra solo esos"),
        ...sortShape,
      },
      annotations: { readOnlyHint: true },
    },
    run(async (a: Record<string, unknown> & { limit?: number; offset?: number; sortBy?: string; sortDir?: "asc" | "desc" }) => {
      const store = getStore();
      const [leads, settings] = await Promise.all([store.listSavedLeads(), store.getSettings()]);
      const tag = typeof a.tag === "string" ? (a.tag.startsWith("auto:") ? a.tag : (findTag(settings, a.tag)?.id ?? a.tag)) : undefined;
      const filters: LeadFilters = {
        q: a.q as string | undefined,
        category: a.category as string | undefined,
        minRating: a.minRating as number | undefined,
        minReviews: a.minReviews as number | undefined,
        minScore: a.minScore as number | undefined,
        hasEmail: a.hasEmail as boolean | undefined,
        hasPhone: a.hasPhone as boolean | undefined,
        hasWebsite: a.hasWebsite as boolean | undefined,
        noWebsite: a.noWebsite as boolean | undefined,
        stage: resolveStage(settings, a.stage as string | undefined),
        tag,
        color: a.color as string | undefined,
        dnc: a.doNotContact as LeadFilters["dnc"],
      };
      const sort: LeadSort | undefined = a.sortBy ? { field: a.sortBy, dir: a.sortDir ?? "desc" } : { field: "score", dir: "desc" };
      const rows = queryLeads(leads, filters, sort, { lowRating: settings.lowRating, fields: buildFields("saved", settings) });
      return page(
        rows.map((l) => summary(l, settings)),
        a.limit,
        a.offset,
      );
    }),
  );

  server.registerTool(
    "get_lead",
    {
      title: "Ficha de un lead",
      description: "Todos los datos de un lead guardado: contacto, horario, reseñas, notas, historial de contacto y tareas.",
      inputSchema: { id: z.string().describe("Id del lead guardado") },
      annotations: { readOnlyHint: true },
    },
    run(async ({ id }: { id: string }) => {
      const store = getStore();
      const [lead, settings, tasks] = await Promise.all([store.getSavedLead(id), store.getSettings(), listTasks(id)]);
      if (!lead) throw badRequest("Lead no encontrado");
      return {
        ...summary(lead, settings),
        emails: lead.emails,
        phoneE164: lead.phoneE164,
        latitude: lead.latitude,
        longitude: lead.longitude,
        googleMapsUrl: lead.url,
        openingHours: lead.openingHours,
        autoTags: autoTags(lead, settings.lowRating),
        reviews: lead.reviews.slice(0, 5),
        notes: lead.notes,
        doNotContact: lead.doNotContact,
        contacts: (lead.contacts ?? []).slice(0, 10),
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, done: t.done })),
        savedAt: lead.savedAt,
        inTrash: Boolean(lead.deletedAt) || undefined,
      };
    }),
  );

  server.registerTool(
    "update_lead",
    {
      title: "Actualizar leads",
      description: "Cambia etapa, color, etiquetas, notas o 'no contactar' de uno o varios leads guardados.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(500).describe("Ids de los leads"),
        stage: z.string().optional().describe("Nueva etapa (id o nombre)"),
        color: z.enum(COLOR_IDS).nullable().optional().describe("Color de etiqueta; null lo quita"),
        addTags: z.array(z.string()).optional().describe("Etiquetas a añadir (id o nombre)"),
        removeTags: z.array(z.string()).optional(),
        createMissingTags: z.boolean().optional().describe("Crea las etiquetas de addTags que no existan"),
        addNote: z.string().max(5000).optional().describe("Añade una nota (solo con un lead)"),
        doNotContact: z.union([z.boolean(), z.string()]).optional().describe("true o motivo para marcar 'no contactar'; false lo quita"),
      },
      annotations: { idempotentHint: false },
    },
    run(async (a: { ids: string[]; stage?: string; color?: LeadUpdate["color"]; addTags?: string[]; removeTags?: string[]; createMissingTags?: boolean; addNote?: string; doNotContact?: boolean | string }) => {
      const settings = await getStore().getSettings();
      if (a.addNote && a.ids.length > 1) throw badRequest("Las notas se añaden de un lead en uno.");
      const update: Record<string, unknown> = {
        stage: resolveStage(settings, a.stage),
        color: a.color,
        addTags: await resolveTags(settings, a.addTags, Boolean(a.createMissingTags)),
        removeTags: (a.removeTags ?? []).map((n) => findTag(settings, n)?.id ?? n),
        addNote: a.addNote,
        doNotContact: a.doNotContact,
      };
      return { updated: await updateSaved(a.ids, update) };
    }),
  );

  server.registerTool(
    "trash_leads",
    {
      title: "Mover a la papelera",
      description: "Mueve leads guardados a la papelera (se pueden restaurar desde la app hasta que caduquen).",
      inputSchema: { ids: z.array(z.string()).min(1).max(500) },
      annotations: { destructiveHint: true },
    },
    run(async ({ ids }: { ids: string[] }) => ({ trashed: await trashSaved(ids) })),
  );

  // ── Búsquedas y resultados ──

  server.registerTool(
    "start_search",
    {
      title: "Nueva búsqueda en Google Maps",
      description:
        "Lanza una búsqueda (se ejecuta en segundo plano). Cada consulta es como en Google Maps: 'dentistas en Valencia'. También acepta URLs de Google Maps con gosom. Después usa get_search para ver el progreso.",
      inputSchema: {
        queries: z.array(z.string().min(2)).min(1).max(50),
        providerId: z.string().optional().describe("Proveedor (por defecto el primero disponible, normalmente gosom)"),
        lang: z.string().length(2).optional().describe("Idioma, p. ej. es"),
        country: z.string().length(2).optional().describe("País para normalizar teléfonos, p. ej. ES"),
        limit: z.number().int().min(1).max(500).optional().describe("Máximo de resultados por consulta"),
        name: z.string().max(160).optional(),
      },
    },
    run(async (a: { queries: string[]; providerId?: string; lang?: string; country?: string; limit?: number; name?: string }) => {
      const providerId = a.providerId ?? providers[0]?.id;
      if (!providerId || !getProvider(providerId)) throw badRequest(`Proveedor desconocido. Disponibles: ${providers.map((p) => p.id).join(", ")}`);
      const s = await startSearch({ ...a, providerId });
      return { id: s.id, name: s.name, status: s.status, providerId: s.providerId };
    }),
  );

  server.registerTool(
    "list_searches",
    {
      title: "Historial de búsquedas",
      description: "Búsquedas recientes con su estado y número de negocios encontrados.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ limit = 20 }: { limit?: number }) => {
      const searches = await getStore().listSearches();
      return searches.slice(0, limit).map((s) => ({ id: s.id, name: s.name, status: s.status, leadCount: s.leadCount, error: s.error, createdAt: s.createdAt }));
    }),
  );

  server.registerTool(
    "get_search",
    {
      title: "Estado de una búsqueda",
      description: "Estado, progreso y resultados de una búsqueda. Si sigue en curso, vuelve a consultarla en unos segundos.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ id }: { id: string }) => {
      const s = await getStore().getSearch(id);
      if (!s) throw badRequest("Búsqueda no encontrada");
      return { id: s.id, name: s.name, status: s.status, progress: s.progress, leadCount: s.leadCount, error: s.error, queries: s.params.queries, finishedAt: s.finishedAt };
    }),
  );

  server.registerTool(
    "list_results",
    {
      title: "Resultados de búsqueda",
      description: "Negocios encontrados por las búsquedas (aún no guardados en el CRM salvo 'saved'). Filtra y ordena igual que en la app.",
      inputSchema: { searchId: z.string().optional().describe("Solo esta búsqueda"), ...filterShape, onlyUnsaved: z.boolean().optional(), ...sortShape },
      annotations: { readOnlyHint: true },
    },
    run(async (a: LeadFilters & { searchId?: string; onlyUnsaved?: boolean; sortBy?: string; sortDir?: "asc" | "desc"; limit?: number; offset?: number }) => {
      const store = getStore();
      const [results, saved, settings] = await Promise.all([store.listLeads(a.searchId), store.listSavedLeads(), store.getSettings()]);
      const savedKeys = new Set(saved.map((l) => l.key));
      const { searchId: _s, onlyUnsaved, sortBy, sortDir, limit, offset, ...filters } = a;
      void _s;
      let rows = queryLeads(results, filters, sortBy ? { field: sortBy, dir: sortDir ?? "desc" } : { field: "score", dir: "desc" }, {
        lowRating: settings.lowRating,
      });
      const isSaved = new Set(rows.filter((r) => savedKeys.has(leadDedupeKey(r))).map((r) => r.id));
      if (onlyUnsaved) rows = rows.filter((r) => !isSaved.has(r.id));
      return page(
        rows.map((r) => resultSummary(r, isSaved)),
        limit,
        offset,
      );
    }),
  );

  server.registerTool(
    "save_results",
    {
      title: "Guardar en el CRM",
      description: "Guarda resultados de búsqueda como leads (los duplicados se fusionan con el lead existente).",
      inputSchema: { ids: z.array(z.string()).min(1).max(1000).describe("Ids de resultados (de list_results)"), searchId: z.string().optional() },
    },
    run(async ({ ids, searchId }: { ids: string[]; searchId?: string }) => saveResults(ids, searchId)),
  );

  // ── Tareas ──

  server.registerTool(
    "list_tasks",
    {
      title: "Tareas",
      description: "Tareas de seguimiento. Por defecto las pendientes (vencidas, hoy y próximas).",
      inputSchema: {
        leadId: z.string().optional(),
        status: z.enum(["pending", "overdue", "today", "upcoming", "done", "all"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    run(async ({ leadId, status = "pending" }: { leadId?: string; status?: string }) => {
      const tasks = await listTasks(leadId);
      return tasks
        .map((t) => ({ ...t, bucket: taskBucket(t) }))
        .filter((t) => status === "all" || (status === "pending" ? t.bucket !== "done" : t.bucket === status))
        .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, status: t.bucket, leadId: t.leadId, leadName: t.leadName, leadExists: t.leadExists }));
    }),
  );

  server.registerTool(
    "create_task",
    {
      title: "Crear tarea",
      description: "Crea una tarea de seguimiento para un lead. La app avisa cuando vence. Devuelve también un enlace para añadirla a Google Calendar.",
      inputSchema: {
        leadId: z.string(),
        title: z.string().min(1).max(200),
        dueAt: z.string().describe("Fecha y hora ISO 8601 con zona, p. ej. 2026-11-02T10:00:00+01:00"),
      },
    },
    run(async (a: { leadId: string; title: string; dueAt: string }) => {
      const task = await createTask(a);
      return { ...task, googleCalendar: googleCalendarLink(task) };
    }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Completar tarea",
      description: "Marca una tarea como hecha (o pendiente con done=false).",
      inputSchema: { id: z.string(), done: z.boolean().optional() },
    },
    run(async ({ id, done = true }: { id: string; done?: boolean }) => updateTask(id, { done })),
  );

  // ── Contacto ──

  server.registerTool(
    "draft_message",
    {
      title: "Preparar mensaje",
      description:
        "Rellena una plantilla (WhatsApp o email) con los datos del lead y devuelve el texto y el enlace para abrirlo. No envía nada. Tras enviarlo, registra el contacto con log_contact.",
      inputSchema: {
        leadId: z.string(),
        templateId: z.string().optional().describe("Id o nombre de la plantilla (get_overview las lista)"),
        channel: z.enum(["whatsapp", "email"]).optional().describe("Si no hay plantilla: canal del mensaje"),
        text: z.string().max(4000).optional().describe("Texto propio en lugar de una plantilla; admite {nombre}, {categoria}…"),
      },
      annotations: { readOnlyHint: true },
    },
    run(async (a: { leadId: string; templateId?: string; channel?: "whatsapp" | "email"; text?: string }) => {
      const store = getStore();
      const [lead, settings] = await Promise.all([store.getSavedLead(a.leadId), store.getSettings()]);
      if (!lead) throw badRequest("Lead no encontrado");
      if (lead.doNotContact) throw badRequest(`"${lead.name}" está marcado como "no contactar".`);
      let tpl = a.templateId ? settings.templates.find((t) => t.id === a.templateId || norm(t.name) === norm(a.templateId!)) : undefined;
      if (a.templateId && !tpl) throw badRequest(`Plantilla desconocida: ${a.templateId}`);
      const channel = tpl?.channel ?? a.channel ?? "whatsapp";
      if (a.text) tpl = { id: "custom", name: "Personalizado", channel, body: a.text, subject: tpl?.subject };
      if (tpl && channel === "whatsapp" && tpl.channel !== "whatsapp" && !a.text) throw badRequest("La plantilla no es de WhatsApp");
      const link = channel === "whatsapp" ? whatsappLink(lead, tpl, settings) : mailtoLink(lead, tpl, settings);
      return {
        lead: lead.name,
        channel,
        subject: tpl?.subject ? renderTemplate(tpl.subject, lead, settings) : undefined,
        text: tpl ? renderTemplate(tpl.body, lead, settings) : "",
        link: link ?? null,
        warning: link ? undefined : channel === "whatsapp" ? "El lead no tiene un teléfono válido" : "El lead no tiene email",
        template: tpl?.name,
      };
    }),
  );

  server.registerTool(
    "log_contact",
    {
      title: "Registrar contacto",
      description: "Anota en el historial del lead que se le ha contactado (actualiza 'Último contacto').",
      inputSchema: {
        leadId: z.string(),
        channel: z.enum(Object.keys(CONTACT_CHANNELS) as [ContactChannel, ...ContactChannel[]]),
        template: z.string().max(80).optional(),
        note: z.string().max(5000).optional().describe("Nota opcional con el resultado del contacto"),
      },
    },
    run(async (a: { leadId: string; channel: ContactChannel; template?: string; note?: string }) => {
      await updateSaved([a.leadId], { logContact: { channel: a.channel, template: a.template } });
      if (a.note) await updateSaved([a.leadId], { addNote: a.note });
      return { ok: true };
    }),
  );

  // ── Otrelink ──

  server.registerTool(
    "otrelink_brief",
    {
      title: "Brief para Otrelink",
      description:
        "Datos de un lead preparados para crear su página con el MCP de Otrelink: plantilla sugerida, bloques con sus campos (contacto, horario, mapa, web, reseñas) e instrucciones paso a paso.",
      inputSchema: { leadId: z.string() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ leadId }: { leadId: string }) => {
      const lead = await getStore().getSavedLead(leadId);
      if (!lead) throw badRequest("Lead no encontrado");
      const brief = otrelinkBrief(lead);
      return { ...brief, existingPage: lead.pageUrl, instructions: otrelinkPrompt(brief, { leadsMcp: true }).split("\nDatos (JSON):")[0] };
    }),
  );

  server.registerTool(
    "set_lead_page",
    {
      title: "Guardar enlace de la página",
      description: "Guarda en el lead el enlace de la página creada para el negocio (p. ej. en Otrelink). url vacía o null lo quita.",
      inputSchema: { leadId: z.string(), url: z.string().nullable() },
    },
    run(async ({ leadId, url }: { leadId: string; url: string | null }) => ({ updated: await updateSaved([leadId], { pageUrl: url || null }) })),
  );

  return server;
}

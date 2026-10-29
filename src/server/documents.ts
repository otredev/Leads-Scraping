import "server-only";
import { createHash, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import {
  BUILT_IN_TEMPLATES,
  DOC_TYPES,
  docTotals,
  docTypeLabel,
  formatNumber,
  invoiceSeries,
  missingVariables,
  recordHashInput,
  renderVariables,
  taxQrUrl,
  localDateTimeWithOffset,
  variableValues,
  type DocContext,
  type DocLine,
  type DocTemplate,
  type DocType,
  type Document,
  type DocumentSettings,
  type Party,
  type Totals,
} from "@/core/documents";
import type { Client } from "@/core/clients";
import type { CrmSettings } from "@/core/crm";
import { getStore } from "./registry";
import { defaultCurrency } from "./clients";
import { financeSettings } from "./finance";

/**
 * Propuestas, contratos y facturas.
 *
 * Reglas:
 *  - Solo los borradores se editan o se borran.
 *  - Al enviar (propuestas y contratos) o emitir (facturas) se congelan el
 *    texto (variables resueltas) y los datos de las partes.
 *  - Las facturas se numeran de forma correlativa por serie y año (F2026-0001,
 *    R2026-0001 para rectificativas), con fecha igual o posterior a la última
 *    emitida de su serie, y se encadenan con la huella SHA-256 de la AEAT.
 *    Una factura emitida no cambia nunca: se corrige con una rectificativa.
 *  - Todo lo importante queda en un registro de eventos.
 */

const bad = (m: string) => Object.assign(new Error(m), { status: 400 });
const notFound = (m: string) => Object.assign(new Error(m), { status: 404 });
const conflict = (m: string) => Object.assign(new Error(m), { status: 409 });
const now = () => new Date().toISOString();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
};

const META_COUNTERS = "documents:counters";
const META_CHAIN = "documents:chain";
const META_EVENTS = "documents:events";

// ── Validación ──

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

function day(v: unknown, label = "Fecha"): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${label} no válida (AAAA-MM-DD)`);
  return v;
}

function num(v: unknown, label: string, { min = -1e9, max = 1e9 } = {}): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} no válido`);
  return Math.round(n * 10000) / 10000;
}

function lines(v: unknown): DocLine[] {
  if (!Array.isArray(v)) throw bad("Líneas no válidas");
  if (v.length > 200) throw bad("Demasiadas líneas (máx. 200)");
  return v
    .map((raw, i) => {
      const l = (raw ?? {}) as Record<string, unknown>;
      const description = str(l.description, 500) ?? "";
      if (!description && !l.unitPrice) return undefined;
      if (!description) throw bad(`Línea ${i + 1}: escribe el concepto`);
      return {
        description,
        quantity: num(l.quantity ?? 1, `Línea ${i + 1}: cantidad`, { min: -1e6, max: 1e6 }),
        unitPrice: num(l.unitPrice ?? 0, `Línea ${i + 1}: precio`),
        vat: num(l.vat ?? 0, `Línea ${i + 1}: IVA`, { min: 0, max: 100 }),
      };
    })
    .filter((l): l is DocLine => Boolean(l));
}

// ── Ajustes ──

export async function documentSettings(settings?: CrmSettings): Promise<DocumentSettings & { vat: number; paymentDays: number }> {
  const s = (settings ?? (await getStore().getSettings())).documents ?? {};
  return { ...s, vat: s.vat ?? 21, paymentDays: s.paymentDays ?? 30 };
}

export async function saveDocumentSettings(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const settings = await store.getSettings();
  const next: DocumentSettings = { ...settings.documents };
  const setNum = (k: "vat" | "irpf" | "paymentDays", label: string, max: number) => {
    if (!(k in r)) return;
    if (r[k] === null || r[k] === "") delete next[k];
    else next[k] = num(r[k], label, { min: 0, max });
  };
  setNum("vat", "IVA", 100);
  setNum("irpf", "IRPF", 100);
  setNum("paymentDays", "Días de vencimiento", 365);
  if ("iban" in r) {
    const iban = str(r.iban, 40)?.toUpperCase().replace(/\s/g, "");
    if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) throw bad("IBAN no válido");
    if (iban) next.iban = iban.replace(/(.{4})/g, "$1 ").trim();
    else delete next.iban;
  }
  if ("invoiceFooter" in r) {
    const f = str(r.invoiceFooter, 1000);
    if (f) next.invoiceFooter = f;
    else delete next.invoiceFooter;
  }
  const saved: CrmSettings = { ...settings, documents: next };
  await store.saveSettings(saved);
  return saved;
}

// ── Registro de eventos ──

export interface DocEvent {
  at: string;
  type: "create" | "send" | "issue" | "accept" | "reject" | "paid" | "unpaid" | "rectify" | "delete" | "reopen" | "cancel";
  docId: string;
  docType: DocType;
  number?: string;
  detail?: string;
}

async function logEvent(e: Omit<DocEvent, "at">) {
  await getStore().updateMeta<DocEvent[]>(META_EVENTS, (list = []) => [...list, { at: now(), ...e }]);
}

export async function listEvents(opts: { docId?: string; limit?: number } = {}) {
  const list = (await getStore().getMeta<DocEvent[]>(META_EVENTS)) ?? [];
  return list
    .filter((e) => !opts.docId || e.docId === opts.docId)
    .reverse()
    .slice(0, opts.limit ?? 500);
}

// ── Contexto y partes ──

function issuerParty(settings: CrmSettings): Party {
  const p = settings.portal ?? {};
  return {
    name: p.legalName || p.brandName || "",
    ...(p.brandName && p.brandName !== p.legalName ? { tradeName: p.brandName } : {}),
    ...(p.taxId ? { taxId: p.taxId } : {}),
    ...(p.legalAddress ? { address: p.legalAddress } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
    ...(p.website ? { website: p.website } : {}),
  };
}

function customerParty(c: Client): Party {
  return {
    name: c.legalName || c.name,
    ...(c.contactName ? { tradeName: c.contactName } : {}),
    ...(c.taxId ? { taxId: c.taxId } : {}),
    ...(c.address ? { address: c.address } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.website ? { website: c.website } : {}),
  };
}

async function context(d: Pick<Document, "clientId" | "projectId" | "number" | "date" | "dueDate" | "currency" | "lines" | "irpf">): Promise<DocContext> {
  const store = getStore();
  const [client, project, settings] = await Promise.all([
    store.getClient(d.clientId),
    d.projectId ? store.getProject(d.projectId) : undefined,
    store.getSettings(),
  ]);
  if (!client) throw notFound("Cliente no encontrado");
  const p = settings.portal ?? {};
  const docs = await documentSettings(settings);
  return {
    client: {
      name: client.legalName || client.name,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      address: client.address,
      website: client.website,
      taxId: client.taxId,
      category: client.category,
    },
    ...(project
      ? {
          project: {
            name: project.name,
            description: project.description,
            startDate: project.startDate,
            dueDate: project.dueDate,
            budget: project.budget,
            hourlyRate: project.hourlyRate,
            currency: project.currency,
            milestones: project.milestones.map((m) => ({ title: m.title, dueAt: m.dueAt })),
          },
        }
      : {}),
    me: { brandName: p.brandName, legalName: p.legalName, taxId: p.taxId, address: p.legalAddress, email: p.email, phone: p.phone, website: p.website, iban: docs.iban },
    doc: { number: d.number, date: d.date, dueDate: d.dueDate, total: docTotals(d).total, currency: d.currency },
    today: today(),
  };
}

// ── Vista ──

export interface DocumentView extends Document {
  clientName: string;
  projectName?: string;
  totals: Totals;
  /** Texto con las variables resueltas (en borradores, con los datos actuales). */
  renderedTitle: string;
  renderedBody: string;
  /** Variables sin dato (solo borradores). */
  missing: string[];
  /** Propuesta enviada con la validez vencida. */
  expired?: boolean;
  qrSvg?: string;
}

async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}

export async function viewDocument(doc: Document, names?: { clients: Map<string, string>; projects: Map<string, string> }): Promise<DocumentView> {
  const store = getStore();
  const clientName = names?.clients.get(doc.clientId) ?? (await store.getClient(doc.clientId))?.name ?? "Cliente borrado";
  const projectName = doc.projectId ? (names?.projects.get(doc.projectId) ?? (await store.getProject(doc.projectId))?.name) : undefined;
  let renderedTitle = doc.title;
  let renderedBody = doc.body;
  let missing: string[] = [];
  let parties: Pick<Document, "issuer" | "customer"> = {};
  if (doc.status === "draft") {
    // Vista previa: las partes con los datos actuales (se guardan al enviar o emitir).
    const [client, settings] = await Promise.all([store.getClient(doc.clientId), store.getSettings()]);
    parties = { issuer: issuerParty(settings), ...(client ? { customer: customerParty(client) } : {}) };
    const values = variableValues(await context(doc).catch(() => ({ client: { name: clientName }, me: {}, doc: { date: doc.date, currency: doc.currency }, today: today() }) as DocContext));
    renderedTitle = renderVariables(doc.title, values);
    renderedBody = renderVariables(doc.body, values);
    missing = missingVariables(`${doc.title}\n${doc.body}`, values);
  }
  return {
    ...doc,
    ...parties,
    clientName,
    ...(projectName ? { projectName } : {}),
    totals: docTotals(doc),
    renderedTitle,
    renderedBody,
    missing,
    ...(doc.type === "proposal" && doc.status === "sent" && doc.dueDate && doc.dueDate < today() ? { expired: true } : {}),
    ...(doc.record ? { qrSvg: await qrSvg(doc.record.qrUrl) } : {}),
  };
}

export async function listDocuments(opts: { clientId?: string; type?: DocType } = {}) {
  const store = getStore();
  const [docs, clients, projects] = await Promise.all([store.listDocuments({ clientId: opts.clientId }), store.listClients(), store.listProjects()]);
  const names = { clients: new Map(clients.map((c) => [c.id, c.name])), projects: new Map(projects.map((p) => [p.id, p.name])) };
  // La lista no necesita el texto ni el QR: se resuelve solo el título.
  return Promise.all(
    docs
      .filter((d) => !opts.type || d.type === opts.type)
      .map(async (d) => {
        const v = await viewDocument({ ...d, body: "", record: undefined }, names);
        return { ...v, body: "", renderedBody: "", record: d.record, qrSvg: undefined };
      }),
  );
}

export async function getDocument(id: string) {
  const doc = await getStore().getDocument(id);
  if (!doc) throw notFound("Documento no encontrado");
  return viewDocument(doc);
}

// ── Plantillas ──

export async function listTemplates(): Promise<DocTemplate[]> {
  const stored = await getStore().listDocTemplates();
  const ids = new Set(stored.map((t) => t.id));
  const t0 = "2026-01-01T00:00:00.000Z";
  return [...BUILT_IN_TEMPLATES.filter((t) => !ids.has(t.id)).map((t) => ({ ...t, createdAt: t0, updatedAt: t0 })), ...stored].sort(
    (a, b) => DOC_TYPES.findIndex((x) => x.id === a.type) - DOC_TYPES.findIndex((x) => x.id === b.type) || a.name.localeCompare(b.name, "es"),
  );
}

export async function saveTemplate(raw: unknown, id?: string) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const current = id ? (await listTemplates()).find((t) => t.id === id) : undefined;
  if (id && !current) throw notFound("Plantilla no encontrada");
  const type = (current?.type ?? r.type) as DocType;
  if (!DOC_TYPES.some((t) => t.id === type)) throw bad("Tipo de documento no válido");
  const name = str(r.name ?? current?.name, 120);
  if (!name) throw bad("Ponle un nombre a la plantilla");
  const t: DocTemplate = {
    id: current?.id ?? randomUUID(),
    type,
    name,
    title: str(r.title ?? current?.title, 200) ?? name,
    body: typeof r.body === "string" ? r.body.slice(0, 50_000) : (current?.body ?? ""),
    lines: "lines" in r ? lines(r.lines) : (current?.lines ?? []),
    ...("days" in r ? (r.days ? { days: num(r.days, "Días", { min: 0, max: 365 }) } : {}) : current?.days ? { days: current.days } : {}),
    ...(str(r.notes ?? current?.notes, 2000) ? { notes: str(r.notes ?? current?.notes, 2000) } : {}),
    ...(current?.builtIn ? { builtIn: true } : {}),
    createdAt: current?.createdAt ?? now(),
    updatedAt: now(),
  };
  await getStore().putDocTemplate(t);
  return t;
}

/** Borra una plantilla tuya; en las incluidas, deshace tus cambios. */
export async function deleteTemplate(id: string) {
  await getStore().deleteDocTemplate(id);
}

// ── Crear y editar ──

async function nextReference(type: Exclude<DocType, "invoice">, date: string) {
  const prefix = `${DOC_TYPES.find((t) => t.id === type)!.prefix}-${date.slice(0, 4)}-`;
  const counters = await getStore().updateMeta<Record<string, number>>(META_COUNTERS, (c = {}) => ({ ...c, [prefix]: (c[prefix] ?? 0) + 1 }));
  return formatNumber(prefix, counters[prefix], 3);
}

/**
 * Crea un borrador: { type, clientId, projectId?, templateId?, title? } o
 * { fromId, type } para convertir (p. ej. una propuesta aceptada en contrato o factura).
 */
export async function createDocument(raw: unknown): Promise<Document> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const source = typeof r.fromId === "string" ? await store.getDocument(r.fromId) : undefined;
  if (r.fromId && !source) throw notFound("Documento de origen no encontrado");
  const type = (r.type ?? source?.type) as DocType;
  if (!DOC_TYPES.some((t) => t.id === type)) throw bad("Tipo de documento no válido");
  const clientId = (source?.clientId ?? r.clientId) as string;
  const client = typeof clientId === "string" ? await store.getClient(clientId) : undefined;
  if (!client) throw bad("Elige un cliente");
  const projectId = (str(r.projectId, 100) ?? source?.projectId) || undefined;
  const project = projectId ? await store.getProject(projectId) : undefined;
  if (projectId && (!project || project.clientId !== client.id)) throw bad("El proyecto no es de ese cliente");

  const templates = await listTemplates();
  const template = typeof r.templateId === "string" ? templates.find((t) => t.id === r.templateId) : templates.find((t) => t.type === type && t.builtIn);
  if (r.templateId && !template) throw notFound("Plantilla no encontrada");
  if (template && template.type !== type) throw bad("La plantilla es de otro tipo de documento");

  const settings = await store.getSettings();
  const ds = await documentSettings(settings);
  const date = today();
  const days = template?.days ?? (type === "invoice" ? ds.paymentDays : undefined);
  const currency = project?.currency ?? source?.currency ?? (await financeSettings(settings)).currency ?? defaultCurrency();
  const defaultLines: DocLine[] =
    source?.lines.map((l) => ({ ...l })) ??
    (template?.lines.length
      ? template.lines.map((l) => ({ ...l }))
      : type !== "contract" && project?.budget
        ? [{ description: project.name, quantity: 1, unitPrice: project.budget, vat: ds.vat }]
        : []);

  const doc: Document = {
    id: randomUUID(),
    type,
    clientId: client.id,
    ...(project ? { projectId: project.id } : {}),
    ...(template ? { templateId: template.id } : {}),
    title: str(r.title, 200) ?? template?.title ?? (source ? `${docTypeLabel(type)}: ${source.title}` : docTypeLabel(type)),
    status: "draft",
    ...(type !== "invoice" ? { number: await nextReference(type, date) } : {}),
    date,
    ...(days ? { dueDate: addDays(date, days) } : {}),
    currency,
    body: template?.body ?? "",
    lines: defaultLines,
    ...(type === "invoice" && ds.irpf ? { irpf: ds.irpf } : source?.irpf ? { irpf: source.irpf } : {}),
    ...(template?.notes ? { notes: template.notes } : {}),
    visibleToClient: true,
    ...(source ? { fromId: source.id } : {}),
    createdAt: now(),
    updatedAt: now(),
  };
  if (type === "invoice") doc.kind = "F1";
  await store.putDocument(doc);
  await logEvent({ type: "create", docId: doc.id, docType: type, number: doc.number, detail: source ? `Desde ${source.number ?? source.title}` : template?.name });
  return doc;
}

async function load(id: string) {
  const doc = await getStore().getDocument(id);
  if (!doc) throw notFound("Documento no encontrado");
  return doc;
}

async function save(doc: Document) {
  doc.updatedAt = now();
  await getStore().putDocument(doc);
  if (doc.visibleToClient || doc.status !== "draft") {
    const { schedulePublish } = await import("./portal");
    schedulePublish(doc.clientId);
  }
  return doc;
}

/** Cambia un borrador (título, texto, líneas, fechas…) o, si ya no lo es, solo si se ve en el portal. */
export async function updateDocument(id: string, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const doc = await load(id);
  if (typeof r.visibleToClient === "boolean") doc.visibleToClient = r.visibleToClient;
  const content = ["title", "body", "lines", "irpf", "date", "dueDate", "notes", "projectId", "currency"].filter((k) => k in r);
  if (content.length && doc.status !== "draft")
    throw conflict(doc.type === "invoice" ? "Una factura emitida no se puede modificar: crea una rectificativa." : "Solo se editan borradores. Vuelve a ponerlo en borrador para cambiarlo.");
  if ("title" in r) doc.title = str(r.title, 200) ?? doc.title;
  if ("body" in r) doc.body = typeof r.body === "string" ? r.body.slice(0, 50_000) : doc.body;
  if ("lines" in r) doc.lines = lines(r.lines);
  if ("irpf" in r) doc.irpf = r.irpf === null || r.irpf === "" || r.irpf === 0 ? undefined : num(r.irpf, "IRPF", { min: 0, max: 100 });
  if ("date" in r) doc.date = day(r.date) ?? doc.date;
  if ("dueDate" in r) doc.dueDate = day(r.dueDate, "Fecha de vencimiento");
  if ("notes" in r) doc.notes = str(r.notes, 2000);
  if ("projectId" in r) {
    const pid = str(r.projectId, 100);
    if (pid) {
      const p = await getStore().getProject(pid);
      if (!p || p.clientId !== doc.clientId) throw bad("El proyecto no es de ese cliente");
      doc.projectId = pid;
    } else delete doc.projectId;
  }
  return viewDocument(await save(doc));
}

/** Resuelve las variables y guarda las partes: a partir de aquí el documento no cambia. */
async function freeze(doc: Document) {
  const store = getStore();
  const [client, settings] = await Promise.all([store.getClient(doc.clientId), store.getSettings()]);
  if (!client) throw notFound("Cliente no encontrado");
  const values = variableValues(await context(doc));
  doc.title = renderVariables(doc.title, values);
  doc.body = renderVariables(doc.body, values);
  doc.issuer = issuerParty(settings);
  doc.customer = customerParty(client);
}

// ── Acciones ──

export type DocAction =
  | { action: "send" }
  | { action: "reopen" }
  | { action: "accept"; name?: string }
  | { action: "reject" }
  | { action: "cancel" }
  | { action: "issue" }
  | { action: "paid"; date?: string; registerPayment?: boolean }
  | { action: "unpaid" };

export async function documentAction(id: string, raw: unknown) {
  const a = (raw ?? {}) as DocAction & Record<string, unknown>;
  const doc = await load(id);
  const is = (...s: Document["status"][]) => s.includes(doc.status);
  switch (a.action) {
    case "send": {
      if (doc.type === "invoice") throw bad("Las facturas se emiten (acción issue)");
      if (!is("draft")) throw conflict("Ya está enviado");
      await freeze(doc);
      doc.status = "sent";
      doc.sentAt = now();
      await logEvent({ type: "send", docId: doc.id, docType: doc.type, number: doc.number });
      break;
    }
    case "reopen": {
      if (doc.type === "invoice") throw conflict("Una factura emitida no vuelve a borrador: crea una rectificativa.");
      if (!is("sent", "rejected")) throw conflict("Solo se puede reabrir un documento enviado o rechazado (no uno aceptado).");
      doc.status = "draft";
      delete doc.sentAt;
      delete doc.rejectedAt;
      await logEvent({ type: "reopen", docId: doc.id, docType: doc.type, number: doc.number });
      break;
    }
    case "accept": {
      if (doc.type === "invoice") throw bad("Las facturas no se aceptan");
      if (!is("sent")) throw conflict("Solo se acepta un documento enviado");
      doc.status = "accepted";
      doc.acceptance = { name: str(a.name, 120) ?? doc.customer?.name ?? "Cliente", at: now(), via: "manual" };
      await logEvent({ type: "accept", docId: doc.id, docType: doc.type, number: doc.number, detail: "Marcado a mano" });
      break;
    }
    case "reject": {
      if (doc.type !== "proposal" || !is("sent")) throw conflict("Solo se rechaza una propuesta enviada");
      doc.status = "rejected";
      doc.rejectedAt = now();
      await logEvent({ type: "reject", docId: doc.id, docType: doc.type, number: doc.number });
      break;
    }
    case "cancel": {
      if (doc.type !== "contract" || !is("sent", "accepted")) throw conflict("Solo se cancela un contrato enviado o firmado");
      doc.status = "cancelled";
      await logEvent({ type: "cancel", docId: doc.id, docType: doc.type, number: doc.number });
      break;
    }
    case "issue": {
      const issued = await issueInvoice(doc);
      if (issued.visibleToClient) notifyDocument(issued);
      return viewDocument(issued);
    }
    case "paid": {
      if (doc.type !== "invoice" || !is("issued")) throw conflict("Solo se marca como pagada una factura emitida");
      doc.status = "paid";
      doc.paidAt = day(a.date, "Fecha de cobro") ?? today();
      if (a.registerPayment && doc.projectId && doc.kind === "F1") {
        const { updateProject } = await import("./clients");
        await updateProject(doc.projectId, { addPayment: { amount: docTotals(doc).total, date: doc.paidAt, note: `Factura ${doc.number}` } });
      }
      await logEvent({ type: "paid", docId: doc.id, docType: doc.type, number: doc.number, detail: doc.paidAt });
      break;
    }
    case "unpaid": {
      if (doc.type !== "invoice" || !is("paid")) throw conflict("La factura no está marcada como pagada");
      doc.status = "issued";
      delete doc.paidAt;
      await logEvent({ type: "unpaid", docId: doc.id, docType: doc.type, number: doc.number });
      break;
    }
    default:
      throw bad("Acción no válida");
  }
  await save(doc);
  if (a.action === "send" && doc.visibleToClient) notifyDocument(doc);
  return viewDocument(doc);
}

/** Aviso push al cliente (si los activó en su portal) de un documento nuevo. */
function notifyDocument(doc: Document) {
  const what = doc.type === "invoice" ? `la factura ${doc.number ?? ""}`.trim() : doc.type === "contract" ? "un contrato para firmar" : "una propuesta";
  void import("./client-push").then(({ notifyClientSoon }) =>
    notifyClientSoon(doc.clientId, { title: "Tienes un documento nuevo", body: `Te hemos enviado ${what}: ${doc.title}`, path: `d/${doc.id}`, tag: `doc-${doc.id}` }, { publishFirst: true }),
  );
}

/** Emite una factura: número correlativo, partes congeladas y registro encadenado. */
async function issueInvoice(doc: Document): Promise<Document> {
  if (doc.type !== "invoice") throw bad("Solo se emiten facturas");
  if (doc.status !== "draft") throw conflict("La factura ya está emitida");
  if (!doc.lines.length) throw bad("Añade al menos una línea");
  const date = doc.date;
  if (date > today()) throw bad("La fecha de expedición no puede ser futura");
  const store = getStore();
  const [client, settings] = await Promise.all([store.getClient(doc.clientId), store.getSettings()]);
  if (!client) throw notFound("Cliente no encontrado");
  const issuer = issuerParty(settings);
  const customer = customerParty(client);
  const missing = [
    !issuer.name && "tu nombre o razón social",
    !issuer.taxId && "tu NIF",
    !issuer.address && "tu domicilio",
    !customer.taxId && "el NIF del cliente",
    !customer.address && "la dirección del cliente",
  ].filter(Boolean);
  if (missing.length) throw bad(`Para emitir la factura falta ${missing.join(", ")}. ${!issuer.taxId || !issuer.address || !issuer.name ? "Tus datos están en Ajustes → Portal del cliente → Datos legales. " : ""}${!customer.taxId || !customer.address ? "Los del cliente, en su ficha → Editar." : ""}`.trim());

  const totals = docTotals(doc);
  const kind = doc.kind ?? "F1";
  if (kind === "F1" && totals.gross <= 0) throw bad("El total debe ser positivo (para restar, crea una rectificativa)");
  const series = invoiceSeries(kind, date);

  // Número y encadenado en un solo paso atómico.
  let record: Document["record"];
  let sequence = 0;
  await store.updateMeta<{ lastHash: string; last: Record<string, { seq: number; date: string }> }>(META_CHAIN, (chain = { lastHash: "", last: {} }) => {
    const last = chain.last[series];
    if (last && date < last.date) throw bad(`La fecha no puede ser anterior a la última factura de la serie ${series} (${last.date})`);
    sequence = (last?.seq ?? 0) + 1;
    const number = formatNumber(series, sequence);
    const generatedAt = localDateTimeWithOffset();
    const input = recordHashInput({ issuerTaxId: issuer.taxId!, number, date, kind, vatTotal: totals.vatTotal, gross: totals.gross, prevHash: chain.lastHash, generatedAt });
    const hash = createHash("sha256").update(input, "utf8").digest("hex").toUpperCase();
    record = { hash, prevHash: chain.lastHash, generatedAt, input, qrUrl: taxQrUrl({ issuerTaxId: issuer.taxId!, number, date, gross: totals.gross }) };
    return { lastHash: hash, last: { ...chain.last, [series]: { seq: sequence, date } } };
  });

  doc.kind = kind;
  doc.series = series;
  doc.sequence = sequence;
  doc.number = formatNumber(series, sequence);
  // Con el número ya asignado, se resuelven las variables ({documento.numero}) y se congelan las partes.
  await freeze(doc);
  doc.status = "issued";
  doc.issuedAt = now();
  doc.record = record;
  await store.putDocument(doc);
  await logEvent({ type: "issue", docId: doc.id, docType: "invoice", number: doc.number, detail: `${kind} · ${totals.total.toFixed(2)} ${doc.currency} · huella ${record!.hash.slice(0, 12)}…` });

  if (doc.rectifies) {
    const original = await store.getDocument(doc.rectifies.id);
    if (original) {
      original.status = "rectified";
      original.rectifiedBy = { id: doc.id, number: doc.number };
      original.updatedAt = now();
      await store.putDocument(original);
      await logEvent({ type: "rectify", docId: original.id, docType: "invoice", number: original.number, detail: `Rectificada por ${doc.number}` });
    }
  }
  return doc;
}

/** Crea el borrador de una rectificativa (R4) con las líneas en negativo, para ajustarlas. */
export async function createRectification(id: string) {
  const original = await load(id);
  if (original.type !== "invoice" || !["issued", "paid"].includes(original.status)) throw conflict("Solo se rectifica una factura emitida");
  if (original.kind === "R4") throw conflict("No se puede rectificar una rectificativa: rectifica la factura original");
  const existing = (await getStore().listDocuments({ clientId: original.clientId })).find((d) => d.rectifies?.id === original.id && d.status === "draft");
  if (existing) return existing;
  const doc: Document = {
    id: randomUUID(),
    type: "invoice",
    kind: "R4",
    clientId: original.clientId,
    ...(original.projectId ? { projectId: original.projectId } : {}),
    title: `Rectificativa de ${original.number}`,
    status: "draft",
    date: today(),
    currency: original.currency,
    body: `Factura rectificativa de la factura ${original.number} del ${original.date.split("-").reverse().join("/")}.\n\nMotivo: `,
    lines: original.lines.map((l) => ({ ...l, quantity: -l.quantity })),
    ...(original.irpf ? { irpf: original.irpf } : {}),
    visibleToClient: original.visibleToClient,
    rectifies: { id: original.id, number: original.number!, date: original.date },
    createdAt: now(),
    updatedAt: now(),
  };
  await getStore().putDocument(doc);
  await logEvent({ type: "create", docId: doc.id, docType: "invoice", detail: `Rectificativa de ${original.number}` });
  return doc;
}

export async function deleteDocument(id: string) {
  const doc = await load(id);
  if (doc.status !== "draft") throw conflict(doc.type === "invoice" ? "Una factura emitida no se puede borrar: crea una rectificativa." : "Solo se borran borradores.");
  await getStore().deleteDocument(id);
  await logEvent({ type: "delete", docId: id, docType: doc.type, number: doc.number, detail: doc.title });
  const { schedulePublish } = await import("./portal");
  schedulePublish(doc.clientId);
}

// ── Integridad de la cadena de facturas ──

export async function verifyChain() {
  const invoices = (await getStore().listDocuments())
    .filter((d) => d.type === "invoice" && d.record)
    .sort((a, b) => a.record!.generatedAt.localeCompare(b.record!.generatedAt) || a.issuedAt!.localeCompare(b.issuedAt!));
  const problems: string[] = [];
  let prev = "";
  for (const d of invoices) {
    const r = d.record!;
    const totals = docTotals(d);
    const expected = recordHashInput({
      issuerTaxId: d.issuer?.taxId ?? "",
      number: d.number!,
      date: d.date,
      kind: d.kind ?? "F1",
      vatTotal: totals.vatTotal,
      gross: totals.gross,
      prevHash: r.prevHash,
      generatedAt: r.generatedAt,
    });
    const hash = createHash("sha256").update(expected, "utf8").digest("hex").toUpperCase();
    if (expected !== r.input || hash !== r.hash) problems.push(`${d.number}: los datos no coinciden con su huella`);
    if (r.prevHash !== prev) problems.push(`${d.number}: la cadena está rota (huella anterior distinta)`);
    prev = r.hash;
  }
  const chain = await getStore().getMeta<{ lastHash: string }>(META_CHAIN);
  if ((chain?.lastHash ?? "") !== prev) problems.push("La última huella guardada no coincide con la última factura");
  return { ok: problems.length === 0, invoices: invoices.length, problems };
}

// ── Aceptaciones desde el portal ──

interface RemoteAcceptance {
  clientId: string;
  docId: string;
  name: string;
  acceptedAt: string;
  sentAt: string;
  ip?: string;
  userAgent?: string;
}

let lastSync = 0;

/** Trae del portal las propuestas y contratos aceptados por los clientes. */
export async function syncAcceptances({ force = false } = {}) {
  const { portalConfig, portalFetch } = await import("./portal");
  if (!portalConfig().configured) return { updated: 0 };
  if (!force && Date.now() - lastSync < 30_000) return { updated: 0 };
  lastSync = Date.now();
  const res = await portalFetch("/acceptances");
  if (!res.ok) throw Object.assign(new Error(`El portal respondió ${res.status} al pedir las aceptaciones`), { status: 502 });
  const list = (await res.json()) as RemoteAcceptance[];
  const store = getStore();
  let updated = 0;
  for (const a of list) {
    const doc = await store.getDocument(a.docId);
    // Solo vale la aceptación de la versión enviada (si lo reabriste y cambiaste, no cuenta).
    if (!doc || doc.clientId !== a.clientId || doc.status !== "sent" || doc.sentAt !== a.sentAt) continue;
    doc.status = "accepted";
    doc.acceptance = { name: a.name, at: a.acceptedAt, via: "portal", ...(a.ip ? { ip: a.ip } : {}), ...(a.userAgent ? { userAgent: a.userAgent } : {}) };
    await save(doc);
    await logEvent({ type: "accept", docId: doc.id, docType: doc.type, number: doc.number, detail: `${a.name} desde el portal` });
    updated++;
    const { notifyAll } = await import("./notifications");
    await notifyAll({
      title: `${doc.type === "contract" ? "Contrato firmado" : "Propuesta aceptada"}: ${doc.title}`,
      body: `${a.name} lo ha aceptado en el portal.`,
      url: `/documentos/${doc.id}`,
      tag: `doc-${doc.id}`,
    }).catch(() => 0);
  }
  return { updated };
}

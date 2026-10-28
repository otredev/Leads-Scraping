import "server-only";
import { randomUUID } from "node:crypto";
import {
  CURRENCIES,
  OPEN_STATUSES,
  PROJECT_STATUSES,
  nextMilestone,
  projectProgress,
  projectTotals,
  type Client,
  type Milestone,
  type Project,
  type ProjectStatus,
} from "@/core/clients";
import { normalizePhone } from "@/core/phone";
import { defaultCountry } from "./config";
import { getStore } from "./registry";
import { disablePortal, schedulePublish } from "./portal";
import { detachExpenses } from "./finance";

const bad = (m: string) => Object.assign(new Error(m), { status: 400 });
const notFound = (m: string) => Object.assign(new Error(m), { status: 404 });
const now = () => new Date().toISOString();

// ── Validación ──

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

/** Texto opcional: undefined = no tocar, "" o null = borrar. */
function optional(r: Record<string, unknown>, key: string, max = 200): string | null | undefined {
  if (!(key in r)) return undefined;
  if (r[key] === null || r[key] === "") return null;
  return str(r[key], max) ?? null;
}

function email(v: unknown) {
  const e = str(v, 200)?.toLowerCase();
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad("Email no válido");
  return e;
}

function website(v: unknown) {
  const w = str(v, 300);
  if (!w) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`);
    if (!u.hostname.includes(".")) throw new Error();
    return u.toString();
  } catch {
    throw bad("Web no válida");
  }
}

function day(v: unknown, label = "Fecha"): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${label} no válida (AAAA-MM-DD)`);
  return v;
}

function isoDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = typeof v === "string" ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) throw bad("Fecha no válida");
  return d.toISOString();
}

function money(v: unknown, label: string): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw bad(`${label} no válido`);
  return Math.round(n * 100) / 100;
}

const COUNTRY_CURRENCY: Record<string, string> = { ES: "EUR", PT: "EUR", FR: "EUR", IT: "EUR", DE: "EUR", MX: "MXN", US: "USD", CO: "COP", AR: "ARS", CL: "CLP", PE: "PEN", GB: "GBP" };
export const defaultCurrency = () => COUNTRY_CURRENCY[defaultCountry()] ?? "EUR";

function currency(v: unknown) {
  const c = str(v, 3)?.toUpperCase();
  if (!c) return undefined;
  if (!(CURRENCIES as readonly string[]).includes(c)) throw bad("Moneda no admitida");
  return c;
}

function withPhone<T extends Pick<Client, "phone" | "phoneE164">>(c: T, phone: string | null | undefined): T {
  if (phone === undefined) return c;
  if (phone === null) return { ...c, phone: undefined, phoneE164: undefined };
  const n = normalizePhone(phone, defaultCountry());
  return { ...c, phone: n?.display ?? phone, phoneE164: n?.e164 };
}

// ── Clientes ──

export async function createClient(raw: unknown): Promise<{ client: Client; existed: boolean }> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const t = now();

  if (typeof r.fromLeadId === "string") {
    const lead = await store.getSavedLead(r.fromLeadId);
    if (!lead) throw notFound("Lead no encontrado");
    const existing = (await store.listClients()).find((c) => c.leadId === lead.id);
    if (existing) return { client: existing, existed: true };
    const client: Client = {
      id: randomUUID(),
      name: lead.name,
      email: lead.emails[0],
      phone: lead.phone,
      phoneE164: lead.phoneE164,
      website: lead.website,
      address: lead.address,
      ...(lead.category ? { category: lead.category } : {}),
      leadId: lead.id,
      createdAt: t,
      updatedAt: t,
    };
    await store.putClient(client);
    // El lead pasa a la última etapa (normalmente "Clientes").
    const settings = await store.getSettings();
    const last = settings.stages.at(-1);
    if (last && lead.stage !== last.id) await store.updateLeads([lead.id], { stage: last.id });
    return { client, existed: false };
  }

  const name = str(r.name);
  if (!name) throw bad("Escribe el nombre del cliente");
  const client = withPhone(
    {
      id: randomUUID(),
      name,
      contactName: str(r.contactName),
      email: email(r.email),
      website: website(r.website),
      address: str(r.address, 300),
      notes: str(r.notes, 5000),
      channel: str(r.channel, 60),
      category: str(r.category, 80),
      taxId: str(r.taxId, 30)?.toUpperCase().replace(/\s|-/g, ""),
      legalName: str(r.legalName, 200),
      createdAt: t,
      updatedAt: t,
    } as Client,
    str(r.phone, 40),
  );
  await store.putClient(client);
  return { client, existed: false };
}

export async function updateClient(id: string, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const current = await store.getClient(id);
  if (!current) throw notFound("Cliente no encontrado");
  let next: Client = { ...current, updatedAt: now() };
  if ("name" in r) {
    const name = str(r.name);
    if (!name) throw bad("El nombre no puede quedar vacío");
    next.name = name;
  }
  const set = <K extends keyof Client>(key: K, value: Client[K] | null | undefined) => {
    if (value === undefined) return;
    if (value === null) delete next[key];
    else next[key] = value;
  };
  set("contactName", optional(r, "contactName"));
  if ("email" in r) set("email", r.email ? email(r.email) : null);
  if ("website" in r) set("website", r.website ? website(r.website) : null);
  set("address", optional(r, "address", 300));
  set("notes", optional(r, "notes", 5000));
  set("channel", optional(r, "channel", 60));
  set("category", optional(r, "category", 80));
  const taxId = optional(r, "taxId", 30);
  set("taxId", typeof taxId === "string" ? taxId.toUpperCase().replace(/\s|-/g, "") : taxId);
  set("legalName", optional(r, "legalName", 200));
  if (typeof r.archived === "boolean") set("archived", r.archived || null);
  next = withPhone(next, optional(r, "phone", 40));
  await store.putClient(next);
  schedulePublish(next.id);
  return next;
}

/** Borra el cliente con sus proyectos y tareas. */
export async function deleteClient(id: string) {
  const store = getStore();
  const client = await store.getClient(id);
  if (!client) throw notFound("Cliente no encontrado");
  // El enlace del portal deja de funcionar (si falla, se borra igualmente aquí).
  if (client.portal) await disablePortal(id).catch((err: Error) => console.error(`[portal] ${err.message}`));
  for (const p of await store.listProjects({ clientId: id })) await store.deleteProject(p.id);
  for (const t of await store.listTasks({ clientId: id })) await store.deleteTask(t.id);
  await detachExpenses({ clientId: id });
  await store.deleteMessages({ clientId: id });
  await store.deleteClient(id);
}

// ── Proyectos ──

function status(v: unknown): ProjectStatus | undefined {
  if (v === undefined) return undefined;
  if (!PROJECT_STATUSES.some((s) => s.id === v)) throw bad("Estado no válido");
  return v as ProjectStatus;
}

export async function createProject(raw: unknown): Promise<Project> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const client = typeof r.clientId === "string" ? await store.getClient(r.clientId) : undefined;
  if (!client) throw bad("Cliente no encontrado");
  const name = str(r.name);
  if (!name) throw bad("Escribe el nombre del proyecto");
  const t = now();
  const project: Project = {
    id: randomUUID(),
    clientId: client.id,
    name,
    description: str(r.description, 5000),
    status: status(r.status) ?? "active",
    startDate: day(r.startDate, "Fecha de inicio"),
    dueDate: day(r.dueDate, "Fecha de entrega"),
    currency: currency(r.currency) ?? defaultCurrency(),
    budget: money(r.budget, "Presupuesto"),
    hourlyRate: money(r.hourlyRate, "Precio por hora"),
    ...(r.countHours === false ? { countHours: false } : {}),
    milestones: [],
    payments: [],
    time: [],
    createdAt: t,
    updatedAt: t,
  };
  await store.putProject(project);
  schedulePublish(project.clientId);
  return project;
}

/**
 * Cambios de un proyecto. Campos simples (name, status, fechas, budget…) y
 * operaciones sobre listas: addMilestone, updateMilestone, deleteMilestone,
 * addPayment, deletePayment, addTime, deleteTime.
 */
export async function updateProject(id: string, raw: unknown): Promise<Project> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const current = await store.getProject(id);
  if (!current) throw notFound("Proyecto no encontrado");
  const p: Project = { ...current, updatedAt: now() };

  if ("name" in r) {
    const name = str(r.name);
    if (!name) throw bad("El nombre no puede quedar vacío");
    p.name = name;
  }
  if ("description" in r) p.description = str(r.description, 5000);
  if ("status" in r) p.status = status(r.status)!;
  if ("startDate" in r) p.startDate = day(r.startDate, "Fecha de inicio");
  if ("dueDate" in r) p.dueDate = day(r.dueDate, "Fecha de entrega");
  if ("currency" in r) p.currency = currency(r.currency) ?? p.currency;
  if ("budget" in r) p.budget = money(r.budget, "Presupuesto");
  if ("hourlyRate" in r) p.hourlyRate = money(r.hourlyRate, "Precio por hora");
  if (typeof r.showPaymentsToClient === "boolean") p.showPaymentsToClient = r.showPaymentsToClient || undefined;
  if (typeof r.countHours === "boolean") p.countHours = r.countHours ? undefined : false;

  // Hitos
  const am = r.addMilestone as Record<string, unknown> | undefined;
  if (am) {
    const title = str(am.title);
    if (!title) throw bad("Escribe el hito");
    p.milestones = [
      ...p.milestones,
      { id: randomUUID(), title, dueAt: isoDate(am.dueAt), done: false, visibleToClient: am.visibleToClient !== false },
    ];
  }
  const um = r.updateMilestone as Record<string, unknown> | undefined;
  if (um) {
    const i = p.milestones.findIndex((m) => m.id === um.id);
    if (i === -1) throw notFound("Hito no encontrado");
    const m: Milestone = { ...p.milestones[i] };
    if ("title" in um) {
      const title = str(um.title);
      if (!title) throw bad("El hito no puede quedar vacío");
      m.title = title;
    }
    if ("dueAt" in um) m.dueAt = isoDate(um.dueAt);
    if (typeof um.done === "boolean") {
      m.done = um.done;
      m.doneAt = um.done ? now() : undefined;
    }
    if (typeof um.visibleToClient === "boolean") m.visibleToClient = um.visibleToClient;
    p.milestones = p.milestones.map((x, j) => (j === i ? m : x));
  }
  if (typeof r.deleteMilestone === "string") p.milestones = p.milestones.filter((m) => m.id !== r.deleteMilestone);

  // Pagos
  const ap = r.addPayment as Record<string, unknown> | undefined;
  if (ap) {
    const amount = money(ap.amount, "Importe");
    if (!amount) throw bad("Escribe el importe");
    p.payments = [...p.payments, { id: randomUUID(), amount, date: day(ap.date) ?? now().slice(0, 10), note: str(ap.note) }];
  }
  if (typeof r.deletePayment === "string") p.payments = p.payments.filter((x) => x.id !== r.deletePayment);

  // Horas
  const at = r.addTime as Record<string, unknown> | undefined;
  if (at) {
    const minutes = typeof at.minutes === "number" ? Math.round(at.minutes) : Math.round(Number(at.hours) * 60);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) throw bad("Tiempo no válido (máx. 24 h por registro)");
    p.time = [...p.time, { id: randomUUID(), date: day(at.date) ?? now().slice(0, 10), minutes, note: str(at.note) }];
  }
  if (typeof r.deleteTime === "string") p.time = p.time.filter((x) => x.id !== r.deleteTime);

  await store.putProject(p);
  schedulePublish(p.clientId);
  return p;
}

/** Borra el proyecto y sus tareas. */
export async function deleteProject(id: string) {
  const store = getStore();
  const project = await store.getProject(id);
  if (!project) throw notFound("Proyecto no encontrado");
  for (const t of await store.listTasks({ projectId: id })) await store.deleteTask(t.id);
  await detachExpenses({ projectId: id });
  await store.deleteProject(id);
  schedulePublish(project.clientId);
}

// ── Resumen para la lista de clientes ──

export async function clientsOverview() {
  const store = getStore();
  const [clients, projects, tasks] = await Promise.all([store.listClients(), store.listProjects(), store.listTasks()]);
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const rows = clients.map((c) => {
    const ps = projects.filter((p) => p.clientId === c.id);
    const open = ps.filter((p) => OPEN_STATUSES.includes(p.status));
    const deliveries = open
      .flatMap((p) => [
        ...(p.dueDate ? [{ date: p.dueDate, label: `Entrega: ${p.name}` }] : []),
        ...(nextMilestone(p) ? [{ date: nextMilestone(p)!.dueAt!.slice(0, 10), label: `${nextMilestone(p)!.title} · ${p.name}` }] : []),
      ])
      .sort((a, b) => a.date.localeCompare(b.date));
    const pending = new Map<string, number>();
    for (const p of ps) {
      const t = projectTotals(p);
      if (t.pending) pending.set(p.currency, (pending.get(p.currency) ?? 0) + t.pending);
    }
    const progress = open.length
      ? Math.round(open.reduce((s, p) => s + projectProgress(p, tasks.filter((t) => t.projectId === p.id)), 0) / open.length)
      : undefined;
    return {
      ...c,
      projects: ps.length,
      openProjects: open.length,
      progress,
      nextDelivery: deliveries[0],
      overdue: deliveries.some((d) => d.date < today),
      pending: [...pending].map(([currency, amount]) => ({ currency, amount })),
      pendingTasks: tasks.filter((t) => t.clientId === c.id && !t.done).length,
    };
  });

  const pendingTotals = new Map<string, number>();
  for (const r of rows) for (const x of r.pending) pendingTotals.set(x.currency, (pendingTotals.get(x.currency) ?? 0) + x.amount);
  return {
    clients: rows,
    stats: {
      active: rows.filter((r) => !r.archived && r.openProjects > 0).length,
      openProjects: projects.filter((p) => OPEN_STATUSES.includes(p.status)).length,
      dueThisWeek: rows.filter((r) => r.nextDelivery && r.nextDelivery.date >= today && r.nextDelivery.date <= in7).length,
      overdue: rows.filter((r) => r.overdue).length,
      pending: [...pendingTotals].map(([currency, amount]) => ({ currency, amount })),
    },
    defaultCurrency: defaultCurrency(),
  };
}

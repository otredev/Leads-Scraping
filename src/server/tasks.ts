import "server-only";
import { randomUUID } from "node:crypto";
import type { Task } from "@/core/crm";
import { getStore } from "./registry";

const badRequest = (m: string) => Object.assign(new Error(m), { status: 400 });

function cleanTitle(v: unknown) {
  const t = typeof v === "string" ? v.trim().slice(0, 200) : "";
  if (!t) throw badRequest("Escribe qué hay que hacer");
  return t;
}

/** Fecha opcional: vacía o null = sin fecha. */
function cleanDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = typeof v === "string" ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) throw badRequest("Fecha no válida");
  return d.toISOString();
}

export async function createTask(raw: unknown): Promise<Task> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const base = {
    id: randomUUID(),
    title: cleanTitle(r.title),
    ...(cleanDate(r.dueAt) ? { dueAt: cleanDate(r.dueAt) } : {}),
    done: false,
    createdAt: new Date().toISOString(),
  };
  let task: Task;
  if (typeof r.projectId === "string" || typeof r.clientId === "string") {
    // Tarea de un cliente (y opcionalmente de uno de sus proyectos).
    const project = typeof r.projectId === "string" ? await store.getProject(r.projectId) : undefined;
    if (r.projectId && !project) throw badRequest("Proyecto no encontrado");
    const client = await store.getClient(project?.clientId ?? String(r.clientId));
    if (!client) throw badRequest("Cliente no encontrado");
    task = {
      ...base,
      clientId: client.id,
      ...(project ? { projectId: project.id } : {}),
      leadName: client.name,
      ...(r.visibleToClient === true ? { visibleToClient: true } : {}),
    };
  } else {
    const lead = typeof r.leadId === "string" ? await store.getSavedLead(r.leadId) : undefined;
    if (!lead) throw badRequest("Lead no encontrado");
    task = { ...base, leadId: lead.id, leadName: lead.name };
  }
  await store.createTask(task);
  return task;
}

export async function updateTask(id: string, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const patch: Partial<Task> = {};
  if (r.title !== undefined) patch.title = cleanTitle(r.title);
  // null o "" quita la fecha (queda undefined y el almacenamiento la borra).
  if (r.dueAt !== undefined) {
    patch.dueAt = cleanDate(r.dueAt);
    patch.notifiedAt = undefined; // nueva fecha: volverá a avisar
  }
  if (typeof r.visibleToClient === "boolean") patch.visibleToClient = r.visibleToClient;
  const changes = Object.keys(r).filter((k) => ["title", "dueAt", "done", "visibleToClient"].includes(k));
  if (typeof r.done === "boolean") {
    patch.done = r.done;
    patch.doneAt = r.done ? new Date().toISOString() : undefined;
  }
  if (!changes.length) throw badRequest("No hay cambios");
  const task = await getStore().updateTask(id, patch);
  if (!task) throw Object.assign(new Error("Tarea no encontrada"), { status: 404 });
  return task;
}

export interface TaskListItem extends Task {
  /** Nombre actual del lead o cliente. */
  subject: string;
  /** Enlace a su ficha. */
  href: string;
  /** El lead o cliente sigue existiendo. */
  exists: boolean;
  /** @deprecated usa `exists`. */
  leadExists: boolean;
  projectName?: string;
}

/** Tareas con el nombre actual de su lead o cliente y el enlace a su ficha. */
export async function listTasks(opts: { leadId?: string; clientId?: string; projectId?: string } = {}): Promise<TaskListItem[]> {
  const store = getStore();
  const [tasks, leads, clients, projects] = await Promise.all([
    store.listTasks(opts),
    store.listSavedLeads(),
    store.listClients(),
    store.listProjects(),
  ]);
  const leadNames = new Map(leads.map((l) => [l.id, l.name]));
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  return tasks.map((t) => {
    if (t.clientId) {
      const exists = clientNames.has(t.clientId);
      return {
        ...t,
        subject: clientNames.get(t.clientId) ?? t.leadName,
        projectName: t.projectId ? projectNames.get(t.projectId) : undefined,
        href: `/clientes/${t.clientId}${t.projectId ? `?proyecto=${t.projectId}` : ""}`,
        exists,
        leadExists: exists,
      };
    }
    const exists = Boolean(t.leadId && leadNames.has(t.leadId));
    return {
      ...t,
      subject: (t.leadId && leadNames.get(t.leadId)) || t.leadName,
      href: `/leads?lead=${t.leadId}`,
      exists,
      leadExists: exists,
    };
  });
}

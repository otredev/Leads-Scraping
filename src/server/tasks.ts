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

function cleanDate(v: unknown) {
  const d = typeof v === "string" ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) throw badRequest("Fecha no válida");
  return d.toISOString();
}

export async function createTask(raw: unknown): Promise<Task> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const store = getStore();
  const lead = typeof r.leadId === "string" ? await store.getSavedLead(r.leadId) : undefined;
  if (!lead) throw badRequest("Lead no encontrado");
  const task: Task = {
    id: randomUUID(),
    leadId: lead.id,
    leadName: lead.name,
    title: cleanTitle(r.title),
    dueAt: cleanDate(r.dueAt),
    done: false,
    createdAt: new Date().toISOString(),
  };
  await store.createTask(task);
  return task;
}

export async function updateTask(id: string, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const patch: Partial<Task> = {};
  if (r.title !== undefined) patch.title = cleanTitle(r.title);
  if (r.dueAt !== undefined) patch.dueAt = cleanDate(r.dueAt);
  if (typeof r.done === "boolean") {
    patch.done = r.done;
    patch.doneAt = r.done ? new Date().toISOString() : undefined;
  }
  if (!Object.keys(patch).length) throw badRequest("No hay cambios");
  const task = await getStore().updateTask(id, patch);
  if (!task) throw Object.assign(new Error("Tarea no encontrada"), { status: 404 });
  return task;
}

/** Tareas con el nombre actual de su lead (y si sigue existiendo). */
export async function listTasks(leadId?: string) {
  const store = getStore();
  const [tasks, leads] = await Promise.all([store.listTasks({ leadId }), store.listSavedLeads()]);
  const names = new Map(leads.map((l) => [l.id, l.name]));
  return tasks.map((t) => ({ ...t, leadName: names.get(t.leadId) ?? t.leadName, leadExists: names.has(t.leadId) }));
}

import type { Task } from "./crm";
import type { Lead } from "./lead";

/** Agendar una tarea en el calendario del usuario (Google Calendar o archivo .ics). */

const DURATION_MIN = 30;

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function details(task: Task, lead?: Partial<Lead>) {
  return [
    `Lead: ${lead?.name ?? task.leadName}`,
    lead?.phone ? `Teléfono: ${lead.phone}` : "",
    lead?.emails?.[0] ? `Email: ${lead.emails[0]}` : "",
    lead?.address ? `Dirección: ${lead.address}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

type DatedTask = Task & { dueAt: string };

/** ¿Tiene fecha? (solo esas se pueden llevar al calendario o avisar). */
export function hasDue(task: Pick<Task, "dueAt">): task is DatedTask {
  return Boolean(task.dueAt) && !Number.isNaN(new Date(task.dueAt!).getTime());
}

export function googleCalendarLink(task: DatedTask, lead?: Partial<Lead>): string {
  const start = new Date(task.dueAt);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${task.title} · ${lead?.name ?? task.leadName}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: details(task, lead),
  });
  if (lead?.address) p.set("location", lead.address);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Archivo .ics (Outlook, Apple Calendar…) con un aviso 15 minutos antes. */
export function icsForTask(task: DatedTask, lead?: Partial<Lead>): string {
  const start = new Date(task.dueAt);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leads Scraping//ES",
    "BEGIN:VEVENT",
    `UID:${task.id}@leads-scraping`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${task.title} · ${lead?.name ?? task.leadName}`)}`,
    `DESCRIPTION:${esc(details(task, lead))}`,
    ...(lead?.address ? [`LOCATION:${esc(lead.address)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(task.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(task: DatedTask, lead?: Partial<Lead>) {
  const blob = new Blob([icsForTask(task, lead)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tarea-${task.id.slice(0, 8)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Agrupa tareas para la agenda. */
export type TaskBucket = "done" | "overdue" | "today" | "upcoming" | "nodate";

export function taskBucket(task: Pick<Task, "dueAt" | "done">, now = new Date()): TaskBucket {
  if (task.done) return "done";
  if (!hasDue(task)) return "nodate";
  const due = new Date(task.dueAt);
  if (due < now) return "overdue";
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return due <= end ? "today" : "upcoming";
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Orden de tareas: pendientes primero; con fecha (de antes a después) y luego sin fecha (más recientes primero). */
export function compareTasks(a: Pick<Task, "done" | "dueAt" | "createdAt">, b: Pick<Task, "done" | "dueAt" | "createdAt">): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

// ── Calendario interno (fechas en hora local) ──

/** "2026-10-27" en hora local. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana de `d`, a las 00:00. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
}

/** 42 días (6 semanas, de lunes a domingo) que cubren el mes de `month`. */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Mueve una fecha a otro día conservando la hora (o a las `hour` si no tenía). */
export function moveToDay(day: Date, previous?: string, hour = 10): Date {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (previous) {
    const p = new Date(previous);
    d.setHours(p.getHours(), p.getMinutes(), 0, 0);
  } else {
    d.setHours(hour, 0, 0, 0);
  }
  return d;
}

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

export function googleCalendarLink(task: Task, lead?: Partial<Lead>): string {
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
export function icsForTask(task: Task, lead?: Partial<Lead>): string {
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

export function downloadIcs(task: Task, lead?: Partial<Lead>) {
  const blob = new Blob([icsForTask(task, lead)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tarea-${task.id.slice(0, 8)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Agrupa tareas para la agenda. */
export function taskBucket(task: Pick<Task, "dueAt" | "done">, now = new Date()): "done" | "overdue" | "today" | "upcoming" {
  if (task.done) return "done";
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

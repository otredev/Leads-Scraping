"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Download, Trash2 } from "lucide-react";
import type { Lead } from "@/core/lead";
import { downloadIcs, googleCalendarLink, taskBucket, toLocalInput } from "@/core/calendar";
import { postJson, useData, type TaskView } from "../data/DataProvider";
import { MenuItem, Popover } from "../leads/Popover";

const dayFmt = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

export function formatDue(iso: string, now = new Date()) {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = sameDay(d, now) ? "Hoy" : sameDay(d, tomorrow) ? "Mañana" : sameDay(d, yesterday) ? "Ayer" : dayFmt.format(d);
  return `${day}, ${timeFmt.format(d)}`;
}

/** Una tarea: casilla de hecho, título, fecha, lead y menú (calendario, borrar). */
export function TaskRow({ task, lead, showLead = true }: { task: TaskView; lead?: Partial<Lead>; showLead?: boolean }) {
  const { refreshTasks } = useData();
  const [busy, setBusy] = useState(false);
  const bucket = taskBucket(task);

  async function patch(body: unknown, method = "PATCH") {
    setBusy(true);
    try {
      await postJson(`/api/tasks/${task.id}`, body, method);
      await refreshTasks();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-start gap-3 px-1 py-2">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
        checked={task.done}
        disabled={busy}
        onChange={(e) => void patch({ done: e.target.checked })}
        aria-label={task.done ? `Marcar "${task.title}" como pendiente` : `Marcar "${task.title}" como hecha`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.done ? "text-muted line-through" : "text-fg"}`}>{task.title}</p>
        <p className="text-xs">
          <span className={bucket === "overdue" ? "font-medium text-danger" : "text-muted"}>
            {bucket === "overdue" ? "Vencida · " : ""}
            {formatDue(task.dueAt)}
          </span>
          {showLead && (
            <>
              <span className="text-muted"> · </span>
              {task.leadExists ? (
                <Link href={`/leads?lead=${task.leadId}`} className="text-fg-2 underline decoration-line-strong underline-offset-2 hover:decoration-fg">
                  {task.leadName}
                </Link>
              ) : (
                <span className="text-muted">{task.leadName} (lead eliminado)</span>
              )}
            </>
          )}
        </p>
      </div>
      <Popover
        buttonClassName="btn btn-ghost size-7 p-0"
        width="w-56"
        label={<CalendarPlus className="size-4" aria-label={`Opciones de "${task.title}"`} />}
      >
        {(close) => (
          <>
            <a
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
              href={googleCalendarLink(task, lead)}
              target="_blank"
              rel="noreferrer"
              onClick={close}
            >
              <CalendarPlus className="size-4" aria-hidden /> Añadir a Google Calendar
            </a>
            <MenuItem
              onClick={() => {
                close();
                downloadIcs(task, lead);
              }}
            >
              <Download className="size-4" aria-hidden /> Descargar .ics (Outlook, Apple)
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                close();
                void patch(undefined, "DELETE");
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Borrar tarea
            </MenuItem>
          </>
        )}
      </Popover>
    </li>
  );
}

function preset(kind: "today" | "tomorrow" | "week") {
  const d = new Date();
  if (kind === "today") {
    d.setHours(Math.max(d.getHours() + 1, 17), 0, 0, 0);
  } else if (kind === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 7);
    d.setHours(10, 0, 0, 0);
  }
  return toLocalInput(d);
}

/** Crear una tarea para un lead. */
export function TaskForm({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const { refreshTasks } = useData();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => preset("tomorrow"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          await postJson("/api/tasks", { leadId, title, dueAt: new Date(due).toISOString() });
          setTitle("");
          await refreshTasks();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input"
        placeholder="Qué hay que hacer: llamar, enviar presupuesto, visitar…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Nueva tarea"
        maxLength={200}
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="datetime-local"
          className="input min-w-0"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Fecha y hora"
          required
        />
        <button className="btn btn-primary" disabled={busy || disabled || !title.trim()}>
          Añadir tarea
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Rápido:</span>
        {(
          [
            ["today", "Hoy"],
            ["tomorrow", "Mañana 10:00"],
            ["week", "En 1 semana"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="btn btn-sm py-0.5 text-xs" onClick={() => setDue(preset(k))}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </form>
  );
}

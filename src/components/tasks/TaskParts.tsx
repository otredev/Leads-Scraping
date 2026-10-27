"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CalendarPlus, CalendarX, Download, Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import type { Lead } from "@/core/lead";
import { downloadIcs, googleCalendarLink, hasDue, taskBucket, toLocalInput } from "@/core/calendar";
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
  const [editingDue, setEditingDue] = useState<string>();
  const bucket = taskBucket(task);
  const dated = hasDue(task) ? task : undefined;

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
        <p className={`flex items-center gap-1.5 text-sm ${task.done ? "text-muted line-through" : "text-fg"}`}>
          {task.title}
          {task.clientId && task.visibleToClient && <Eye className="size-3.5 text-muted" aria-label="Visible para el cliente" />}
        </p>
        <p className="text-xs">
          <span className={bucket === "overdue" ? "font-medium text-danger" : "text-muted"}>
            {bucket === "overdue" ? "Vencida · " : ""}
            {dated ? formatDue(dated.dueAt) : "Sin fecha"}
          </span>
          {showLead && (
            <>
              <span className="text-muted"> · </span>
              {task.exists ? (
                <Link href={task.href} className="text-fg-2 underline decoration-line-strong underline-offset-2 hover:decoration-fg">
                  {task.subject}
                  {task.projectName ? ` · ${task.projectName}` : ""}
                </Link>
              ) : (
                <span className="text-muted">
                  {task.subject} ({task.clientId ? "cliente eliminado" : "lead eliminado"})
                </span>
              )}
            </>
          )}
        </p>
        {editingDue !== undefined && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingDue) return;
              void patch({ dueAt: new Date(editingDue).toISOString() }).then(() => setEditingDue(undefined));
            }}
          >
            <input
              type="datetime-local"
              className="input w-auto py-1 text-[13px]"
              value={editingDue}
              onChange={(e) => setEditingDue(e.target.value)}
              aria-label={`Fecha de "${task.title}"`}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" disabled={busy || !editingDue}>
              Guardar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDue(undefined)}>
              Cancelar
            </button>
          </form>
        )}
      </div>
      <Popover
        buttonClassName="btn btn-ghost size-7 p-0"
        width="w-56"
        label={<MoreHorizontal className="size-4" aria-label={`Opciones de "${task.title}"`} />}
      >
        {(close) => (
          <>
            {task.clientId && (
              <MenuItem
                onClick={() => {
                  close();
                  void patch({ visibleToClient: !task.visibleToClient });
                }}
              >
                {task.visibleToClient ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                {task.visibleToClient ? "Ocultar al cliente" : "Mostrar al cliente"}
              </MenuItem>
            )}
            {!task.done && (
              <MenuItem
                onClick={() => {
                  close();
                  setEditingDue(dated ? toLocalInput(new Date(dated.dueAt)) : preset("tomorrow"));
                }}
              >
                <CalendarClock className="size-4" aria-hidden /> {dated ? "Cambiar fecha" : "Poner fecha"}
              </MenuItem>
            )}
            {dated && !task.done && (
              <MenuItem
                onClick={() => {
                  close();
                  void patch({ dueAt: null });
                }}
              >
                <CalendarX className="size-4" aria-hidden /> Quitar fecha
              </MenuItem>
            )}
            {dated && (
              <>
                <a
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                  href={googleCalendarLink(dated, lead)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                >
                  <CalendarPlus className="size-4" aria-hidden /> Añadir a Google Calendar
                </a>
                <MenuItem
                  onClick={() => {
                    close();
                    downloadIcs(dated, lead);
                  }}
                >
                  <Download className="size-4" aria-hidden /> Descargar .ics (Outlook, Apple)
                </MenuItem>
              </>
            )}
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

/** Crear una tarea para un lead, o para un cliente / proyecto. */
export function TaskForm({
  leadId,
  clientId,
  projectId,
  disabled,
  onCreated,
}: {
  leadId?: string;
  clientId?: string;
  projectId?: string;
  disabled?: boolean;
  onCreated?(): void;
}) {
  const { refreshTasks } = useData();
  const [title, setTitle] = useState("");
  const [visible, setVisible] = useState(true);
  const forClient = Boolean(clientId || projectId);
  // Vacío = sin fecha (la fecha es opcional).
  const [due, setDue] = useState("");
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
          const target = forClient ? { clientId, projectId, visibleToClient: visible } : { leadId };
          await postJson("/api/tasks", { ...target, title, ...(due ? { dueAt: new Date(due).toISOString() } : {}) });
          setTitle("");
          setDue("");
          await refreshTasks();
          onCreated?.();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input"
        placeholder={forClient ? "Qué hay que hacer: diseñar portada, revisar textos…" : "Qué hay que hacer: llamar, enviar presupuesto, visitar…"}
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
          aria-label="Fecha y hora (opcional)"
        />
        <button className="btn btn-primary" disabled={busy || disabled || !title.trim()}>
          Añadir tarea
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{due ? "Fecha:" : "Fecha opcional:"}</span>
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
        {due && (
          <button type="button" className="btn btn-ghost btn-sm py-0.5 text-xs" onClick={() => setDue("")}>
            Sin fecha
          </button>
        )}
        {forClient && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-fg-2">
            <input type="checkbox" className="size-3.5 accent-primary" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Visible para el cliente
          </label>
        )}
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </form>
  );
}

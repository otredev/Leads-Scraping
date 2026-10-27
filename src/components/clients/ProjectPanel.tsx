"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  PROJECT_STATUSES,
  formatMinutes,
  formatMoney,
  projectProgress,
  projectTotals,
  type Milestone,
  type Project,
} from "@/core/clients";
import { compareTasks } from "@/core/calendar";
import { useData } from "../data/DataProvider";
import { MenuItem, Popover } from "../leads/Popover";
import { TaskForm, TaskRow } from "../tasks/TaskParts";
import { Card } from "../ui";
import { ProjectForm } from "./ProjectForm";

const dayFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (d?: string) => (d ? dayFmt.format(new Date(d.length === 10 ? `${d}T12:00:00` : d)) : "");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "1:30", "1,5", "90m" → minutos */
function parseDuration(v: string): number | undefined {
  const s = v.trim().toLowerCase().replace(",", ".");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m(in)?$/))) return Math.round(Number(m[1]));
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h?$/))) return Math.round(Number(m[1]) * 60);
  return undefined;
}

type Patch = (body: Record<string, unknown>) => Promise<void>;

/** Detalle de un proyecto: estado, cronograma, tareas, dinero y horas. */
export function ProjectPanel({ project, onPatch, onDelete }: { project: Project; onPatch: Patch; onDelete(): Promise<void>; }) {
  const { tasks } = useData();
  const [editing, setEditing] = useState(false);
  const projectTasks = tasks.filter((t) => t.projectId === project.id).sort(compareTasks);
  const progress = projectProgress(project, projectTasks);
  const totals = projectTotals(project);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-col gap-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
              <p className="text-[13px] text-muted">
                {[project.startDate && `Inicio ${fmtDay(project.startDate)}`, project.dueDate && `Entrega ${fmtDay(project.dueDate)}`].filter(Boolean).join(" · ") ||
                  "Sin fechas"}
              </p>
            </div>
            <select
              className="input w-auto py-1.5 text-sm"
              value={project.status}
              onChange={(e) => void onPatch({ status: e.target.value })}
              aria-label="Estado del proyecto"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Popover buttonClassName="btn btn-ghost size-9 p-0" width="w-48" label={<MoreHorizontal className="size-4" aria-label="Opciones del proyecto" />}>
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close();
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden /> Editar proyecto
                  </MenuItem>
                  <MenuItem
                    danger
                    onClick={() => {
                      close();
                      if (window.confirm(`¿Borrar "${project.name}" con sus hitos, tareas, pagos y horas?`)) void onDelete();
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /> Borrar proyecto
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">Avance</span>
              <span className="tabular-nums text-fg-2">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary-track" aria-hidden>
              <div className="h-full rounded-full bg-chart transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <p className="hint mt-1.5">{project.milestones.length ? "Según los hitos completados." : "Según las tareas completadas (añade hitos para el cronograma)."}</p>
          </div>
          {project.description && <p className="whitespace-pre-wrap text-sm text-fg-2">{project.description}</p>}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <Timeline project={project} onPatch={onPatch} />
        <Card title={`Tareas${projectTasks.filter((t) => !t.done).length ? ` (${projectTasks.filter((t) => !t.done).length} pendientes)` : ""}`}>
          <div className="flex flex-col gap-3">
            <TaskForm clientId={project.clientId} projectId={project.id} />
            {projectTasks.length > 0 && (
              <ul className="-mx-1 divide-y divide-line">
                {projectTasks.map((t) => (
                  <TaskRow key={t.id} task={t} showLead={false} />
                ))}
              </ul>
            )}
          </div>
        </Card>
        <MoneyCard project={project} totals={totals} onPatch={onPatch} />
        <TimeCard project={project} totals={totals} onPatch={onPatch} />
      </div>

      {editing && (
        <ProjectForm
          clientId={project.clientId}
          project={project}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onPatch({});
          }}
        />
      )}
    </div>
  );
}

/** Cronograma: hitos ordenados por fecha, con su estado y visibilidad para el cliente. */
function Timeline({ project, onPatch }: { project: Project; onPatch: Patch }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const today = todayStr();
  const sorted = [...project.milestones].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const state = (m: Milestone) => (m.done ? "done" : m.dueAt && m.dueAt.slice(0, 10) < today ? "late" : "open");

  return (
    <Card title="Cronograma" description="Hitos y entregas del proyecto">
      <div className="flex flex-col gap-4">
        {sorted.length ? (
          <ol className="relative flex flex-col gap-3 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-line">
            {sorted.map((m) => {
              const s = state(m);
              return (
                <li key={m.id} className="group relative flex items-start gap-2">
                  <button
                    className={`absolute -left-6 top-0.5 grid size-[19px] place-items-center rounded-full border-2 ${
                      s === "done" ? "border-fg bg-fg text-bg" : s === "late" ? "border-danger bg-surface" : "border-line-strong bg-surface"
                    }`}
                    onClick={() => void onPatch({ updateMilestone: { id: m.id, done: !m.done } })}
                    aria-label={m.done ? `Marcar "${m.title}" como pendiente` : `Marcar "${m.title}" como hecho`}
                  >
                    {m.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${m.done ? "text-muted line-through" : ""}`}>{m.title}</p>
                    <p className={`text-xs ${s === "late" ? "font-medium text-danger" : "text-muted"}`}>
                      {s === "late" ? "Retrasado · " : ""}
                      {m.dueAt ? fmtDay(m.dueAt) : "Sin fecha"}
                      {m.done && m.doneAt ? ` · hecho el ${fmtDay(m.doneAt)}` : ""}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost size-7 p-0 text-muted"
                    onClick={() => void onPatch({ updateMilestone: { id: m.id, visibleToClient: !m.visibleToClient } })}
                    title={m.visibleToClient ? "Visible para el cliente (pulsa para ocultar)" : "Solo interno (pulsa para mostrar al cliente)"}
                    aria-label={m.visibleToClient ? `Ocultar "${m.title}" al cliente` : `Mostrar "${m.title}" al cliente`}
                  >
                    {m.visibleToClient ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                  </button>
                  <button
                    className="btn btn-ghost size-7 p-0 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                    onClick={() => void onPatch({ deleteMilestone: m.id })}
                    aria-label={`Borrar hito "${m.title}"`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="hint">Divide el proyecto en hitos con fecha (&ldquo;Diseño aprobado&rdquo;, &ldquo;Web publicada&rdquo;). Marcarlos hace avanzar el proyecto.</p>
        )}

        <form
          className="flex flex-col gap-2 border-t border-line pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onPatch({ addMilestone: { title, dueAt: date ? new Date(`${date}T12:00:00`).toISOString() : undefined, visibleToClient: visible } });
              setTitle("");
              setDate("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input" placeholder="Nuevo hito…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nuevo hito" maxLength={200} />
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha del hito" />
            <label className="flex items-center gap-1.5 text-xs text-fg-2">
              <input type="checkbox" className="size-3.5 accent-primary" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              Visible para el cliente
            </label>
            <button className="btn btn-primary btn-sm ml-auto" disabled={busy || !title.trim()}>
              <Plus className="size-3.5" aria-hidden /> Añadir hito
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}

type Totals = ReturnType<typeof projectTotals>;

function MoneyCard({ project, totals, onPatch }: { project: Project; totals: Totals; onPatch: Patch }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = project.currency;
  const paidPct = project.budget ? Math.min(100, Math.round((totals.paid / project.budget) * 100)) : undefined;

  return (
    <Card title="Presupuesto y pagos">
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Presupuesto", formatMoney(project.budget, cur)],
            ["Pagado", formatMoney(totals.paid, cur)],
            ["Pendiente", totals.pending !== undefined ? formatMoney(totals.pending, cur) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-2 px-2 py-2.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {paidPct !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-primary-track" aria-label={`${paidPct}% cobrado`}>
            <div className="h-full rounded-full bg-chart" style={{ width: `${paidPct}%` }} />
          </div>
        )}
        {!project.budget && <p className="hint">Añade el presupuesto desde &ldquo;Editar proyecto&rdquo; para ver lo pendiente.</p>}

        {project.payments.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {[...project.payments]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((p) => (
                <li key={p.id} className="group flex items-center gap-3 py-1.5">
                  <span className="w-24 shrink-0 text-xs text-muted">{fmtDay(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-2">{p.note ?? "Pago"}</span>
                  <span className="font-medium tabular-nums">{formatMoney(p.amount, cur)}</span>
                  <button
                    className="btn btn-ghost size-7 p-0 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                    onClick={() => void onPatch({ deletePayment: p.id })}
                    aria-label="Borrar pago"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
          </ul>
        )}

        <form
          className="grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-[130px_150px_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onPatch({ addPayment: { amount, date, note } });
              setAmount("");
              setNote("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input" inputMode="decimal" placeholder={`Importe (${cur})`} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Importe" />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha del pago" />
          <input className="input col-span-2 sm:col-span-1" placeholder="Concepto (anticipo, factura 12…)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Concepto" />
          <button className="btn btn-primary col-span-2 sm:col-span-1" disabled={busy || !amount.trim()}>
            Añadir pago
          </button>
        </form>
      </div>
    </Card>
  );
}

function TimeCard({ project, totals, onPatch }: { project: Project; totals: Totals; onPatch: Patch }) {
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Card
      title="Horas"
      description={
        totals.minutes
          ? `${formatMinutes(totals.minutes)} en total${totals.timeCost !== undefined ? ` · ${formatMoney(totals.timeCost, project.currency)} a ${formatMoney(project.hourlyRate, project.currency)}/h` : ""}`
          : "Registra el tiempo dedicado"
      }
    >
      <div className="flex flex-col gap-4">
        {project.time.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {[...project.time]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => (
                <li key={t.id} className="group flex items-center gap-3 py-1.5">
                  <span className="w-24 shrink-0 text-xs text-muted">{fmtDay(t.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-2">{t.note ?? "Trabajo"}</span>
                  <span className="font-medium tabular-nums">{formatMinutes(t.minutes)}</span>
                  <button
                    className="btn btn-ghost size-7 p-0 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                    onClick={() => void onPatch({ deleteTime: t.id })}
                    aria-label="Borrar registro de horas"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
          </ul>
        )}
        <form
          className="grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-[130px_150px_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const minutes = parseDuration(duration);
            if (!minutes) return setError("Escribe el tiempo como 1:30, 1,5 o 90m");
            setError(undefined);
            setBusy(true);
            try {
              await onPatch({ addTime: { minutes, date, note } });
              setDuration("");
              setNote("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input" placeholder="1:30" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Tiempo (1:30, 1,5 o 90m)" />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
          <input className="input col-span-2 sm:col-span-1" placeholder="Qué hiciste" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Descripción" />
          <button className="btn btn-primary col-span-2 sm:col-span-1" disabled={busy || !duration.trim()}>
            Añadir horas
          </button>
          {error && <p className="col-span-full text-[13px] text-danger">{error}</p>}
        </form>
      </div>
    </Card>
  );
}

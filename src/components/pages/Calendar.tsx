"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarArrowDown, ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import { addDays, compareTasks, dayKey, hasDue, monthGrid, moveToDay, startOfWeek, taskBucket } from "@/core/calendar";
import { api, postJson, useData, type TaskView } from "../data/DataProvider";
import { LeadPicker, type LeadOption } from "../calendar/LeadPicker";
import { TaskRow } from "../tasks/TaskParts";
import { ColorDot } from "../leads/parts";
import { Card, Loading, Notice, PageHeader, Skeleton } from "../ui";

type View = "month" | "week";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const monthFmt = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
});
const dayTitleFmt = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortFmt = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DRAG_TYPE = "application/x-task-id";

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Fecha de hoy ("2026-10-27") solo en el navegador: en el servidor no hay "hoy" (prerender). */
function useToday(): string | null {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 60_000);
      return () => clearInterval(t);
    },
    () => dayKey(new Date()),
    () => null,
  );
}

/** Calendario interno: tareas por día, con vista de mes y de semana. */
export function CalendarPage() {
  const { tasks, tasksLoaded, refreshTasks, settings } = useData();
  const [view, setView] = useState<View>("month");
  const today = useToday();
  const [cursorState, setCursor] = useState<Date>();
  const [selectedState, setSelected] = useState<string>();
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string>();
  const [dragOver, setDragOver] = useState<string>();
  // Cambios optimistas (al arrastrar) válidos hasta que llegue la lista nueva de tareas.
  const [pending, setPending] = useState<{
    base: TaskView[];
    dueAt: Record<string, string>;
  }>({ base: tasks, dueAt: {} });
  const [leads, setLeads] = useState<LeadOption[]>();

  useEffect(() => {
    api<SavedLead[]>("/api/leads")
      .then((list) =>
        setLeads(
          list.map(({ id, name, category, address, stage }) => ({
            id,
            name,
            category,
            address,
            stage,
          })),
        ),
      )
      .catch(() => setLeads([]));
  }, []);

  const view_tasks = useMemo(() => {
    const over = pending.base === tasks ? pending.dueAt : {};
    return tasks.map((t) => (over[t.id] ? { ...t, dueAt: over[t.id] } : t));
  }, [tasks, pending]);

  const leadById = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l])), [leads]);
  const stageColor = (t: TaskView) => {
    const lead = leadById.get(t.leadId);
    return settings?.stages.find((s) => s.id === lead?.stage)?.color;
  };

  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of view_tasks) {
      if (!hasDue(t) || (t.done && !showDone)) continue;
      const k = dayKey(new Date(t.dueAt));
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    for (const list of map.values()) list.sort(compareTasks);
    return map;
  }, [view_tasks, showDone]);

  const undated = view_tasks.filter((t) => !t.done && !hasDue(t)).sort(compareTasks);
  const todayKey = today ?? "2000-01-01";
  const cursor = cursorState ?? fromKey(todayKey);
  const selected = selectedState ?? todayKey;

  async function moveTask(id: string, day: Date) {
    const task = view_tasks.find((t) => t.id === id);
    if (!task) return;
    const dueAt = moveToDay(day, task.dueAt).toISOString();
    if (task.dueAt === dueAt) return;
    setError(undefined);
    setPending((p) => ({
      base: tasks,
      dueAt: { ...(p.base === tasks ? p.dueAt : {}), [id]: dueAt },
    }));
    try {
      await postJson(`/api/tasks/${id}`, { dueAt }, "PATCH");
      await refreshTasks();
    } catch (err) {
      setPending({ base: tasks, dueAt: {} });
      setError((err as Error).message);
    }
  }

  const dropProps = (day: Date) => {
    const key = dayKey(day);
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOver !== key) setDragOver(key);
      },
      onDragLeave: () => setDragOver((k) => (k === key ? undefined : k)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(undefined);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) {
          setSelected(key);
          void moveTask(id, day);
        }
      },
    };
  };

  function shift(dir: -1 | 1) {
    setCursor(view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1) : addDays(cursor, 7 * dir));
  }

  const days = view === "month" ? monthGrid(cursor) : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const title =
    view === "month" ? cap(monthFmt.format(cursor)) : `${shortFmt.format(days[0])} – ${shortFmt.format(days[6])} ${days[6].getFullYear()}`;
  const selectedDate = fromKey(selected);

  const loading = !tasksLoaded || !today;

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Tus tareas por día. Arrastra una tarea a otro día para cambiarla de fecha."
        actions={
          <div role="radiogroup" aria-label="Vista" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            {(
              [
                ["month", "Mes"],
                ["week", "Semana"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={view === id}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}

      {/* En la vista de semana el calendario usa todo el ancho y los paneles van debajo. */}
      <div className={`grid grid-cols-1 gap-5 ${view === "month" ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <Card bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost size-8 p-0"
                onClick={() => shift(-1)}
                aria-label={view === "month" ? "Mes anterior" : "Semana anterior"}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                className="btn btn-ghost size-8 p-0"
                onClick={() => shift(1)}
                aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"}
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <h2 className="order-first min-w-0 basis-full text-base font-semibold sm:order-none sm:basis-auto sm:flex-1" aria-live="polite">
              {loading ? <Skeleton className="h-5 w-40" /> : title}
            </h2>
            <button
              className="btn btn-sm ml-auto sm:ml-0"
              onClick={() => {
                setCursor(undefined);
                setSelected(undefined);
              }}
            >
              Hoy
            </button>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" className="size-4 accent-primary" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Completadas
            </label>
          </div>

          {loading ? (
            <Loading label="Cargando calendario…">
              <div className="grid grid-cols-7 gap-px p-4">
                {Array.from({ length: 35 }, (_, i) => (
                  <Skeleton key={i} className="h-20 rounded-md" />
                ))}
              </div>
            </Loading>
          ) : view === "month" ? (
            <div role="grid" aria-label={title}>
              <div role="row" className="grid grid-cols-7 border-b border-line">
                {WEEKDAYS.map((d) => (
                  <div key={d} role="columnheader" className="px-2 py-2 text-center text-xs font-medium text-muted">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = dayKey(day);
                  const list = byDay.get(key) ?? [];
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = key === todayKey;
                  const isSelected = key === selected;
                  return (
                    <div
                      key={key}
                      role="gridcell"
                      aria-selected={isSelected}
                      className={`relative flex min-h-16 flex-col gap-1 border-line p-1 text-left sm:min-h-28 sm:p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${
                        inMonth ? "" : "bg-surface-2/60"
                      } ${dragOver === key ? "bg-primary-soft" : ""} ${isSelected ? "outline-2 -outline-offset-2 outline-fg" : ""}`}
                      onClick={() => setSelected(key)}
                      {...dropProps(day)}
                    >
                      <button
                        className={`grid size-6 place-items-center rounded-full text-xs font-medium sm:size-7 ${
                          isToday ? "bg-primary text-primary-fg" : inMonth ? "text-fg" : "text-muted"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(key);
                        }}
                        aria-label={`${dayTitleFmt.format(day)}${list.length ? `, ${list.length} tareas` : ""}`}
                      >
                        {day.getDate()}
                      </button>
                      {/* Móvil: puntos. Escritorio: hasta 3 tareas. */}
                      {list.length > 0 && (
                        <div className="flex gap-0.5 px-1 sm:hidden" aria-hidden>
                          {list.slice(0, 3).map((t) => (
                            <span key={t.id} className={`size-1.5 rounded-full ${taskBucket(t) === "overdue" ? "bg-danger" : "bg-fg-2"}`} />
                          ))}
                        </div>
                      )}
                      <div className="hidden flex-col gap-0.5 sm:flex">
                        {list.slice(0, 3).map((t) => (
                          <TaskChip key={t.id} task={t} color={stageColor(t)} />
                        ))}
                        {list.length > 3 && <span className="px-1 text-[11px] text-muted">+{list.length - 3} más</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-7">
              {days.map((day, i) => {
                const key = dayKey(day);
                const list = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <section
                    key={key}
                    aria-label={dayTitleFmt.format(day)}
                    className={`flex min-h-24 flex-col gap-1.5 border-line p-2 lg:min-h-[420px] ${i ? "border-t lg:border-t-0 lg:border-l" : ""} ${
                      dragOver === key ? "bg-primary-soft" : ""
                    } ${key === selected ? "outline-2 -outline-offset-2 outline-fg" : ""}`}
                    onClick={() => setSelected(key)}
                    {...dropProps(day)}
                  >
                    <header className="flex items-center gap-2 px-1">
                      <span className="text-xs font-medium text-muted">{WEEKDAYS[i]}</span>
                      <span
                        className={`grid size-7 place-items-center rounded-full text-sm font-semibold ${isToday ? "bg-primary text-primary-fg" : ""}`}
                      >
                        {day.getDate()}
                      </span>
                    </header>
                    {list.map((t) => (
                      <TaskChip key={t.id} task={t} color={stageColor(t)} showLead wrap />
                    ))}
                    {!list.length && <span className="px-1 text-xs text-muted lg:hidden">Sin tareas</span>}
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        <div className={`grid grid-cols-1 items-start gap-5 ${view === "week" ? "lg:grid-cols-2" : ""}`}>
          <Card
            title={loading ? <Skeleton className="h-5 w-44" /> : cap(dayTitleFmt.format(selectedDate))}
            description={!loading && selected === todayKey ? "Hoy" : undefined}
          >
            <DayPanel
              day={selectedDate}
              tasks={(byDay.get(selected) ?? []).concat(
                showDone ? [] : view_tasks.filter((t) => t.done && hasDue(t) && dayKey(new Date(t.dueAt)) === selected),
              )}
              leads={leads}
              onCreated={refreshTasks}
            />
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                Sin fecha <span className="badge border border-line text-muted">{undated.length}</span>
              </span>
            }
            description="Arrástralas a un día o pásalas al día seleccionado"
          >
            {undated.length ? (
              <ul className="flex flex-col gap-1.5">
                {undated.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <TaskChip task={t} color={stageColor(t)} showLead />
                    </div>
                    <button
                      className="btn btn-ghost size-8 shrink-0 p-0 text-muted"
                      onClick={() => void moveTask(t.id, selectedDate)}
                      title={`Pasar al ${shortFmt.format(selectedDate)}`}
                      aria-label={`Pasar "${t.title}" al ${shortFmt.format(selectedDate)}`}
                    >
                      <CalendarArrowDown className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">Todas tus tareas pendientes tienen fecha.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Tarea compacta y arrastrable. */
function TaskChip({ task, color, showLead, wrap }: { task: TaskView; color?: string; showLead?: boolean; wrap?: boolean }) {
  const bucket = taskBucket(task);
  const time = hasDue(task) ? timeFmt.format(new Date(task.dueAt)) : undefined;
  return (
    <div
      draggable={!task.done}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group flex min-w-0 items-start gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1 text-[12px] leading-tight ${
        task.done ? "opacity-60" : "cursor-grab active:cursor-grabbing"
      }`}
      title={`${task.title} · ${task.leadName}${time ? ` · ${time}` : ""}`}
    >
      <ColorDot color={color ?? "gray"} className="mt-[3px] size-2" />
      <span className="min-w-0 flex-1">
        {wrap && time && <span className="block tabular-nums text-[11px] text-muted">{time}</span>}
        <span
          className={`block ${wrap ? "line-clamp-3 hyphens-auto" : "truncate"} ${task.done ? "line-through" : ""} ${
            bucket === "overdue" ? "text-danger" : "text-fg"
          }`}
        >
          {!wrap && time && <span className="mr-1 tabular-nums text-muted">{time}</span>}
          {task.title}
        </span>
        {showLead && <span className="block truncate text-[11px] text-muted">{task.leadName}</span>}
      </span>
      {!task.done && <GripVertical className="mt-px hidden size-3 text-muted group-hover:block" aria-hidden />}
    </div>
  );
}

/** Tareas del día seleccionado y formulario para crear una en ese día. */
function DayPanel({ day, tasks, leads, onCreated }: { day: Date; tasks: TaskView[]; leads?: LeadOption[]; onCreated(): Promise<void> }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("10:00");
  const [lead, setLead] = useState<LeadOption>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const sorted = [...tasks].sort(compareTasks);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return setError("Elige el lead de la tarea");
    setBusy(true);
    setError(undefined);
    try {
      const [h, m] = (time || "10:00").split(":").map(Number);
      const due = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      await postJson("/api/tasks", {
        leadId: lead.id,
        title,
        dueAt: due.toISOString(),
      });
      setTitle("");
      await onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sorted.length ? (
        <ul className="-mx-1 divide-y divide-line">
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <p className="hint">No hay tareas este día.</p>
      )}

      {adding ? (
        <form className="flex flex-col gap-2 border-t border-line pt-4" onSubmit={create}>
          <input
            className="input"
            placeholder="Qué hay que hacer…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Nueva tarea"
            maxLength={200}
            autoFocus
          />
          <LeadPicker leads={leads} value={lead} onChange={setLead} />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <input type="time" className="input w-auto" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora" />
            <button className="btn btn-primary" disabled={busy || !title.trim() || !lead}>
              Añadir tarea
            </button>
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          {leads && leads.length === 0 && (
            <p className="hint">
              Las tareas van unidas a un lead.{" "}
              <Link href="/leads" className="underline underline-offset-2">
                Guarda alguno
              </Link>{" "}
              primero.
            </p>
          )}
        </form>
      ) : (
        <button className="btn btn-sm self-start" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" aria-hidden /> Nueva tarea este día
        </button>
      )}
    </div>
  );
}

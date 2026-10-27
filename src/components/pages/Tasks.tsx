"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { taskBucket } from "@/core/calendar";
import { useData, type TaskView } from "../data/DataProvider";
import { TaskRow } from "../tasks/TaskParts";
import { PushButton } from "../notifications/PushButton";
import { Card, EmptyState, ListSkeleton, Loading, PageHeader } from "../ui";

const SECTIONS = [
  { id: "overdue", title: "Vencidas", empty: "Nada vencido." },
  { id: "today", title: "Hoy", empty: "Nada más para hoy." },
  { id: "upcoming", title: "Próximas", empty: "Sin tareas programadas." },
  { id: "nodate", title: "Sin fecha", empty: "Todas tus tareas tienen fecha." },
] as const;

/** Agenda: tareas de todos los leads agrupadas por cuándo vencen. */
export function Tasks() {
  const { tasks, tasksLoaded } = useData();
  const [showDone, setShowDone] = useState(false);
  const loading = !tasksLoaded;

  const groups = new Map<string, TaskView[]>();
  for (const t of tasks) {
    const b = taskBucket(t);
    groups.set(b, [...(groups.get(b) ?? []), t]);
  }
  const done = (groups.get("done") ?? []).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  return (
    <>
      <PageHeader
        title="Tareas"
        description="Seguimientos de tus leads. Créalas desde la ficha de cada lead."
        actions={
          <>
            <Link href="/calendario" className="btn">
              <CalendarDays className="size-4" aria-hidden /> Ver calendario
            </Link>
            <PushButton />
          </>
        }
      />

      {loading ? (
        <Card>
          <Loading label="Cargando tareas…">
            <ListSkeleton rows={6} />
          </Loading>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tienes tareas"
          action={
            <Link href="/leads" className="btn btn-primary">
              Ir a Leads
            </Link>
          }
        >
          Abre un lead y añade una tarea: &ldquo;Llamar el lunes a las 10&rdquo;. La fecha es opcional; si la pones, te avisaré cuando llegue el
          momento y podrás llevarla a tu calendario.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {SECTIONS.map((s) => {
            const list = groups.get(s.id) ?? [];
            return (
              <Card
                key={s.id}
                title={
                  <span className="flex items-center gap-2">
                    {s.title}
                    <span className={`badge ${s.id === "overdue" && list.length ? "bg-danger-soft text-danger" : "border border-line text-muted"}`}>
                      {list.length}
                    </span>
                  </span>
                }
              >
                {list.length ? (
                  <ul className="-mx-1 divide-y divide-line">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                ) : (
                  <p className="hint">{s.empty}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <Card className="mt-5" bodyClassName="px-5 pb-4">
          <button className="flex w-full items-center gap-2 pt-4 pb-1 text-left text-sm font-semibold" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            Completadas <span className="font-normal text-muted">{done.length}</span>
            <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${showDone ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showDone && (
            <ul className="-mx-1 divide-y divide-line">
              {done.slice(0, 100).map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </Card>
      )}

      <p className="mt-6 text-xs text-muted">
        Los avisos funcionan mientras la app esté abierta en alguna pestaña. Para recordatorios en el móvil, añade la tarea a tu calendario
        desde su menú.
      </p>
    </>
  );
}

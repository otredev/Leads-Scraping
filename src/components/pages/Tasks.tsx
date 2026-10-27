"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import { taskBucket } from "@/core/calendar";
import { useData, type TaskView } from "../data/DataProvider";
import { TaskRow } from "../tasks/TaskParts";
import { Card, EmptyState, ListSkeleton, Loading, PageHeader } from "../ui";

type Perm = "unsupported" | NotificationPermission;

const permListeners = new Set<() => void>();
function readPerm(): Perm {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function usePermission() {
  return useSyncExternalStore(
    (cb) => {
      permListeners.add(cb);
      return () => permListeners.delete(cb);
    },
    readPerm,
    () => "default" as Perm,
  );
}

const SECTIONS = [
  { id: "overdue", title: "Vencidas", empty: "Nada vencido." },
  { id: "today", title: "Hoy", empty: "Nada más para hoy." },
  { id: "upcoming", title: "Próximas", empty: "Sin tareas programadas." },
] as const;

/** Agenda: tareas de todos los leads agrupadas por cuándo vencen. */
export function Tasks() {
  const { tasks, tasksLoaded } = useData();
  const perm = usePermission();
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
          perm === "default" ? (
            <button
              className="btn"
              onClick={async () => {
                await Notification.requestPermission();
                permListeners.forEach((l) => l());
              }}
            >
              <Bell className="size-4" aria-hidden /> Activar avisos del navegador
            </button>
          ) : perm === "granted" ? (
            <span className="badge border border-line text-fg-2">
              <Bell className="size-3.5" aria-hidden /> Avisos activados
            </span>
          ) : perm === "denied" ? (
            <span className="badge border border-line text-muted" title="Puedes permitirlas en la configuración del sitio del navegador">
              <BellOff className="size-3.5" aria-hidden /> Avisos bloqueados en el navegador
            </span>
          ) : null
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
          Abre un lead y añade una tarea con fecha y hora: &ldquo;Llamar el lunes a las 10&rdquo;. Te avisaré cuando llegue el momento y podrás
          llevarla a tu calendario.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
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

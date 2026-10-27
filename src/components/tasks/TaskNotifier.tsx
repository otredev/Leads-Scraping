"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useData, type TaskView } from "../data/DataProvider";
import { formatDue } from "./TaskParts";
import { getPushSubscription, showNotification } from "@/lib/pwa";

const KEY = "notified-tasks";
const WINDOW_MS = 60 * 60_000; // solo avisa de tareas vencidas en la última hora

function readNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveNotified(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* sin almacenamiento: puede repetir algún aviso */
  }
}

/**
 * Avisos de tareas: cuando llega la hora de una tarea muestra un aviso en la
 * app y, si el usuario lo ha permitido, una notificación del navegador.
 * Funciona mientras la app esté abierta en alguna pestaña.
 */
export function TaskNotifier() {
  const { tasks } = useData();
  const [toasts, setToasts] = useState<TaskView[]>([]);

  useEffect(() => {
    let pushActive = false;
    const check = () => {
      const now = Date.now();
      const notified = readNotified();
      const due = tasks.filter((t) => {
        if (!t.dueAt) return false; // sin fecha: no hay nada que avisar
        const at = new Date(t.dueAt).getTime();
        return !t.done && at <= now && now - at < WINDOW_MS && !notified.has(t.id);
      });
      if (!due.length) return;
      for (const t of due) {
        notified.add(t.id);
        // Con push activo en este navegador, el servidor ya envía la notificación del sistema.
        if (!pushActive) {
          void showNotification(t.title, {
            body: `${t.subject} · ${formatDue(t.dueAt!)}`,
            tag: t.id,
            url: t.exists ? t.href : "/tareas",
          });
        }
      }
      saveNotified(notified);
      setToasts((list) => [...due, ...list].slice(0, 4));
    };
    // Primero mira si este navegador tiene push (para no duplicar avisos).
    getPushSubscription()
      .then((sub) => (pushActive = Boolean(sub)))
      .catch(() => undefined)
      .finally(check);
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer);
  }, [tasks]);

  // Los avisos se cierran solos a los 20 s (la tarea sigue en Tareas).
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts((list) => list.slice(0, -1)), 20_000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="card flex items-start gap-3 p-3 shadow-pop">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-muted">
              {t.exists ? (
                <Link href={t.href} className="underline underline-offset-2" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}>
                  {t.subject}
                </Link>
              ) : (
                t.subject
              )}{" "}
              · {formatDue(t.dueAt!)}
            </p>
          </div>
          <button className="text-muted hover:text-fg" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} aria-label="Cerrar aviso">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

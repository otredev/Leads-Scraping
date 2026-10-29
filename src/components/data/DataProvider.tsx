"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Search } from "@/core/search";
import type { CrmSettings, Task } from "@/core/crm";

/** Tarea tal como la devuelve /api/tasks (con el nombre y enlace de su lead o cliente). */
export type TaskView = Task & { leadExists: boolean; subject: string; href: string; exists: boolean; projectName?: string };
import type { ModulesInfo } from "../types";
import { hardNavigate } from "../auth/safeNext";

interface DataContextValue {
  modules?: ModulesInfo;
  searches: Search[];
  /** Claves de los leads guardados (para marcar resultados como "guardado"). */
  savedKeys: Set<string>;
  /** Claves de los leads marcados "no contactar". */
  dncKeys: Set<string>;
  /** Etapas, etiquetas y preferencias del CRM. */
  settings?: CrmSettings;
  refreshSettings(): Promise<void>;
  /** Guarda un cambio de ajustes (PATCH /api/settings) y actualiza el estado. */
  patchSettings(body: unknown): Promise<CrmSettings>;
  setSettings(s: CrmSettings): void;
  /** Todas las tareas (se refrescan cada minuto). */
  tasks: TaskView[];
  tasksLoaded: boolean;
  refreshTasks(): Promise<void>;
  /** true hasta la primera respuesta de /api/searches. */
  loading: boolean;
  error?: string;
  refreshSearches(): Promise<void>;
  refreshModules(): Promise<void>;
  refreshSaved(): Promise<void>;
  addSearch(search: Search): void;
}

const DataContext = createContext<DataContextValue | null>(null);

/** fetch + JSON que convierte las respuestas de error de la API en excepciones legibles. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  // Sesión caducada o cerrada desde otro dispositivo: a iniciar sesión (y volver aquí después).
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    hardNavigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new Error("Inicia sesión para continuar");
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body as T;
}

export function postJson<T>(url: string, data: unknown, method = "POST") {
  return api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

/**
 * Estado compartido por todas las páginas: módulos, búsquedas y claves de
 * leads guardados. Mientras haya búsquedas en curso, refresca cada 3 s.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<ModulesInfo>();
  const [searches, setSearches] = useState<Search[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [dncKeys, setDncKeys] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<CrmSettings>();
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refreshSearches = useCallback(
    () =>
      api<Search[]>("/api/searches")
        .then((data) => {
          setSearches(data);
          setError(undefined);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );

  const refreshModules = useCallback(
    () =>
      api<ModulesInfo>("/api/modules")
        .then(setModules)
        .catch((e: Error) => setError(e.message)),
    [],
  );

  const refreshSaved = useCallback(
    () =>
      api<{ saved: string[]; dnc: string[] }>("/api/leads/keys")
        .then((k) => {
          setSavedKeys(new Set(k.saved));
          setDncKeys(new Set(k.dnc));
        })
        .catch(() => undefined),
    [],
  );

  const refreshSettings = useCallback(
    () =>
      api<CrmSettings>("/api/settings")
        .then(setSettings)
        .catch(() => undefined),
    [],
  );

  const refreshTasks = useCallback(
    () =>
      api<TaskView[]>("/api/tasks")
        .then(setTasks)
        .catch(() => undefined)
        .finally(() => setTasksLoaded(true)),
    [],
  );

  // Las tareas vencen con el tiempo: se refrescan cada minuto.
  useEffect(() => {
    const t = setInterval(refreshTasks, 60_000);
    return () => clearInterval(t);
  }, [refreshTasks]);

  const patchSettings = useCallback(async (body: unknown) => {
    const next = await postJson<CrmSettings>("/api/settings", body, "PATCH");
    setSettings(next);
    return next;
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([refreshModules(), refreshSearches(), refreshSaved(), refreshSettings(), refreshTasks()]));
  }, [refreshModules, refreshSearches, refreshSaved, refreshSettings, refreshTasks]);

  const anyActive = searches.some((s) => s.status === "running" || s.status === "queued");
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(refreshSearches, 3000);
    return () => clearInterval(t);
  }, [anyActive, refreshSearches]);

  const addSearch = useCallback((s: Search) => setSearches((list) => [s, ...list]), []);

  const value = useMemo(
    () => ({
      modules,
      searches,
      savedKeys,
      dncKeys,
      settings,
      loading,
      error,
      refreshSearches,
      refreshModules,
      refreshSaved,
      refreshSettings,
      patchSettings,
      setSettings,
      tasks,
      tasksLoaded,
      refreshTasks,
      addSearch,
    }),
    [modules, searches, savedKeys, dncKeys, settings, loading, error, refreshSearches, refreshModules, refreshSaved, refreshSettings, patchSettings, tasks, tasksLoaded, refreshTasks, addSearch],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}

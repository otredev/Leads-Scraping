"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Search } from "@/core/search";
import type { ModulesInfo } from "../types";

interface DataContextValue {
  modules?: ModulesInfo;
  searches: Search[];
  /** Claves de los leads guardados (para marcar resultados como "guardado"). */
  savedKeys: Set<string>;
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
      api<string[]>("/api/leads/keys")
        .then((keys) => setSavedKeys(new Set(keys)))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([refreshModules(), refreshSearches(), refreshSaved()]));
  }, [refreshModules, refreshSearches, refreshSaved]);

  const anyActive = searches.some((s) => s.status === "running" || s.status === "queued");
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(refreshSearches, 3000);
    return () => clearInterval(t);
  }, [anyActive, refreshSearches]);

  const addSearch = useCallback((s: Search) => setSearches((list) => [s, ...list]), []);

  const value = useMemo(
    () => ({ modules, searches, savedKeys, loading, error, refreshSearches, refreshModules, refreshSaved, addSearch }),
    [modules, searches, savedKeys, loading, error, refreshSearches, refreshModules, refreshSaved, addSearch],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}

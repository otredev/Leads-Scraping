"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Search } from "@/core/search";
import type { ModulesInfo } from "../types";

interface DataContextValue {
  modules?: ModulesInfo;
  searches: Search[];
  /** true hasta la primera respuesta de /api/searches. */
  loading: boolean;
  error?: string;
  refreshSearches(): Promise<void>;
  refreshModules(): Promise<void>;
  addSearch(search: Search): void;
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Estado compartido por todas las páginas: módulos registrados y búsquedas.
 * Mientras haya búsquedas en curso, refresca su estado cada 3 s.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<ModulesInfo>();
  const [searches, setSearches] = useState<Search[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refreshSearches = useCallback(
    () =>
      fetch("/api/searches", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: Search[]) => {
          setSearches(data);
          setError(undefined);
        })
        .catch(() => setError("No se pudo conectar con el servidor de la app."))
        .finally(() => setLoading(false)),
    [],
  );

  const refreshModules = useCallback(
    () =>
      fetch("/api/modules", { cache: "no-store" })
        .then((r) => r.json())
        .then(setModules)
        .catch(() => setError("No se pudieron cargar los módulos.")),
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([refreshModules(), refreshSearches()]));
  }, [refreshModules, refreshSearches]);

  const anyActive = searches.some((s) => s.status === "running" || s.status === "queued");
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(refreshSearches, 3000);
    return () => clearInterval(t);
  }, [anyActive, refreshSearches]);

  const addSearch = useCallback((s: Search) => setSearches((list) => [s, ...list]), []);

  const value = useMemo(
    () => ({ modules, searches, loading, error, refreshSearches, refreshModules, addSearch }),
    [modules, searches, loading, error, refreshSearches, refreshModules, addSearch],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}

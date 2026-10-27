import "server-only";
import { exporters, providers, sources, storages } from "@/modules";
import type { LeadStore } from "@/core/storage";

export function getProvider(id: string) {
  return providers.find((p) => p.id === id);
}

export function getSource(id: string) {
  return sources.find((s) => s.id === id);
}

export function getExporter(id: string) {
  return exporters.find((e) => e.id === id);
}

const g = globalThis as unknown as { __leadStore?: LeadStore };

/** Instancia única del almacenamiento (sobrevive a recargas en desarrollo). */
export function getStorageModule() {
  const wanted = process.env.STORAGE || (process.env.MONGODB_URI ? "mongodb" : undefined);
  return (wanted && storages.find((s) => s.id === wanted)) || storages[0];
}

export function getStore(): LeadStore {
  if (!g.__leadStore) g.__leadStore = getStorageModule().create();
  return g.__leadStore;
}

/** Crea una instancia de otro almacenamiento (p. ej. para migrar datos). */
export function createStorage(id: string): LeadStore | undefined {
  return storages.find((s) => s.id === id)?.create();
}

export { providers, sources, exporters, storages };

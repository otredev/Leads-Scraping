import "server-only";
import { enrichers, exporters, providers, sources, storages } from "@/modules";
import type { LeadStore } from "@/core/storage";
import { currentTenant } from "./tenant";

export function getProvider(id: string) {
  return providers.find((p) => p.id === id);
}

export function getSource(id: string) {
  return sources.find((s) => s.id === id);
}

export function getExporter(id: string) {
  return exporters.find((e) => e.id === id);
}

const g = globalThis as unknown as { __leadStores?: Map<string, LeadStore> };
const stores = (g.__leadStores ??= new Map());

/** Instancia única del almacenamiento (sobrevive a recargas en desarrollo). */
export function getStorageModule() {
  const wanted = process.env.STORAGE || (process.env.MONGODB_URI ? "mongodb" : undefined);
  return (wanted && storages.find((s) => s.id === wanted)) || storages[0];
}

/** Almacenamiento de la cuenta con sesión iniciada (cada usuario ve solo sus datos). */
export function getStore(): LeadStore {
  const { dataKey } = currentTenant();
  const key = `${getStorageModule().id}:${dataKey}`;
  let store = stores.get(key);
  if (!store) {
    store = getStorageModule().create(dataKey);
    stores.set(key, store);
  }
  return store;
}

/** Crea una instancia de otro almacenamiento para la misma cuenta (p. ej. para migrar datos). */
export function createStorage(id: string): LeadStore | undefined {
  return storages.find((s) => s.id === id)?.create(currentTenant().dataKey);
}

/** Borra todos los datos de una cuenta (al eliminarla) y olvida su instancia. */
export async function destroyTenantData(dataKey: string) {
  const mod = getStorageModule();
  await mod.destroy?.(dataKey);
  stores.delete(`${mod.id}:${dataKey}`);
}

export function getEnricher(id: string) {
  return enrichers.find((e) => e.id === id);
}

export { providers, sources, exporters, storages, enrichers };

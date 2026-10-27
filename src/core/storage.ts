import type { Lead } from "./lead";
import type { Search } from "./search";

/**
 * Almacenamiento de búsquedas y leads. La implementación por defecto guarda
 * JSON en disco; se puede cambiar por SQLite, Postgres, Supabase… creando otro
 * módulo que cumpla esta interfaz.
 */
export interface LeadStore {
  listSearches(): Promise<Search[]>;
  getSearch(id: string): Promise<Search | undefined>;
  createSearch(search: Search): Promise<void>;
  updateSearch(id: string, patch: Partial<Search>): Promise<Search | undefined>;
  deleteSearch(id: string): Promise<void>;

  /** Guarda leads deduplicando dentro de la búsqueda. Devuelve cuántos eran nuevos. */
  addLeads(searchId: string, leads: Lead[]): Promise<number>;
  /** Leads de una búsqueda, o de todas si no se indica. */
  listLeads(searchId?: string): Promise<Lead[]>;
}

export interface StorageModule {
  id: string;
  create(): LeadStore;
}

export function defineStorage(s: StorageModule): StorageModule {
  return s;
}

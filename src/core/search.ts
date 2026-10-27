import type { OptionValues } from "./options";

/** Parámetros comunes a cualquier búsqueda, sea cual sea el proveedor. */
export interface SearchParams {
  /** Una o varias consultas, p. ej. "dentistas en Valencia". */
  queries: string[];
  /** Código de idioma de 2 letras. */
  lang: string;
  /** País (ISO de 2 letras) para interpretar teléfonos sin prefijo. */
  country?: string;
  /** Máximo de leads a guardar (opcional). */
  limit?: number;
  /** Opciones propias del proveedor (ver `LeadProvider.options`). */
  options: OptionValues;
  /** Búsqueda creada para volver a extraer estos leads guardados. */
  refreshLeadIds?: string[];
}

export type SearchStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface SearchProgress {
  message: string;
  /** 0–100, si el proveedor puede estimarlo. */
  percent?: number;
}

/** Una búsqueda (trabajo de extracción) y su estado. */
export interface Search {
  id: string;
  name: string;
  providerId: string;
  sourceId: string;
  params: SearchParams;
  status: SearchStatus;
  progress?: SearchProgress;
  error?: string;
  /** Estado opaco del proveedor para poder reanudar (p. ej. id de trabajo remoto). */
  checkpoint?: unknown;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export const ACTIVE_STATUSES: SearchStatus[] = ["queued", "running"];

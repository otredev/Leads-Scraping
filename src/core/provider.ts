import type { LeadInput } from "./lead";
import type { OptionField } from "./options";
import type { SearchParams, SearchProgress } from "./search";

/**
 * Una FUENTE es de dónde salen los datos (Google Maps, Yelp, Páginas Amarillas…).
 * Un PROVEEDOR es la herramienta concreta que los obtiene de una fuente
 * (gosom, Apify, la API oficial…). Una fuente puede tener varios proveedores.
 */
export interface SourceDefinition {
  id: string;
  name: string;
  description: string;
}

export interface HealthStatus {
  ok: boolean;
  message: string;
}

/** Lo que la app pone a disposición del proveedor mientras se ejecuta. */
export interface RunContext {
  /** Se activa si el usuario cancela la búsqueda. */
  signal: AbortSignal;
  /** Checkpoint guardado en una ejecución anterior (para reanudar tras reiniciar). */
  checkpoint: unknown;
  saveCheckpoint(data: unknown): Promise<void>;
  progress(p: SearchProgress): void;
  /** Entrega leads (se pueden emitir por lotes, la app deduplica y guarda). */
  emit(leads: LeadInput[]): Promise<void>;
  log(message: string): void;
}

export interface LeadProvider {
  id: string;
  name: string;
  description: string;
  /** Id de la fuente a la que pertenece. */
  sourceId: string;
  /** Opciones propias, la UI genera el formulario a partir de aquí. */
  options: OptionField[];
  /** Comprueba si el proveedor está listo (servicio levantado, API key, etc.). */
  health(): Promise<HealthStatus>;
  /**
   * Ejecuta la búsqueda. Debe resolver cuando termina, lanzar un error si falla
   * y respetar `ctx.signal` para cancelar.
   */
  run(params: SearchParams, ctx: RunContext): Promise<void>;
  /** Limpieza opcional en el servicio externo al cancelar/eliminar. */
  cancel?(checkpoint: unknown): Promise<void>;
}

/** Ayuda para escribir proveedores con tipado completo. */
export function defineProvider(p: LeadProvider): LeadProvider {
  return p;
}

export function defineSource(s: SourceDefinition): SourceDefinition {
  return s;
}

/** Espera `ms` respetando la cancelación. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function abortError(): Error {
  const e = new Error("Búsqueda cancelada");
  e.name = "AbortError";
  return e;
}

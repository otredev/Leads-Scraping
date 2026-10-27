import type { HealthStatus } from "./provider";
import type { Lead } from "./lead";
import type { Socials } from "./socials";

/**
 * Enriquecedores: completan datos de un lead que ya existe (redes sociales,
 * emails, teléfonos…) a partir de otra fuente: su web, una API, otro scraper.
 *
 * A diferencia de un proveedor (que busca negocios), un enriquecedor recibe un
 * lead concreto y devuelve solo lo que ha encontrado. La app lo fusiona sin
 * borrar nada: añade emails y redes, y rellena campos vacíos.
 *
 * Para añadir uno (p. ej. Hunter, Apify, Outscraper): crea un módulo en
 * src/modules/enrichers/ con defineEnricher y regístralo en src/modules/index.ts.
 */

export interface EnrichResult {
  emails?: string[];
  socials?: Socials;
  /** Solo se usa si el lead no tiene teléfono. */
  phone?: string;
  /** Solo se usa si el lead no tiene web. */
  website?: string;
  /** Datos propios del enriquecedor; se guardan en lead.extra[<id>]. */
  extra?: Record<string, unknown>;
  /** Explicación corta si no se pudo (p. ej. "La web no responde"). */
  note?: string;
}

export interface EnrichContext {
  signal: AbortSignal;
}

export interface Enricher {
  id: string;
  label: string;
  description: string;
  /** Qué datos puede aportar (para la interfaz). */
  provides: ("emails" | "socials" | "phone" | "website")[];
  /** Si el lead no cumple esto, ni se intenta (p. ej. "necesita web"). */
  canEnrich(lead: Lead): boolean;
  requirement?: string;
  /** Peticiones en paralelo recomendadas. */
  concurrency?: number;
  health(): Promise<HealthStatus>;
  enrich(lead: Lead, ctx: EnrichContext): Promise<EnrichResult>;
}

export function defineEnricher(e: Enricher): Enricher {
  return e;
}

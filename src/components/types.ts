import type { OptionField } from "@/core/options";
import type { HealthStatus, SourceDefinition } from "@/core/provider";

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  sourceId: string;
  options: OptionField[];
  acceptsMapsUrls?: boolean;
  health: HealthStatus;
}

export interface ExporterInfo {
  id: string;
  label: string;
  extension: string;
  options: OptionField[];
}

export interface ModulesInfo {
  sources: SourceDefinition[];
  providers: ProviderInfo[];
  exporters: ExporterInfo[];
  storage: { id: string; label: string; health: HealthStatus; localDataAvailable: boolean };
  defaults: { country: string; lang: string; trashDays: number };
  enrichers: { id: string; label: string; description: string; provides: string[]; requirement?: string; health: HealthStatus }[];
  /** Endpoint MCP para Claude y si exige token (MCP_TOKEN). */
  mcp: { path: string; token: boolean };
}

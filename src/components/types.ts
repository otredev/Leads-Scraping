import type { OptionField } from "@/core/options";
import type { HealthStatus, SourceDefinition } from "@/core/provider";

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  sourceId: string;
  options: OptionField[];
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
  storage: { id: string };
}

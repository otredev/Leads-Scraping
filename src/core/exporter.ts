import type { Lead } from "./lead";
import type { LeadField } from "./fields";
import type { OptionField, OptionValues } from "./options";

/** Un formato de exportación (CSV, JSON, Excel…). */
export interface Exporter {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  options: OptionField[];
  export(leads: Lead[], fields: LeadField[], options: OptionValues): string | Uint8Array;
}

export function defineExporter(e: Exporter): Exporter {
  return e;
}

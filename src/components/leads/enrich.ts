import { socialLabel } from "@/core/socials";

/** Forma del trabajo de enriquecimiento que devuelve la API. */
export interface EnrichResultView {
  leadId: string;
  name: string;
  status: "updated" | "nothing" | "skipped" | "error";
  addedEmails: number;
  addedSocials: string[];
  addedPhone?: boolean;
  note?: string;
}

export interface EnrichJobView {
  id: string;
  total: number;
  done: number;
  updated: number;
  status: "running" | "done" | "cancelled";
  results: EnrichResultView[];
}

/** "Añadido: Instagram, Facebook y 2 emails" */
export function describeEnrichResult(r: EnrichResultView): { text: string; ok: boolean } {
  if (r.status !== "updated") return { text: r.note ?? "Sin datos nuevos", ok: false };
  const parts = [
    ...r.addedSocials.map(socialLabel),
    ...(r.addedEmails ? [`${r.addedEmails} ${r.addedEmails === 1 ? "email" : "emails"}`] : []),
    ...(r.addedPhone ? ["teléfono"] : []),
  ];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : parts[0];
  return { text: `Añadido: ${list}.`, ok: true };
}

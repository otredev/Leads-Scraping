import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { handle, readJson } from "@/server/http";
import { saveLowRating, saveStages, saveTablePrefs, saveTags, saveTemplates } from "@/server/crm";

export const GET = handle(async () => {
  await connection();
  return Response.json(await getStore().getSettings());
});

/**
 * Cambia una parte de los ajustes del CRM (una por petición):
 *   { stages: Stage[], moveTo?: string }   etapas (las borradas pasan sus leads a moveTo)
 *   { tags: Tag[] }                       etiquetas (las borradas se quitan de los leads)
 *   { table: "results"|"saved", prefs }   filtros predeterminados y columnas
 *   { lowRating: number }                 umbral de "Valoración baja"
 *   { templates: MessageTemplate[] }      plantillas de WhatsApp y email
 */
export const PATCH = handle(async (request: Request) => {
  const body = await readJson<Record<string, unknown>>(request);
  if ("stages" in body) return Response.json(await saveStages(body.stages, body.moveTo as string | undefined));
  if ("tags" in body) return Response.json(await saveTags(body.tags));
  if (body.table === "results" || body.table === "saved") return Response.json(await saveTablePrefs(body.table, body.prefs));
  if ("templates" in body) return Response.json(await saveTemplates(body.templates));
  if ("lowRating" in body) return Response.json(await saveLowRating(body.lowRating));
  return Response.json({ error: "Nada que cambiar" }, { status: 400 });
});

import { handle, readJson } from "@/server/http";
import { importLeads } from "@/server/crm";

/** Importa leads: { rows: ImportRow[], stage?, tags?: string[], country? } */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ rows?: unknown; stage?: string; tags?: string[]; country?: string }>(request);
  return Response.json(await importLeads(body.rows, { stage: body.stage, tags: body.tags, country: body.country }));
});

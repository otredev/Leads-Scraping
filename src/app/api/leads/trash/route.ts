import { getStore } from "@/server/registry";
import { handle, idsFrom, readJson } from "@/server/http";
import { trashSaved } from "@/server/crm";

/** Mueve a la papelera: { ids } */
export const POST = handle(async (request: Request) => {
  const ids = idsFrom(await readJson(request));
  return Response.json({ trashed: await trashSaved(ids) });
});

/** Borra definitivamente: { ids } o { all: true } para vaciar la papelera. */
export const DELETE = handle(async (request: Request) => {
  const body = await readJson<{ all?: boolean }>(request);
  const ids = idsFrom(body);
  if (!body.all && !ids.length) return Response.json({ error: "Indica qué borrar" }, { status: 400 });
  return Response.json({ purged: await getStore().purgeLeads(body.all ? undefined : ids) });
});

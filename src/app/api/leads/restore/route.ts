import { getStore } from "@/server/registry";
import { handle, idsFrom, readJson } from "@/server/http";

/** Saca de la papelera: { ids } */
export const POST = handle(async (request: Request) => {
  const ids = idsFrom(await readJson(request));
  return Response.json({ restored: await getStore().restoreLeads(ids) });
});

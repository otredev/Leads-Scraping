import { handle, idsFrom, readJson } from "@/server/http";
import { startRefresh } from "@/server/crm";

/** Vuelve a extraer los datos de leads guardados: { ids }. Devuelve la búsqueda creada. */
export const POST = handle(async (request: Request) => {
  const ids = idsFrom(await readJson(request));
  return Response.json(await startRefresh(ids), { status: 201 });
});

import type { NextRequest } from "next/server";
import { getStore } from "@/server/registry";
import { handle } from "@/server/http";

/** Resultados de una búsqueda (?searchId=) o de todas. El filtrado se hace en cliente. */
export const GET = handle(async (request: NextRequest) => {
  const searchId = request.nextUrl.searchParams.get("searchId") || undefined;
  return Response.json(await getStore().listLeads(searchId));
});

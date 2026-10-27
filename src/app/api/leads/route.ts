import type { NextRequest } from "next/server";
import { getStore } from "@/server/registry";

/** Leads de una búsqueda (?searchId=) o de todas. El filtrado se hace en cliente. */
export async function GET(request: NextRequest) {
  const searchId = request.nextUrl.searchParams.get("searchId") || undefined;
  return Response.json(await getStore().listLeads(searchId));
}

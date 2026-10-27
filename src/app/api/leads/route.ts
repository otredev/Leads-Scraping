import type { NextRequest } from "next/server";
import { getStore } from "@/server/registry";
import { handle, idsFrom, readJson } from "@/server/http";
import { saveResults } from "@/server/crm";

/** Leads guardados. ?trash=1 devuelve los de la papelera. */
export const GET = handle(async (request: NextRequest) => {
  const trash = request.nextUrl.searchParams.get("trash") === "1";
  return Response.json(await getStore().listSavedLeads({ trash }));
});

/** Guarda resultados en el CRM: { ids: string[], searchId?: string } */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ ids?: string[]; searchId?: string }>(request);
  const ids = idsFrom(body);
  if (!ids.length) return Response.json({ error: "No hay leads que guardar" }, { status: 400 });
  return Response.json(await saveResults(ids, body.searchId || undefined));
});

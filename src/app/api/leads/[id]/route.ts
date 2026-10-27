import type { NextRequest } from "next/server";
import { getStore } from "@/server/registry";
import { handle, readJson } from "@/server/http";
import { updateSaved } from "@/server/crm";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/leads/[id]">) => {
  const { id } = await ctx.params;
  const lead = await getStore().getSavedLead(id);
  if (!lead) return Response.json({ error: "Lead no encontrado" }, { status: 404 });
  return Response.json(lead);
});

/** Cambios en un lead (incluidas notas): devuelve el lead actualizado. */
export const PATCH = handle(async (request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) => {
  const { id } = await ctx.params;
  await updateSaved([id], await readJson(request));
  const lead = await getStore().getSavedLead(id);
  if (!lead) return Response.json({ error: "Lead no encontrado" }, { status: 404 });
  return Response.json(lead);
});

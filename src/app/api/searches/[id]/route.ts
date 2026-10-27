import type { NextRequest } from "next/server";
import { handle } from "@/server/http";
import { getStore } from "@/server/registry";
import { deleteSearch } from "@/server/runner";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/searches/[id]">) => {
  const { id } = await ctx.params;
  const search = await getStore().getSearch(id);
  if (!search) return Response.json({ error: "Búsqueda no encontrada" }, { status: 404 });
  return Response.json(search);
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/searches/[id]">) => {
  const { id } = await ctx.params;
  await deleteSearch(id);
  return new Response(null, { status: 204 });
});

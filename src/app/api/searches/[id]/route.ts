import type { NextRequest } from "next/server";
import { getStore } from "@/server/registry";
import { deleteSearch } from "@/server/runner";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/searches/[id]">) {
  const { id } = await ctx.params;
  const search = await getStore().getSearch(id);
  if (!search) return Response.json({ error: "Búsqueda no encontrada" }, { status: 404 });
  return Response.json(search);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/searches/[id]">) {
  const { id } = await ctx.params;
  await deleteSearch(id);
  return new Response(null, { status: 204 });
}

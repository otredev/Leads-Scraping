import type { NextRequest } from "next/server";
import { rerunSearch } from "@/server/runner";
import { handle } from "@/server/http";

export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/searches/[id]/rerun">) => {
  const { id } = await ctx.params;
  return Response.json(await rerunSearch(id), { status: 201 });
});

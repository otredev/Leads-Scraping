import type { NextRequest } from "next/server";
import { handle } from "@/server/http";
import { cancelSearch } from "@/server/runner";

export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/searches/[id]/cancel">) => {
  const { id } = await ctx.params;
  await cancelSearch(id);
  return new Response(null, { status: 204 });
});

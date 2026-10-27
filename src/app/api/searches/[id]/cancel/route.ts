import type { NextRequest } from "next/server";
import { cancelSearch } from "@/server/runner";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/searches/[id]/cancel">) {
  const { id } = await ctx.params;
  await cancelSearch(id);
  return new Response(null, { status: 204 });
}

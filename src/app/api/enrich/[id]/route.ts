import { handle } from "@/server/http";
import { cancelEnrichJob, getEnrichJob } from "@/server/enrich";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/enrich/[id]">) => {
  const job = getEnrichJob((await ctx.params).id);
  return job ? Response.json(job) : Response.json({ error: "Trabajo no encontrado (los terminados se olvidan pasada una hora)" }, { status: 404 });
});

/** Cancela un trabajo en curso. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/enrich/[id]">) => {
  cancelEnrichJob((await ctx.params).id);
  return new Response(null, { status: 204 });
});

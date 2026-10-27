import type { NextRequest } from "next/server";
import { handle, readJson } from "@/server/http";
import { getStore } from "@/server/registry";
import { updateTask } from "@/server/tasks";

/** Cambia una tarea: { title?, dueAt?, done? } */
export const PATCH = handle(async (request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await updateTask(id, await readJson(request)));
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) => {
  const { id } = await ctx.params;
  await getStore().deleteTask(id);
  return new Response(null, { status: 204 });
});

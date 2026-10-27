import { handle, readJson } from "@/server/http";
import { deleteProject, updateProject } from "@/server/clients";

/** Cambios del proyecto, hitos, pagos y horas (ver updateProject). */
export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  return Response.json(await updateProject((await ctx.params).id, await readJson(request)));
});

/** Borra el proyecto y sus tareas. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  await deleteProject((await ctx.params).id);
  return new Response(null, { status: 204 });
});

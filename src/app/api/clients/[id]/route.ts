import { handle, readJson } from "@/server/http";
import { getStore } from "@/server/registry";
import { deleteClient, updateClient } from "@/server/clients";

/** Cliente con sus proyectos. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/clients/[id]">) => {
  const { id } = await ctx.params;
  const store = getStore();
  const client = await store.getClient(id);
  if (!client) return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
  return Response.json({ client, projects: await store.listProjects({ clientId: id }) });
});

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/clients/[id]">) => {
  return Response.json(await updateClient((await ctx.params).id, await readJson(request)));
});

/** Borra el cliente, sus proyectos y sus tareas. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/clients/[id]">) => {
  await deleteClient((await ctx.params).id);
  return new Response(null, { status: 204 });
});

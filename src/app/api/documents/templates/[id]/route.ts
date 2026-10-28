import { handle, readJson } from "@/server/http";
import { deleteTemplate, saveTemplate } from "@/server/documents";

export const PATCH = handle(async (request: Request, { params }: RouteContext<"/api/documents/templates/[id]">) =>
  Response.json(await saveTemplate(await readJson(request), (await params).id)),
);

/** Borra una plantilla tuya o, en las incluidas, vuelve a la versión original. */
export const DELETE = handle(async (_request: Request, { params }: RouteContext<"/api/documents/templates/[id]">) => {
  await deleteTemplate((await params).id);
  return new Response(null, { status: 204 });
});

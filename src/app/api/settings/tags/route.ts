import { handle, readJson } from "@/server/http";
import { createTag } from "@/server/crm";

/** Crea una etiqueta: { name, color? }. Si ya existe una con ese nombre, la devuelve. */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ name?: unknown; color?: unknown }>(request);
  return Response.json(await createTag(body.name, body.color), { status: 201 });
});

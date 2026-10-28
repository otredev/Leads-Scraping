import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { deleteDocument, getDocument, updateDocument } from "@/server/documents";

export const GET = handle(async (_request: Request, { params }: RouteContext<"/api/documents/[id]">) => {
  await connection();
  return Response.json(await getDocument((await params).id));
});

/** Cambia un borrador: { title, body, lines, irpf, date, dueDate, notes, projectId } o { visibleToClient }. */
export const PATCH = handle(async (request: Request, { params }: RouteContext<"/api/documents/[id]">) =>
  Response.json(await updateDocument((await params).id, await readJson(request))),
);

/** Solo borradores. */
export const DELETE = handle(async (_request: Request, { params }: RouteContext<"/api/documents/[id]">) => {
  await deleteDocument((await params).id);
  return new Response(null, { status: 204 });
});

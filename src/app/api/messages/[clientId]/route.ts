import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { deleteNote, getThread, markRead, sendMessage } from "@/server/messages";

export const GET = handle(async (_request: Request, { params }: RouteContext<"/api/messages/[clientId]">) => {
  await connection();
  return Response.json(await getThread((await params).clientId));
});

/** Responder: { body, projectId? } (se publica en su portal) o nota interna: { body, internal: true }. */
export const POST = handle(async (request: Request, { params }: RouteContext<"/api/messages/[clientId]">) =>
  Response.json(await sendMessage((await params).clientId, await readJson(request)), { status: 201 }),
);

/** { read: true } marca como leídos sus mensajes. */
export const PATCH = handle(async (_request: Request, { params }: RouteContext<"/api/messages/[clientId]">) => Response.json(await markRead((await params).clientId)));

/** ?id= borra una nota interna. */
export const DELETE = handle(async (request: Request, { params }: RouteContext<"/api/messages/[clientId]">) => {
  await deleteNote((await params).clientId, new URL(request.url).searchParams.get("id") ?? "");
  return new Response(null, { status: 204 });
});

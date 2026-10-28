import { connection } from "next/server";
import { handle } from "@/server/http";
import { listEvents } from "@/server/documents";

/** Registro de eventos de documentos (más recientes primero). ?docId= para uno. */
export const GET = handle(async (request: Request) => {
  await connection();
  return Response.json(await listEvents({ docId: new URL(request.url).searchParams.get("docId") ?? undefined }));
});

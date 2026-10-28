import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { createDocument, listDocuments, syncAcceptances } from "@/server/documents";
import type { DocType } from "@/core/documents";

/** Documentos (sin el texto). ?clientId= y ?type=proposal|contract|invoice. Trae antes las aceptaciones del portal. */
export const GET = handle(async (request: Request) => {
  await connection();
  const params = new URL(request.url).searchParams;
  await syncAcceptances().catch((err: Error) => console.error(`[documentos] ${err.message}`));
  return Response.json(await listDocuments({ clientId: params.get("clientId") ?? undefined, type: (params.get("type") as DocType) ?? undefined }));
});

/** Crea un borrador: { type, clientId, projectId?, templateId?, title? } o { fromId, type } para convertir. */
export const POST = handle(async (request: Request) => Response.json(await createDocument(await readJson(request)), { status: 201 }));

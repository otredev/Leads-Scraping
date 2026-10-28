import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { listTemplates, saveTemplate } from "@/server/documents";

export const GET = handle(async () => {
  await connection();
  return Response.json(await listTemplates());
});

/** { type, name, title?, body, lines?, days?, notes? } */
export const POST = handle(async (request: Request) => Response.json(await saveTemplate(await readJson(request)), { status: 201 }));

import type { NextRequest } from "next/server";
import { handle, readJson } from "@/server/http";
import { createTask, listTasks } from "@/server/tasks";

/** Tareas (todas, o ?leadId= / ?clientId= / ?projectId=). */
export const GET = handle(async (request: NextRequest) => {
  const p = request.nextUrl.searchParams;
  return Response.json(
    await listTasks({ leadId: p.get("leadId") || undefined, clientId: p.get("clientId") || undefined, projectId: p.get("projectId") || undefined }),
  );
});

/** Crea una tarea: { leadId | clientId [, projectId], title, dueAt?, visibleToClient? } */
export const POST = handle(async (request: Request) => {
  return Response.json(await createTask(await readJson(request)), { status: 201 });
});

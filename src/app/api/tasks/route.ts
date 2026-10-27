import type { NextRequest } from "next/server";
import { handle, readJson } from "@/server/http";
import { createTask, listTasks } from "@/server/tasks";

/** Tareas (todas o ?leadId=). */
export const GET = handle(async (request: NextRequest) => {
  return Response.json(await listTasks(request.nextUrl.searchParams.get("leadId") || undefined));
});

/** Crea una tarea: { leadId, title, dueAt } */
export const POST = handle(async (request: Request) => {
  return Response.json(await createTask(await readJson(request)), { status: 201 });
});

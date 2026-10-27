import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { handle, readJson } from "@/server/http";
import { createProject } from "@/server/clients";

/** Crea un proyecto: { clientId, name, description?, status?, startDate?, dueDate?, currency?, budget?, hourlyRate? } */
export const POST = handle(async (request: Request) => {
  return Response.json(await createProject(await readJson(request)), { status: 201 });
});

/** Todos los proyectos con el nombre de su cliente (para el calendario). */
export const GET = handle(async () => {
  await connection();
  const store = getStore();
  const [projects, clients] = await Promise.all([store.listProjects(), store.listClients()]);
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return Response.json(projects.map((p) => ({ ...p, clientName: names.get(p.clientId) ?? "" })));
});

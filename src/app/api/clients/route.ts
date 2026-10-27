import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { clientsOverview, createClient } from "@/server/clients";

/** Clientes con el resumen de sus proyectos y métricas generales. */
export const GET = handle(async () => {
  await connection();
  return Response.json(await clientsOverview());
});

/** Crea un cliente: { name, contactName?, email?, phone?, website?, address?, notes? } o { fromLeadId }. */
export const POST = handle(async (request: Request) => {
  const { client, existed } = await createClient(await readJson(request));
  return Response.json({ ...client, existed }, { status: existed ? 200 : 201 });
});

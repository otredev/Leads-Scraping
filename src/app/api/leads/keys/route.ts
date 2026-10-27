import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { handle } from "@/server/http";

/** Claves de los leads ya guardados (para marcar resultados como "guardado"). */
export const GET = handle(async () => {
  await connection();
  return Response.json(await getStore().savedKeys());
});

import { connection } from "next/server";
import { handle } from "@/server/http";
import { verifyChain } from "@/server/documents";

/** Comprueba la cadena de huellas de las facturas emitidas. */
export const GET = handle(async () => {
  await connection();
  return Response.json(await verifyChain());
});

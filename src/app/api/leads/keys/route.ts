import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { handle } from "@/server/http";

/** Claves de los leads guardados y de los marcados "no contactar" (para marcar resultados). */
export const GET = handle(async () => {
  await connection();
  const leads = await getStore().listSavedLeads();
  return Response.json({
    saved: leads.map((l) => l.key),
    dnc: leads.filter((l) => l.doNotContact).map((l) => l.key),
  });
});

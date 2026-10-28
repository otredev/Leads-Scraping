import { connection } from "next/server";
import { handle } from "@/server/http";
import { listConversations, syncInbox } from "@/server/messages";

/** Conversaciones (clientes con mensajes o con portal) y total sin leer. Antes recoge lo nuevo del portal. */
export const GET = handle(async () => {
  await connection();
  const sync = await syncInbox().then(
    () => undefined,
    (err: Error) => err.message,
  );
  return Response.json({ ...(await listConversations()), ...(sync ? { syncError: sync } : {}) });
});

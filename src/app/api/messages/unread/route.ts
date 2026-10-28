import { connection } from "next/server";
import { handle } from "@/server/http";
import { syncInbox, unreadCount } from "@/server/messages";

/** Mensajes sin leer (para el menú). */
export const GET = handle(async () => {
  await connection();
  await syncInbox().catch(() => undefined);
  return Response.json({ unread: await unreadCount() });
});

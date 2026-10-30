import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { changeDismissal, todayInbox } from "@/server/today";

/** Bandeja "Hoy" del Panel: mensajes sin responder, facturas vencidas y propuestas sin respuesta. */
export const GET = handle(async () => {
  await connection();
  return Response.json(await todayInbox());
});

/** Quitar un elemento ({ action: "dismiss", key, until: "tomorrow" | "always" | "deleted" }) o volver a mostrarlo ({ action: "restore", key }). */
export const POST = handle(async (request: Request) => Response.json(await changeDismissal(await readJson(request))));

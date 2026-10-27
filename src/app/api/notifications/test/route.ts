import { handle, readJson } from "@/server/http";
import { getNotifier, notifyAll } from "@/server/notifications";

/** Envía un aviso de prueba: { channel? } (sin canal, por todos). */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ channel?: string }>(request).catch(() => ({}) as { channel?: string });
  const message = { title: "Prueba de Leads Scraping", body: "Las notificaciones funcionan en este dispositivo.", url: "/tareas", tag: "test" };
  if (body.channel) {
    const found = getNotifier(body.channel);
    if (!found) return Response.json({ error: "Canal de notificación desconocido" }, { status: 400 });
    return Response.json(await found.notifier.send(message));
  }
  return Response.json({ sent: await notifyAll(message) });
});

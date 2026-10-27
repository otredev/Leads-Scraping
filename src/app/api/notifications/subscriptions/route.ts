import { handle, readJson } from "@/server/http";
import { getNotifier } from "@/server/notifications";

function channel(id: unknown) {
  const found = typeof id === "string" ? getNotifier(id) : undefined;
  if (!found) throw Object.assign(new Error("Canal de notificación desconocido"), { status: 400 });
  return found.notifier;
}

/** Alta de un destinatario: { channel, data, label } */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ channel?: string; data?: unknown; label?: string }>(request);
  return Response.json(await channel(body.channel).subscribe(body.data, body.label ?? ""), { status: 201 });
});

/** Baja: { channel, id } */
export const DELETE = handle(async (request: Request) => {
  const body = await readJson<{ channel?: string; id?: string }>(request);
  if (!body.id) return Response.json({ error: "Falta el id" }, { status: 400 });
  await channel(body.channel).unsubscribe(body.id);
  return new Response(null, { status: 204 });
});

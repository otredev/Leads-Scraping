import { handleAuth } from "@/server/http";
import { closeSessions, listSessions } from "@/server/auth/service";

/** Dispositivos con la sesión abierta. */
export const GET = handleAuth(async (auth) => Response.json({ sessions: await listSessions(auth) }));

/** ?id=<sesión> cierra una; ?otras=1 cierra todas menos esta. */
export const DELETE = handleAuth(async (auth, request: Request) => {
  const q = new URL(request.url).searchParams;
  return Response.json(await closeSessions(auth, { id: q.get("id") ?? undefined, others: q.get("otras") === "1" }));
});

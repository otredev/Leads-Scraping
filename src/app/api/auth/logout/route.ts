import { handlePublic } from "@/server/http";
import { authenticate, clearSessionCookie } from "@/server/auth/session";
import { logout } from "@/server/auth/service";

/** Cerrar sesión en este dispositivo. */
export const POST = handlePublic(async (request: Request) => {
  const auth = await authenticate(request);
  if (auth) await logout(auth);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
});

import { handleAuth } from "@/server/http";
import { createMcpToken, revokeMcpToken } from "@/server/auth/service";

/** Crea (o renueva) el token para conectar Claude a tu cuenta. Se muestra una sola vez. */
export const POST = handleAuth(async (auth) => Response.json(await createMcpToken(auth)));

/** Desconecta Claude (el token deja de valer). */
export const DELETE = handleAuth(async (auth) => {
  await revokeMcpToken(auth);
  return new Response(null, { status: 204 });
});

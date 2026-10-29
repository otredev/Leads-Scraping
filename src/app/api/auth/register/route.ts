import { handlePublic, readJson } from "@/server/http";
import { register } from "@/server/auth/service";

/** Crear cuenta: { name, email, password, accept: true }. Devuelve el código de recuperación (solo esta vez). */
export const POST = handlePublic(async (request: Request) => {
  const { user, recoveryCode, cookie } = await register(request, await readJson(request));
  return Response.json({ user, recoveryCode }, { status: 201, headers: { "Set-Cookie": cookie } });
});

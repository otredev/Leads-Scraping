import { handlePublic, readJson } from "@/server/http";
import { login } from "@/server/auth/service";

/** Iniciar sesión: { email, password }. */
export const POST = handlePublic(async (request: Request) => {
  const { user, cookie } = await login(request, await readJson(request));
  return Response.json({ user }, { headers: { "Set-Cookie": cookie } });
});

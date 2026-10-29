import { handlePublic, readJson } from "@/server/http";
import { resetWithToken } from "@/server/auth/service";

/** Con el enlace del email: { token, newPassword }. */
export const POST = handlePublic(async (request: Request) => {
  const { cookie } = await resetWithToken(request, await readJson(request));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
});

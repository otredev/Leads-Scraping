import { handlePublic, readJson } from "@/server/http";
import { recoverWithCode } from "@/server/auth/service";

/** Con el código de recuperación: { email, code, newPassword }. Devuelve un código nuevo. */
export const POST = handlePublic(async (request: Request) => {
  const { recoveryCode, cookie } = await recoverWithCode(request, await readJson(request));
  return Response.json({ recoveryCode }, { headers: { "Set-Cookie": cookie } });
});

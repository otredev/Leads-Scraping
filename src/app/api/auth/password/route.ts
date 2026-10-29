import { handleAuth, readJson } from "@/server/http";
import { changePassword } from "@/server/auth/service";

/** Cambiar la contraseña: { currentPassword, newPassword }. Cierra las demás sesiones. */
export const POST = handleAuth(async (auth, request: Request) => Response.json(await changePassword(auth, await readJson(request))));

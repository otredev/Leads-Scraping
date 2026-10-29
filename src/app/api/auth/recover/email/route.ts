import { handlePublic, readJson } from "@/server/http";
import { requestEmailReset } from "@/server/auth/service";

/** Enviar un enlace para cambiar la contraseña: { email } (requiere RESEND_API_KEY y EMAIL_FROM). */
export const POST = handlePublic(async (request: Request) => Response.json(await requestEmailReset(request, await readJson(request))));

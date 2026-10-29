import { handleAuth, readJson } from "@/server/http";
import { newRecoveryCode } from "@/server/auth/service";

/** Nuevo código de recuperación: { currentPassword }. El anterior deja de valer. */
export const POST = handleAuth(async (auth, request: Request) => Response.json(await newRecoveryCode(auth, await readJson(request))));

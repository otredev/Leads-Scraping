import { handleAuth, readJson } from "@/server/http";
import { clearSessionCookie } from "@/server/auth/session";
import { deleteAccount, emailConfigured, publicUser, updateProfile } from "@/server/auth/service";

/** Tu cuenta. */
export const GET = handleAuth(async (auth) => Response.json({ user: publicUser(auth.user), emailRecovery: emailConfigured() }));

/** Cambiar nombre o email: { name?, email?, currentPassword? } (el email pide la contraseña). */
export const PATCH = handleAuth(async (auth, request: Request) => Response.json({ user: await updateProfile(auth, await readJson(request)) }));

/** Eliminar la cuenta y todos sus datos: { currentPassword, confirm: "<tu email>" }. */
export const DELETE = handleAuth(async (auth, request: Request) => {
  await deleteAccount(auth, await readJson(request));
  return Response.json({ deleted: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
});

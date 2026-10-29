import { connection } from "next/server";
import { handlePublic } from "@/server/http";
import { emailConfigured, registrationOpen } from "@/server/auth/service";
import { readAccounts } from "@/server/auth/accounts";

/** Para las pantallas de acceso: si se puede crear cuenta, si hay recuperación por email y si es la primera. */
export const GET = handlePublic(async () => {
  await connection();
  return Response.json({ registration: await registrationOpen(), emailRecovery: emailConfigured(), firstAccount: (await readAccounts()).users.length === 0 });
});

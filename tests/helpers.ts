import { register } from "@/server/auth/service";
import { tenantOf } from "@/server/auth/session";
import { runAsTenant } from "@/server/tenant";

let ip = 0;

/** Petición como la del navegador (con IP distinta para no chocar con el límite de intentos). */
export function request(pathname: string, init: RequestInit & { cookie?: string; ip?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("host", "localhost");
  headers.set("x-forwarded-for", init.ip ?? `10.0.0.${++ip % 250}`);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`http://localhost${pathname}`, { ...init, headers });
}

/** "ls_session=…; Path=/; …" → "ls_session=…" */
export const cookieOf = (setCookie: string) => setCookie.split(";")[0];

/** Crea una cuenta y devuelve una función para ejecutar código con sus datos. */
export async function account(name: string, email = `${name.toLowerCase().replace(/\W+/g, "")}@example.com`, password = "una frase bastante larga 2026") {
  const res = await register(request("/api/auth/register"), { name, email, password, accept: true });
  // El usuario completo (con su dataKey) se lee de las cuentas guardadas.
  const { readAccounts } = await import("@/server/auth/accounts");
  const user = (await readAccounts()).users.find((u) => u.id === res.user.id)!;
  return {
    user,
    email,
    password,
    recoveryCode: res.recoveryCode,
    cookie: cookieOf(res.cookie),
    run: <T>(fn: () => T) => runAsTenant(tenantOf(user), fn),
  };
}

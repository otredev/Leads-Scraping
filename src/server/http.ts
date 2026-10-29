import "server-only";
import { unstable_rethrow } from "next/navigation";
import { authenticate, tenantOf, type Auth } from "./auth/session";
import { runAsTenant } from "./tenant";

function errorResponse(err: unknown) {
  unstable_rethrow(err); // errores internos de Next (p. ej. salir del prerenderizado)
  if (!(err as { status?: number }).status) console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  return Response.json({ error: (err as Error).message || "Error inesperado" }, { status });
}

/**
 * Cambios solo desde la propia app: si el navegador manda Origin, debe ser el
 * mismo sitio (protección CSRF además de la cookie SameSite=Lax).
 */
function crossSite(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return request.headers.get("sec-fetch-site") === "cross-site";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/**
 * Envuelve un handler de la API: exige sesión iniciada, lo ejecuta con los
 * datos de esa cuenta y devuelve los errores como JSON legible.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const request = args[0] as Request;
      if (crossSite(request)) return Response.json({ error: "Petición de otro sitio no permitida" }, { status: 403 });
      const auth = await authenticate(request);
      if (!auth) return Response.json({ error: "Inicia sesión para continuar" }, { status: 401 });
      return await runAsTenant(tenantOf(auth.user), () => fn(...args));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Como handle(), con la sesión a mano (para el perfil). */
export function handleAuth<A extends unknown[]>(fn: (auth: Auth, ...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const request = args[0] as Request;
      if (crossSite(request)) return Response.json({ error: "Petición de otro sitio no permitida" }, { status: 403 });
      const auth = await authenticate(request);
      if (!auth) return Response.json({ error: "Inicia sesión para continuar" }, { status: 401 });
      return await runAsTenant(tenantOf(auth.user), () => fn(auth, ...args));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Rutas sin sesión (registro, inicio de sesión, recuperación). */
export function handlePublic<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (crossSite(args[0] as Request)) return Response.json({ error: "Petición de otro sitio no permitida" }, { status: 403 });
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw Object.assign(new Error("Cuerpo JSON inválido"), { status: 400 });
  }
}

export function idsFrom(body: unknown): string[] {
  const ids = (body as { ids?: unknown })?.ids;
  return Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
}

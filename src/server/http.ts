import "server-only";
import { unstable_rethrow } from "next/navigation";

/** Envuelve un handler para devolver los errores como JSON legible. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err); // errores internos de Next (p. ej. salir del prerenderizado)
      if (!(err as { status?: number }).status) console.error(err);
      const status = (err as { status?: number }).status ?? 500;
      return Response.json({ error: (err as Error).message || "Error inesperado" }, { status });
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

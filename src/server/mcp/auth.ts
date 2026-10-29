import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { User } from "../auth/accounts";
import { founderUser, userByMcpToken } from "../auth/service";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostname(value: string | null) {
  if (!value) return "";
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname;
  } catch {
    return "";
  }
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Acceso al MCP. Cada cuenta conecta Claude con su propio token (Perfil →
 * Conectar Claude): "Authorization: Bearer lsm_…" o ?token= para clientes que
 * no envían cabeceras. Además, como antes, para la primera cuenta:
 * - MCP_TOKEN (si está definido), o
 * - sin token, solo desde este equipo (localhost). Así, si despliegas la app
 *   sin token, el CRM no queda abierto a internet.
 * Devuelve la cuenta con la que se ejecuta, o la respuesta de error.
 */
export async function mcpAuth(request: Request): Promise<{ user: User } | { error: Response }> {
  const auth = request.headers.get("authorization") ?? "";
  const given = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (new URL(request.url).searchParams.get("token") ?? "");
  const denied = (message: string, status = 401) => ({
    error: Response.json({ error: message }, { status, headers: status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined }),
  });

  if (given) {
    const user = await userByMcpToken(given);
    if (user) return { user };
    const envToken = process.env.MCP_TOKEN?.trim();
    if (envToken && sameToken(given, envToken)) {
      const founder = await founderUser();
      return founder ? { user: founder } : denied("Crea primero tu cuenta en la app", 403);
    }
    return denied("Token MCP no válido");
  }
  if (process.env.MCP_TOKEN?.trim()) return denied("Falta el token MCP");
  // Protección frente a DNS rebinding: el Host (y el Origin, si lo hay) deben ser locales.
  const host = hostname(request.headers.get("host"));
  const origin = request.headers.get("origin");
  if (LOCAL_HOSTS.has(host) && (!origin || LOCAL_HOSTS.has(hostname(origin)))) {
    const founder = await founderUser();
    return founder ? { user: founder } : denied("Crea primero tu cuenta en la app", 403);
  }
  return denied("El MCP solo acepta conexiones locales sin token. Crea tu token en Perfil → Conectar Claude.", 403);
}

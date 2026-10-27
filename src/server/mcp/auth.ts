import "server-only";
import { timingSafeEqual } from "node:crypto";

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
 * Acceso al MCP.
 * - Con MCP_TOKEN: exige "Authorization: Bearer <token>" (o ?token= para clientes que no envían cabeceras).
 * - Sin MCP_TOKEN: solo desde este equipo (localhost). Así, si despliegas la
 *   app sin configurar el token, el CRM no queda abierto a internet.
 * Devuelve la respuesta de error o undefined si se permite.
 */
export function mcpAuthError(request: Request): Response | undefined {
  const token = process.env.MCP_TOKEN?.trim();
  if (token) {
    const auth = request.headers.get("authorization") ?? "";
    const given = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (new URL(request.url).searchParams.get("token") ?? "");
    if (given && sameToken(given, token)) return undefined;
    return Response.json({ error: "Token MCP no válido" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  // Protección frente a DNS rebinding: el Host (y el Origin, si lo hay) deben ser locales.
  const host = hostname(request.headers.get("host"));
  const origin = request.headers.get("origin");
  if (LOCAL_HOSTS.has(host) && (!origin || LOCAL_HOSTS.has(hostname(origin)))) return undefined;
  return Response.json(
    { error: "El MCP solo acepta conexiones locales. Define MCP_TOKEN para usarlo desde otra máquina." },
    { status: 403 },
  );
}

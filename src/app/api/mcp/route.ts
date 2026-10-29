import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/server/mcp/server";
import { mcpAuth } from "@/server/mcp/auth";
import { tenantOf } from "@/server/auth/session";
import { runAsTenant } from "@/server/tenant";

/**
 * Endpoint MCP (Streamable HTTP, sin sesiones): http://localhost:3000/api/mcp
 * Cada petición crea su propio servidor; el estado vive en el almacenamiento de la cuenta del token.
 */
async function handler(request: Request) {
  const auth = await mcpAuth(request);
  if ("error" in auth) return auth.error;
  // Claude trabaja con los datos de la cuenta del token.
  return runAsTenant(tenantOf(auth.user), () => serve(request));
}

async function serve(request: Request) {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Con respuestas JSON la petición ya está resuelta: se libera el servidor.
    void server.close();
  }
}

export { handler as GET, handler as POST, handler as DELETE };

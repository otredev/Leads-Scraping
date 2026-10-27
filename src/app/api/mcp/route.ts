import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/server/mcp/server";
import { mcpAuthError } from "@/server/mcp/auth";

/**
 * Endpoint MCP (Streamable HTTP, sin sesiones): http://localhost:3000/api/mcp
 * Cada petición crea su propio servidor; el estado vive en el almacenamiento.
 */
async function handler(request: Request) {
  const denied = mcpAuthError(request);
  if (denied) return denied;
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

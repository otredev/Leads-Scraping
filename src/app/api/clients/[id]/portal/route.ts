import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { getStore } from "@/server/registry";
import { disablePortal, enablePortal, portalConfig, portalLink, publishClient, remotePortalStatus } from "@/server/portal";
import type { Client } from "@/core/clients";

function view(client: Client) {
  const { configured } = portalConfig();
  return {
    configured,
    enabled: Boolean(client.portal),
    url: client.portal && configured ? portalLink(client.portal.token) : undefined,
    publishedAt: client.portal?.publishedAt,
    lastError: client.portal?.lastError,
  };
}

/** Estado del portal de un cliente (y, si responde, cuándo lo vio por última vez). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/clients/[id]/portal">) => {
  await connection();
  const client = await getStore().getClient((await ctx.params).id);
  if (!client) return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
  const base = view(client);
  if (!base.enabled || !base.configured) return Response.json(base);
  try {
    return Response.json({ ...base, remote: (await remotePortalStatus(client.id)) ?? null });
  } catch (err) {
    return Response.json({ ...base, remoteError: (err as Error).message });
  }
});

/** { action: "enable" | "publish" | "regenerate" } */
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/clients/[id]/portal">) => {
  const { id } = await ctx.params;
  const { action } = await readJson<{ action?: string }>(request);
  const client =
    action === "enable"
      ? await enablePortal(id)
      : action === "regenerate"
        ? await enablePortal(id, true)
        : action === "publish"
          ? await publishClient(id)
          : undefined;
  if (!client) return Response.json({ error: "Acción no válida" }, { status: 400 });
  return Response.json(view(client));
});

/** Desactiva el portal: el enlace deja de funcionar. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/clients/[id]/portal">) => {
  return Response.json(view(await disablePortal((await ctx.params).id)));
});

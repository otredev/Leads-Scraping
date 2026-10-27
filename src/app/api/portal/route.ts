import { connection } from "next/server";
import { handle } from "@/server/http";
import { portalConfig, portalHealth } from "@/server/portal";

/** Conexión con el portal del cliente (para Ajustes). */
export const GET = handle(async () => {
  await connection();
  const { url, configured } = portalConfig();
  return Response.json({ configured, url, health: await portalHealth() });
});

import { connection } from "next/server";
import { exporters, getStorageModule, providers, sources } from "@/server/registry";

/** Describe los módulos registrados para que la UI se construya sola. */
export async function GET() {
  await connection();
  const providerInfo = await Promise.all(
    providers.map(async (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sourceId: p.sourceId,
      options: p.options,
      health: await p.health().catch((e: Error) => ({ ok: false, message: e.message })),
    })),
  );
  return Response.json({
    sources,
    providers: providerInfo,
    exporters: exporters.map(({ id, label, extension, options }) => ({ id, label, extension, options })),
    storage: { id: getStorageModule().id },
  });
}

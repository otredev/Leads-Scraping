import { connection } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { exporters, getStorageModule, getStore, providers, sources } from "@/server/registry";
import { defaultCountry } from "@/server/config";
import { trashDays } from "@/server/crm";

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
      acceptsMapsUrls: Boolean(p.acceptsMapsUrls),
      health: await p.health().catch((e: Error) => ({ ok: false, message: e.message })),
    })),
  );
  return Response.json({
    sources,
    providers: providerInfo,
    exporters: exporters.map(({ id, label, extension, options }) => ({ id, label, extension, options })),
    storage: {
      id: getStorageModule().id,
      label: getStorageModule().label,
      health: await getStore().health(),
      // Hay datos locales de la versión anterior que se pueden importar.
      localDataAvailable:
        getStorageModule().id !== "json-file" &&
        existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "searches.json")),
    },
    defaults: { country: defaultCountry(), lang: "es", trashDays: trashDays() },
    mcp: { path: "/api/mcp", token: Boolean(process.env.MCP_TOKEN?.trim()) },
  });
}

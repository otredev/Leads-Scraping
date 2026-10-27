import type { NextRequest } from "next/server";
import { isBackup } from "@/core/storage";
import { createStorage, getStorageModule, getStore } from "@/server/registry";
import { handle, readJson } from "@/server/http";

/** Descarga una copia completa: búsquedas, resultados y leads guardados (incluida la papelera). */
export const GET = handle(async () => {
  const backup = await getStore().exportAll();
  const date = backup.exportedAt.slice(0, 16).replace(/[T:]/g, "-");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-scraping-copia-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

/**
 * Restaura una copia (solo añade lo que falte, no sobrescribe).
 *   POST /api/backup               cuerpo: el JSON de la copia
 *   POST /api/backup?from=json-file   importa los datos locales de ./data
 */
export const POST = handle(async (request: NextRequest) => {
  const from = request.nextUrl.searchParams.get("from");
  let backup: unknown;
  if (from) {
    if (from === getStorageModule().id) {
      return Response.json({ error: "Ese ya es el almacenamiento activo" }, { status: 400 });
    }
    const source = createStorage(from);
    if (!source) return Response.json({ error: `Almacenamiento desconocido: ${from}` }, { status: 400 });
    backup = await source.exportAll();
  } else {
    backup = await readJson(request);
  }
  if (!isBackup(backup)) {
    return Response.json({ error: "El archivo no es una copia de seguridad de Leads Scraping" }, { status: 400 });
  }
  return Response.json(await getStore().importAll(backup));
});

import type { NextRequest } from "next/server";
import { buildFields } from "@/core/fields";
import { resolveOptions } from "@/core/options";
import { fromSearchParams, queryLeads } from "@/core/query";
import { getExporter, getStore } from "@/server/registry";
import { handle } from "@/server/http";

/**
 * GET /api/export?format=csv&scope=results|saved&searchId=…&fields=name,phone&<filtros>&<opciones>
 *   scope=results (por defecto): resultados de búsqueda; scope=saved: leads guardados.
 * Aplica exactamente los mismos filtros y orden que la tabla.
 */
export const GET = handle(async (request: NextRequest) => {
  const p = request.nextUrl.searchParams;
  const exporter = getExporter(p.get("format") || "csv");
  if (!exporter) return Response.json({ error: "Formato desconocido" }, { status: 400 });

  const store = getStore();
  const searchId = p.get("searchId") || undefined;
  const { filters, sort } = fromSearchParams(p);
  const scope = p.get("scope") === "saved" ? "saved" : "results";
  const settings = await store.getSettings();
  const allFields = buildFields(scope, settings);
  const source = scope === "saved" ? await store.listSavedLeads() : await store.listLeads(searchId);
  const leads = queryLeads(source, filters, sort, { lowRating: settings.lowRating, fields: allFields });

  const wanted = p.get("fields")?.split(",").filter(Boolean);
  // Respeta el orden de columnas pedido (el de la tabla).
  const fields = wanted?.length
    ? (wanted.map((k) => allFields.find((f) => f.key === k)).filter(Boolean) as typeof allFields)
    : allFields;

  const options = resolveOptions(exporter.options, Object.fromEntries(p.entries()));
  const body = exporter.export(leads, fields, options);

  const search = searchId ? await store.getSearch(searchId) : undefined;
  const base = (search?.name || (scope === "saved" ? "guardados" : "todos-los-resultados"))
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `leads-${base || "export"}-${date}.${exporter.extension}`;

  return new Response(typeof body === "string" ? body : new Blob([body as BlobPart]), {
    headers: {
      "Content-Type": exporter.mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});

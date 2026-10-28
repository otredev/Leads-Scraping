import { connection } from "next/server";
import { handle } from "@/server/http";
import { getFinanceReport, parsePeriod } from "@/server/finance";

/**
 * Informe de rentabilidad: ?from=AAAA-MM-DD&to=AAAA-MM-DD (o ?period=all).
 * ?clientId= devuelve solo ese cliente (el reparto se calcula con todos).
 */
export const GET = handle(async (request: Request) => {
  await connection();
  const params = new URL(request.url).searchParams;
  return Response.json(await getFinanceReport(await parsePeriod(params), { clientId: params.get("clientId") ?? undefined }));
});

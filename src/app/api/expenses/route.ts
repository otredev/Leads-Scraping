import { connection } from "next/server";
import { handle, readJson } from "@/server/http";
import { createExpense, listExpenses } from "@/server/finance";

/** Gastos (más recientes primero). ?clientId= para los de un cliente. */
export const GET = handle(async (request: Request) => {
  await connection();
  const clientId = new URL(request.url).searchParams.get("clientId") ?? undefined;
  return Response.json(await listExpenses({ clientId }));
});

/**
 * Crea un gasto: { concept, amount, date?, type: "direct"|"overhead"|"acquisition", category?,
 * clientId?, projectId? (direct), channel? (acquisition), recurrence?: "monthly"|"yearly", endDate?, vendor?, notes? }
 */
export const POST = handle(async (request: Request) => Response.json(await createExpense(await readJson(request)), { status: 201 }));

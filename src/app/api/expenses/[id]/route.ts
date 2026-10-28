import { handle, readJson } from "@/server/http";
import { deleteExpense, updateExpense } from "@/server/finance";

/** Cambia un gasto (mismos campos que al crearlo). */
export const PATCH = handle(async (request: Request, { params }: RouteContext<"/api/expenses/[id]">) => {
  const { id } = await params;
  return Response.json(await updateExpense(id, await readJson(request)));
});

export const DELETE = handle(async (_request: Request, { params }: RouteContext<"/api/expenses/[id]">) => {
  await deleteExpense((await params).id);
  return new Response(null, { status: 204 });
});

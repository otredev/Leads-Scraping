import { handle } from "@/server/http";
import { createRectification } from "@/server/documents";

/** Crea (o devuelve) el borrador de la rectificativa de una factura emitida. */
export const POST = handle(async (_request: Request, { params }: RouteContext<"/api/documents/[id]/rectify">) =>
  Response.json(await createRectification((await params).id), { status: 201 }),
);

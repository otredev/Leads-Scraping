import { describe, expect, it } from "vitest";
import { INBOX_KEY, dismissState, dueInvoices, inboxKey, isDismissed, pendingProposals, pruneDismissals, unansweredMessages } from "@/core/today";
import { changeDismissal, todayInbox } from "@/server/today";
import { account } from "./helpers";
import type { Document } from "@/core/documents";
import type { Message } from "@/core/messages";

const names = new Map([
  ["c1", "Clínica Sonrisa"],
  ["c2", "Bar Pepe"],
  ["c3", "Óptica Norte"],
]);

const msg = (clientId: string, author: Message["author"], createdAt: string, extra: Partial<Message> = {}): Message => ({
  id: `${clientId}-${createdAt}`,
  clientId,
  author,
  body: `${author} ${createdAt}`,
  createdAt,
  ...extra,
});

const doc = (over: Partial<Document>): Document =>
  ({
    id: crypto.randomUUID(),
    type: "invoice",
    clientId: "c1",
    title: "Doc",
    status: "issued",
    date: "2026-10-01",
    currency: "EUR",
    body: "",
    lines: [{ description: "x", quantity: 1, unitPrice: 100, vat: 21 }],
    visibleToClient: true,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...over,
  }) as Document;

describe("bandeja Hoy: mensajes sin responder", () => {
  it("solo las conversaciones cuyo último mensaje es del cliente; las notas internas no cuentan", () => {
    const list = unansweredMessages(
      [
        msg("c1", "client", "2026-10-28T09:00:00Z", { readAt: "2026-10-28T10:00:00Z" }),
        msg("c1", "admin", "2026-10-28T11:00:00Z"),
        msg("c1", "client", "2026-10-29T08:00:00Z"),
        msg("c1", "client", "2026-10-29T08:05:00Z"),
        msg("c2", "client", "2026-10-27T08:00:00Z"),
        msg("c2", "admin", "2026-10-27T09:00:00Z"),
        msg("c3", "client", "2026-10-26T08:00:00Z", { readAt: "2026-10-26T09:00:00Z" }),
        msg("c3", "note", "2026-10-26T10:00:00Z"),
      ],
      names,
    );
    // c2 está respondido; c3 sigue esperando aunque tenga una nota interna después.
    expect(list.map((m) => m.clientName)).toEqual(["Óptica Norte", "Clínica Sonrisa"]);
    const c1 = list.find((m) => m.clientId === "c1")!;
    expect(c1).toMatchObject({ count: 2, since: "2026-10-29T08:00:00Z", unread: true, preview: "client 2026-10-29T08:05:00Z" });
    expect(list.find((m) => m.clientId === "c3")!.unread).toBe(false);
  });

  it("ignora los clientes que ya no existen", () => {
    expect(unansweredMessages([msg("borrado", "client", "2026-10-29T08:00:00Z")], names)).toEqual([]);
  });
});

describe("bandeja Hoy: facturas vencidas", () => {
  const today = "2026-10-29";

  it("emitidas sin cobrar que vencen hoy o antes, con los días de retraso", () => {
    const list = dueInvoices(
      [
        doc({ number: "F2026-0001", dueDate: "2026-10-19" }),
        doc({ number: "F2026-0002", dueDate: "2026-10-29" }),
        doc({ number: "F2026-0003", dueDate: "2026-11-05" }), // aún no vence
        doc({ number: "F2026-0004", dueDate: "2026-10-01", status: "paid" }), // cobrada
        doc({ number: "R2026-0001", dueDate: "2026-10-01", kind: "R4" }), // rectificativa
        doc({ dueDate: "2026-10-01", status: "draft" }), // borrador
      ],
      names,
      today,
    );
    expect(list.map((i) => [i.number, i.daysLate])).toEqual([
      ["F2026-0001", 10],
      ["F2026-0002", 0],
    ]);
    expect(list[0]).toMatchObject({ clientName: "Clínica Sonrisa", total: 121 });
  });
});

describe("bandeja Hoy: propuestas sin respuesta", () => {
  const today = "2026-10-29";

  it("propuestas y contratos enviados pendientes, de los más antiguos a los más recientes", () => {
    const list = pendingProposals(
      [
        doc({ type: "proposal", status: "sent", sentAt: "2026-10-27T10:00:00Z", dueDate: "2026-11-10", clientId: "c2", title: "Web nueva" }),
        doc({ type: "contract", status: "sent", sentAt: "2026-10-20T10:00:00Z", dueDate: "2026-10-25", title: "Mantenimiento" }),
        doc({ type: "proposal", status: "accepted", sentAt: "2026-10-01T10:00:00Z" }),
        doc({ type: "proposal", status: "draft" }),
        doc({ type: "invoice", status: "issued", sentAt: "2026-10-01T10:00:00Z" }),
      ],
      names,
      today,
    );
    expect(list.map((p) => [p.title, p.type, p.daysWaiting, p.expired])).toEqual([
      ["Mantenimiento", "contract", 9, true],
      ["Web nueva", "proposal", 2, false],
    ]);
  });
});

describe("bandeja Hoy: quitar elementos", () => {
  it("oculto hasta mañana vuelve al día siguiente; quitado sigue oculto", () => {
    const d = { a: "2026-10-30", b: "always" };
    expect(isDismissed("a", d, "2026-10-29")).toBe(true);
    expect(isDismissed("a", d, "2026-10-30")).toBe(false);
    expect(isDismissed("b", d, "2030-01-01")).toBe(true);
    expect(isDismissed("c", d, "2026-10-29")).toBe(false);
    expect(pruneDismissals(d, "2026-10-30")).toEqual({ b: "always" });
  });

  it("la clave cambia si cambia algo (mensaje nuevo, otra fecha), así que vuelve a aparecer", () => {
    expect(inboxKey.message({ clientId: "c1", lastAt: "2026-10-29T08:00:00.000Z" })).not.toBe(inboxKey.message({ clientId: "c1", lastAt: "2026-10-29T09:00:00.000Z" }));
    expect(inboxKey.task({ id: "t1", dueAt: "2026-10-29T10:00:00.000Z" })).not.toBe(inboxKey.task({ id: "t1", dueAt: "2026-10-30T10:00:00.000Z" }));
    for (const k of [
      inboxKey.task({ id: crypto.randomUUID(), dueAt: new Date().toISOString() }),
      inboxKey.message({ clientId: crypto.randomUUID(), lastAt: new Date().toISOString() }),
      inboxKey.invoice({ id: crypto.randomUUID(), dueDate: "2026-10-29" }),
      inboxKey.proposal({ id: crypto.randomUUID(), sentAt: new Date().toISOString() }),
    ])
      expect(k).toMatch(INBOX_KEY);
  });

  it("se guarda en la cuenta: quitar, volver a mostrar y validar", async () => {
    const { run } = await account("Hoy");
    const key = inboxKey.invoice({ id: "abc", dueDate: "2026-10-01" });
    const { dismissed } = await run(() => changeDismissal({ action: "dismiss", key, until: "always" }));
    expect(dismissed[key]).toBe("always");
    expect((await run(() => todayInbox())).dismissed[key]).toBe("always");
    const later = await run(() => changeDismissal({ action: "dismiss", key, until: "tomorrow" }));
    expect(later.dismissed[key]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await run(() => changeDismissal({ action: "restore", key }))).dismissed[key]).toBeUndefined();
    await expect(run(() => changeDismissal({ action: "dismiss", key: "cualquier cosa", until: "always" }))).rejects.toMatchObject({ status: 400 });
    await expect(run(() => changeDismissal({ action: "dismiss", key, until: "siempre" }))).rejects.toMatchObject({ status: 400 });
  });

  it("cada cuenta tiene sus propios ocultos", async () => {
    const a = await account("HoyA");
    const b = await account("HoyB");
    const key = inboxKey.invoice({ id: "xyz", dueDate: "2026-10-01" });
    await a.run(() => changeDismissal({ action: "dismiss", key, until: "always" }));
    expect((await b.run(() => todayInbox())).dismissed[key]).toBeUndefined();
  });

  it("eliminar: oculto y fuera de la lista de ocultos, pero vuelve si cambia algo", () => {
    const before = inboxKey.message({ clientId: "c1", lastAt: "2026-10-29T08:00:00.000Z" });
    const after = inboxKey.message({ clientId: "c1", lastAt: "2026-10-30T08:00:00.000Z" }); // el cliente vuelve a escribir
    const d = { [before]: "deleted" };
    expect(dismissState(before, d, "2031-01-01")).toBe("deleted");
    expect(isDismissed(after, d, "2026-10-30")).toBe(false);
    expect(pruneDismissals({ ...d, viejo: "2020-01-01" }, "2026-10-29")).toEqual(d);
  });

  it("en el servidor: eliminar y volver a mostrar", async () => {
    const { run } = await account("HoyEliminar");
    const key = inboxKey.proposal({ id: "p1", sentAt: "2026-10-20T10:00:00.000Z" });
    const r = await run(() => changeDismissal({ action: "dismiss", key, until: "deleted" }));
    expect(r.dismissed).toEqual({ [key]: "deleted" });
    expect((await run(() => changeDismissal({ action: "restore", key }))).dismissed).toEqual({});
  });
});

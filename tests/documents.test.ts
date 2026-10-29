import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { docTotals, formatNumber, invoiceSeries, missingVariables, recordHashInput, renderVariables, taxQrUrl } from "@/core/documents";
import { createDocument, createRectification, deleteDocument, documentAction, updateDocument, verifyChain } from "@/server/documents";
import { createClient } from "@/server/clients";
import { savePortalBrand } from "@/server/crm";
import { getStore } from "@/server/registry";
import { account } from "./helpers";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").toUpperCase();

describe("VeriFactu (cálculos puros)", () => {
  it("la huella coincide con el ejemplo oficial de la AEAT", () => {
    const input = recordHashInput({
      issuerTaxId: "89890001K",
      number: "12345678/G33",
      date: "2024-01-01",
      kind: "F1",
      vatTotal: 12.35,
      gross: 123.45,
      prevHash: "",
      generatedAt: "2024-01-01T19:20:30+01:00",
    });
    expect(input).toBe(
      "IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00",
    );
    expect(sha256(input)).toBe("3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60");
  });

  it("el QR lleva NIF, número codificado, fecha e importe", () => {
    const url = new URL(taxQrUrl({ issuerTaxId: "89890001K", number: "12345678&G33", date: "2024-01-01", gross: 241.4 }));
    expect(url.searchParams.get("nif")).toBe("89890001K");
    expect(url.searchParams.get("numserie")).toBe("12345678&G33");
    expect(url.searchParams.get("fecha")).toBe("01-01-2024");
    expect(url.searchParams.get("importe")).toBe("241.40");
  });

  it("totales con varios tipos de IVA e IRPF", () => {
    const t = docTotals({
      lines: [
        { description: "a", quantity: 2, unitPrice: 100, vat: 21 },
        { description: "b", quantity: 1, unitPrice: 50, vat: 10 },
      ],
      irpf: 15,
    });
    expect(t).toEqual({ base: 250, vat: [{ rate: 21, base: 200, amount: 42 }, { rate: 10, base: 50, amount: 5 }], vatTotal: 47, irpf: 37.5, gross: 297, total: 259.5 });
  });

  it("redondea al céntimo", () => {
    const t = docTotals({ lines: [{ description: "x", quantity: 3, unitPrice: 0.335, vat: 21 }] });
    expect(t.base).toBe(1.01);
    expect(t.gross).toBe(Math.round(t.gross * 100) / 100);
  });

  it("series y numeración", () => {
    expect(invoiceSeries("F1", "2026-03-04")).toBe("F2026-");
    expect(invoiceSeries("R4", "2026-03-04")).toBe("R2026-");
    expect(formatNumber("F2026-", 7)).toBe("F2026-0007");
  });

  it("variables: rellena las conocidas y marca las que faltan", () => {
    const values = { "cliente.nombre": "Ana", "cliente.nif": "" };
    expect(renderVariables("Hola {cliente.nombre} ({cliente.nif})", values)).toBe("Hola Ana ([cliente.nif])");
    expect(missingVariables("{cliente.nombre} {cliente.nif}", values)).toEqual(["cliente.nif"]);
  });
});

describe("facturas (con la app)", () => {
  let run: Awaited<ReturnType<typeof account>>["run"];
  let clientId: string;

  beforeAll(async () => {
    run = (await account("Facturas")).run;
    clientId = await run(async () => {
      await savePortalBrand({ brandName: "Estudio", legalName: "Estudio Pruebas SL", taxId: "B12345678", legalAddress: "Calle Mayor 1, Madrid" });
      return (await createClient({ name: "Cliente SA", taxId: "A87654321", address: "Gran Vía 2, Madrid" })).client.id;
    });
  });

  const newInvoice = (amount: number) =>
    run(async () => {
      const doc = await createDocument({ type: "invoice", clientId });
      await updateDocument(doc.id, { lines: [{ description: "Servicio", quantity: 1, unitPrice: amount, vat: 21 }] });
      return doc.id;
    });

  it("no emite sin NIF del cliente", async () => {
    const noTax = await run(async () => (await createClient({ name: "Sin NIF", address: "Calle 3" })).client.id);
    await expect(
      run(async () => {
        const doc = await createDocument({ type: "invoice", clientId: noTax });
        await updateDocument(doc.id, { lines: [{ description: "x", quantity: 1, unitPrice: 10, vat: 21 }] });
        return documentAction(doc.id, { action: "issue" });
      }),
    ).rejects.toThrow(/NIF del cliente/);
  });

  it("numera correlativamente, encadena las huellas y la cadena queda íntegra", async () => {
    const a = await run(async () => documentAction(await newInvoice(100), { action: "issue" }));
    const b = await run(async () => documentAction(await newInvoice(250), { action: "issue" }));
    const year = new Date().getFullYear();
    expect(a.number).toBe(`F${year}-0001`);
    expect(b.number).toBe(`F${year}-0002`);
    const [da, db] = await run(() => Promise.all([getStore().getDocument(a.id), getStore().getDocument(b.id)]));
    expect(db!.record!.prevHash).toBe(da!.record!.hash);
    expect(sha256(db!.record!.input)).toBe(db!.record!.hash);
    expect(await run(verifyChain)).toMatchObject({ ok: true, invoices: 2, problems: [] });
  });

  it("una factura emitida no se puede cambiar ni borrar", async () => {
    const id = await newInvoice(80);
    await run(() => documentAction(id, { action: "issue" }));
    await expect(run(() => updateDocument(id, { lines: [{ description: "otra", quantity: 1, unitPrice: 1, vat: 21 }] }))).rejects.toMatchObject({ status: 409 });
    await expect(run(() => deleteDocument(id))).rejects.toMatchObject({ status: 409 });
  });

  it("detecta si alguien altera una factura guardada", async () => {
    const id = await newInvoice(500);
    await run(() => documentAction(id, { action: "issue" }));
    await run(async () => {
      const doc = (await getStore().getDocument(id))!;
      await getStore().putDocument({ ...doc, lines: [{ ...doc.lines[0], unitPrice: 5 }] }); // cambio "por detrás"
    });
    const check = await run(verifyChain);
    expect(check.ok).toBe(false);
    expect(check.problems.join(" ")).toMatch(/no coinciden con su huella/);
  });

  it("la rectificativa va en su serie, en negativo, y marca la original", async () => {
    const original = await run(async () => documentAction(await newInvoice(300), { action: "issue" }));
    const draft = await run(() => createRectification(original.id));
    expect(draft.kind).toBe("R4");
    expect(draft.lines[0]).toMatchObject({ quantity: -1, unitPrice: 300 });
    const issued = await run(() => documentAction(draft.id, { action: "issue" }));
    expect(issued.number).toBe(`R${new Date().getFullYear()}-0001`);
    expect((await run(() => getStore().getDocument(original.id)))!.status).toBe("rectified");
  });

  it("las propuestas se envían y quedan fijadas", async () => {
    const id = await run(async () => (await createDocument({ type: "proposal", clientId })).id);
    await run(() => documentAction(id, { action: "send" }));
    await expect(run(() => updateDocument(id, { title: "Otro" }))).rejects.toMatchObject({ status: 409 });
    await run(() => documentAction(id, { action: "accept", name: "Cliente" }));
    expect((await run(() => getStore().getDocument(id)))!.status).toBe("accepted");
  });
});

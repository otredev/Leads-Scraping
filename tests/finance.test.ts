import { beforeAll, describe, expect, it } from "vitest";
import { monthsBetween, occurrences } from "@/core/finance";
import { createClient, createProject, updateProject } from "@/server/clients";
import { createExpense, getFinanceReport, saveFinanceSettings } from "@/server/finance";
import type { FinanceReport } from "@/core/finance";
import { account } from "./helpers";

describe("gastos recurrentes (cálculos puros)", () => {
  it("meses de un periodo", () => {
    expect(monthsBetween("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("un gasto mensual cuenta una vez por mes dentro del periodo y hasta su fin", () => {
    const e = { date: "2026-01-10", recurrence: "monthly" as const, endDate: "2026-04-30" };
    expect(occurrences(e, "2026-02-01", "2026-12-31")).toHaveLength(3); // feb, mar, abr
    expect(occurrences({ date: "2026-01-10" }, "2026-02-01", "2026-12-31")).toHaveLength(0); // puntual, fuera del periodo
  });
});

/**
 * Escenario (1 de enero a 31 de marzo de 2026), calculado a mano:
 * - Cliente A: cobra 1000 €, 10 h que cuentan (a 20 €/h = 200 €) y un gasto directo de 100 €.
 * - Cliente B: cobra 3000 €, 5 h que NO cuentan (proyecto a precio cerrado).
 * - Gasto general de 30 €/mes (90 €), repartido según ingresos: A 25 %, B 75 %.
 * - Captación de 60 € en "Web", canal sin clientes: queda sin repartir.
 */
describe("informe de rentabilidad", () => {
  let report: FinanceReport;

  beforeAll(async () => {
    const { run } = await account("Finanzas");
    report = await run(async () => {
      await saveFinanceSettings({ hourlyCost: 20, currency: "EUR" });
      const a = (await createClient({ name: "Cliente A" })).client;
      const b = (await createClient({ name: "Cliente B" })).client;
      const pa = await createProject({ clientId: a.id, name: "Web A", countHours: true });
      const pb = await createProject({ clientId: b.id, name: "Web B", countHours: false });
      await updateProject(pa.id, { addPayment: { amount: 1000, date: "2026-02-10" } });
      await updateProject(pa.id, { addTime: { hours: 10, date: "2026-02-11" } });
      await updateProject(pb.id, { addPayment: { amount: 3000, date: "2026-03-01" } });
      await updateProject(pb.id, { addTime: { hours: 5, date: "2026-03-02" } });
      await createExpense({ concept: "Plugin", amount: 100, type: "direct", clientId: a.id, date: "2026-02-15" });
      await createExpense({ concept: "Hosting", amount: 30, type: "overhead", recurrence: "monthly", date: "2026-01-01" });
      await createExpense({ concept: "Anuncio web", amount: 60, type: "acquisition", channel: "Web", date: "2026-01-20" });
      return getFinanceReport({ from: "2026-01-01", to: "2026-03-31" });
    });
  });

  it("totales del periodo", () => {
    expect(report.totals).toMatchObject({ revenue: 4000, direct: 100, overhead: 90, acquisition: 60, timeCost: 200 });
    expect(report.totals.net).toBe(4000 - 100 - 90 - 60 - 200);
  });

  it("reparte los gastos generales según lo que factura cada cliente", () => {
    const a = report.clients.find((c) => c.name === "Cliente A")!;
    const b = report.clients.find((c) => c.name === "Cliente B")!;
    expect(a.overheadShare).toBeCloseTo(22.5, 2);
    expect(b.overheadShare).toBeCloseTo(67.5, 2);
  });

  it("las horas cuentan solo en los proyectos que lo tienen activado", () => {
    const a = report.clients.find((c) => c.name === "Cliente A")!;
    const b = report.clients.find((c) => c.name === "Cliente B")!;
    expect(a.timeCost).toBe(200);
    expect(b.timeCost).toBe(0);
    expect(b.perHour).toBe(600); // 3000 € / 5 h
  });

  it("la captación de un canal sin clientes queda sin repartir", () => {
    expect(report.unallocated.acquisition).toBe(60);
  });

  it("valida los gastos", async () => {
    const { run } = await account("Validación");
    await expect(run(() => createExpense({ concept: "x", amount: "abc" }))).rejects.toMatchObject({ status: 400 });
    await expect(run(() => createExpense({ concept: "x", amount: 5, type: "direct" }))).rejects.toMatchObject({ status: 400 });
    await expect(run(() => createExpense({ concept: "x", amount: 5, type: "acquisition" }))).rejects.toMatchObject({ status: 400 });
  });
});

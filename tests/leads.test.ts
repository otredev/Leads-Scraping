import { describe, expect, it } from "vitest";
import { dedupeLeads, leadDedupeKey, type Lead } from "@/core/lead";

const lead = (over: Partial<Lead>): Lead => ({ id: crypto.randomUUID(), name: "Bar Pepe", emails: [], collectedAt: "2026-01-01T00:00:00Z", ...over }) as Lead;

describe("leads duplicados", () => {
  it("el mismo negocio (mismo id de Google) cuenta una vez y se queda el más reciente", () => {
    const old = lead({ externalId: "g1", phone: "1", collectedAt: "2026-01-01T00:00:00Z" });
    const fresh = lead({ externalId: "g1", phone: "2", collectedAt: "2026-02-01T00:00:00Z" });
    const other = lead({ externalId: "g2" });
    const out = dedupeLeads([old, fresh, other]);
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.externalId === "g1")?.phone).toBe("2");
  });

  it("sin id, compara nombre y dirección sin importar mayúsculas ni espacios", () => {
    expect(leadDedupeKey({ name: " Bar Pepe ", address: "Calle 1" })).toBe(leadDedupeKey({ name: "bar pepe", address: "calle 1 " }));
    expect(leadDedupeKey({ name: "Bar Pepe", address: "Calle 1" })).not.toBe(leadDedupeKey({ name: "Bar Pepe", address: "Calle 2" }));
  });
});

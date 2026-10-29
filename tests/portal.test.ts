import { beforeAll, describe, expect, it } from "vitest";
import { buildSnapshot } from "@/server/portal";
import { createClient, createProject, updateProject } from "@/server/clients";
import { createTask } from "@/server/tasks";
import { createDocument, documentAction, updateDocument } from "@/server/documents";
import { sendMessage } from "@/server/messages";
import { savePortalBrand } from "@/server/crm";
import { getStore } from "@/server/registry";
import type { PortalSnapshot } from "@/core/portal";
import { account } from "./helpers";

/**
 * Lo que se publica en el portal del cliente: solo lo marcado como visible.
 * Nada de notas internas, horas, tarifas, borradores ni datos de otros clientes.
 */
describe("snapshot del portal", () => {
  let snap: PortalSnapshot;
  let json: string;
  let ownerId: string;

  beforeAll(async () => {
    const acc = await account("Portal");
    ownerId = acc.user.id;
    snap = await acc.run(async () => {
      await savePortalBrand({ brandName: "Estudio Portal", legalName: "Estudio Portal SL", taxId: "B11111111", legalAddress: "Calle 1" });
      const client = (await createClient({ name: "Cliente Visible", contactName: "Laura", notes: "NOTA-INTERNA-SECRETA", taxId: "A22222222", address: "Calle 2" })).client;
      const other = (await createClient({ name: "OTRO-CLIENTE" })).client;

      const p = await createProject({ clientId: client.id, name: "Web nueva", budget: 2000, hourlyRate: 77 });
      await updateProject(p.id, { addMilestone: { title: "Diseño aprobado" } });
      await updateProject(p.id, { addMilestone: { title: "HITO-OCULTO", visibleToClient: false } });
      await updateProject(p.id, { addPayment: { amount: 500, date: "2026-01-10", note: "PAGO-PRIVADO" } });
      await updateProject(p.id, { addTime: { hours: 3, date: "2026-01-11", note: "HORAS-PRIVADAS" } });
      await createTask({ title: "Enviar textos", projectId: p.id, visibleToClient: true });
      await createTask({ title: "TAREA-INTERNA", projectId: p.id });
      const cancelled = await createProject({ clientId: client.id, name: "PROYECTO-CANCELADO" });
      await updateProject(cancelled.id, { status: "cancelled" });
      await createProject({ clientId: other.id, name: "PROYECTO-DE-OTRO" });

      const draft = await createDocument({ type: "proposal", clientId: client.id, title: "BORRADOR-SIN-ENVIAR" });
      void draft;
      const sent = await createDocument({ type: "proposal", clientId: client.id, title: "Propuesta enviada" });
      await documentAction(sent.id, { action: "send" });
      const hidden = await createDocument({ type: "proposal", clientId: client.id, title: "DOC-NO-VISIBLE" });
      await updateDocument(hidden.id, { visibleToClient: false });
      await documentAction(hidden.id, { action: "send" });

      await sendMessage(client.id, { body: "NOTA-DEL-CHAT", internal: true });
      return buildSnapshot((await getStore().getClient(client.id))!);
    });
    json = JSON.stringify(snap);
  });

  it("incluye lo visible", () => {
    expect(snap.client).toEqual({ id: snap.client.id, name: "Cliente Visible", contactName: "Laura" });
    expect(snap.brand.name).toBe("Estudio Portal");
    expect(snap.owner).toBe(ownerId);
    expect(snap.projects.map((p) => p.name)).toEqual(["Web nueva"]);
    expect(snap.projects[0].milestones.map((m) => m.title)).toEqual(["Diseño aprobado"]);
    expect(snap.projects[0].tasks.map((t) => t.title)).toEqual(["Enviar textos"]);
    expect(snap.documents?.map((d) => d.title)).toEqual(["Propuesta enviada"]);
  });

  it("no publica nada interno", () => {
    for (const secret of [
      "NOTA-INTERNA-SECRETA",
      "HITO-OCULTO",
      "TAREA-INTERNA",
      "HORAS-PRIVADAS",
      "PROYECTO-CANCELADO",
      "PROYECTO-DE-OTRO",
      "OTRO-CLIENTE",
      "BORRADOR-SIN-ENVIAR",
      "DOC-NO-VISIBLE",
      "NOTA-DEL-CHAT",
      "hourlyRate",
    ])
      expect(json).not.toContain(secret);
    // El NIF del cliente solo va dentro de sus documentos, no en la ficha del portal.
    expect(JSON.stringify({ ...snap, documents: undefined })).not.toContain("A22222222");
  });

  it("los pagos solo se ven si se activa en el proyecto", async () => {
    expect(snap.projects[0].money).toBeUndefined();
    expect(json).not.toContain("PAGO-PRIVADO");
  });
});

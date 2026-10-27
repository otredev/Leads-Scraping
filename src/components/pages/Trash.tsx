"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import { api, postJson, useData } from "../data/DataProvider";
import { Card, EmptyState, Loading, Notice, PageHeader, RowsSkeleton } from "../ui";

function daysLeft(iso?: string) {
  if (!iso) return undefined;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Leads borrados: se pueden restaurar hasta que caduquen. */
export function Trash() {
  const { modules, refreshSaved } = useData();
  const [leads, setLeads] = useState<SavedLead[]>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>();

  const load = useCallback(
    () =>
      api<SavedLead[]>("/api/leads?trash=1")
        .then(setLeads)
        .catch((e: Error) => {
          setLeads([]);
          setNotice({ text: e.message, tone: "error" });
        }),
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      setNotice({ text: done });
      await load();
      void refreshSaved();
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(undefined);
    }
  }

  const restore = (l: SavedLead) =>
    act(l.id, () => postJson("/api/leads/restore", { ids: [l.id] }), `"${l.name}" ha vuelto a Leads.`);

  const purge = (l: SavedLead) => {
    if (!window.confirm(`¿Eliminar "${l.name}" para siempre? No se puede deshacer.`)) return;
    void act(l.id, () => postJson("/api/leads/trash", { ids: [l.id] }, "DELETE"), `"${l.name}" eliminado definitivamente.`);
  };

  const empty = () => {
    if (!leads?.length) return;
    if (!window.confirm(`¿Vaciar la papelera? Se eliminarán ${leads.length} leads para siempre.`)) return;
    void act("all", () => postJson("/api/leads/trash", { all: true }, "DELETE"), "Papelera vaciada.");
  };

  const days = modules?.defaults.trashDays ?? 30;

  return (
    <>
      <PageHeader
        title="Papelera"
        description={`Los leads borrados se eliminan solos a los ${days} días. Hasta entonces puedes restaurarlos.`}
        actions={
          <button className="btn" onClick={empty} disabled={!leads?.length || busy === "all"}>
            <Trash2 className="size-4" aria-hidden />
            Vaciar papelera
          </button>
        }
      />
      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Notice>
      )}
      <Card bodyClassName="" className="overflow-hidden">
        {!leads ? (
          <Loading label="Cargando la papelera…">
            <RowsSkeleton rows={5} cols={4} />
          </Loading>
        ) : leads.length === 0 ? (
          <div className="p-5">
            <EmptyState title="La papelera está vacía">Los leads que borres desde Leads aparecerán aquí.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Borrado</th>
                  <th className="px-3 py-2.5 font-medium">Se elimina</th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const left = daysLeft(l.purgeAt);
                  return (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <span className="block font-medium">{l.name}</span>
                        <span className="block text-xs text-muted">{[l.category, l.phone].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted">
                        {l.deletedAt ? new Date(l.deletedAt).toLocaleDateString("es") : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {left === undefined ? "—" : left === 0 ? "Hoy" : `En ${left} ${left === 1 ? "día" : "días"}`}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-right">
                        <button className="btn btn-sm" disabled={busy === l.id} onClick={() => void restore(l)}>
                          <RotateCcw className="size-3.5" aria-hidden />
                          Restaurar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm ml-1 text-muted hover:text-danger"
                          disabled={busy === l.id}
                          onClick={() => purge(l)}
                          aria-label={`Eliminar ${l.name} para siempre`}
                          title="Eliminar para siempre"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

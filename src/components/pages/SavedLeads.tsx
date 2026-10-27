"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SavedLead } from "@/core/lead";
import { api, postJson, useData } from "../data/DataProvider";
import { LeadsTable } from "../LeadsTable";
import { EmptyState, Notice, PageHeader } from "../ui";

/** Leads guardados: tu CRM. */
export function SavedLeads() {
  const { modules, refreshSaved } = useData();
  const [leads, setLeads] = useState<SavedLead[]>();
  const [notice, setNotice] = useState<{ text: React.ReactNode; tone?: "error" }>();

  const load = useCallback(
    () =>
      api<SavedLead[]>("/api/leads")
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

  async function trash(ids: string[]) {
    try {
      await postJson("/api/leads/trash", { ids });
      setLeads((list) => list?.filter((l) => !ids.includes(l.id)));
      void refreshSaved();
      const days = modules?.defaults.trashDays ?? 30;
      setNotice({
        text: (
          <>
            Movido a la papelera. Se eliminará en {days} días.{" "}
            <button
              className="font-medium underline underline-offset-2"
              onClick={async () => {
                await postJson("/api/leads/restore", { ids });
                setNotice(undefined);
                void refreshSaved();
                await load();
              }}
            >
              Deshacer
            </button>
          </>
        ),
      });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Los negocios que has guardado desde tus resultados. Si vuelves a guardar uno, sus datos se actualizan."
        actions={
          <Link href="/resultados" className="btn">
            Ver resultados
          </Link>
        }
      />
      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Notice>
      )}
      <LeadsTable
        mode="saved"
        leads={leads ?? []}
        searchId="all"
        exporters={modules?.exporters ?? []}
        loading={!leads}
        onTrash={trash}
        empty={
          <EmptyState
            title="Aún no has guardado ningún lead"
            action={
              <Link href="/resultados" className="btn btn-primary">
                Ir a resultados
              </Link>
            }
          >
            En Resultados, guarda una fila con el icono de marcador o todos los visibles con &ldquo;Guardar visibles&rdquo;.
          </EmptyState>
        }
      />
    </>
  );
}

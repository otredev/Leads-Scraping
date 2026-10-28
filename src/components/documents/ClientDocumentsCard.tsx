"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { formatAmount } from "@/core/documents";
import type { DocumentView } from "@/server/documents";
import { api } from "../data/DataProvider";
import { Card, Skeleton } from "../ui";
import { DocStatusBadge } from "./parts";
import { NewDocumentDialog } from "./dialogs";

/** Propuestas, contratos y facturas de un cliente (en su ficha). */
export function ClientDocumentsCard({ clientId, projectId }: { clientId: string; projectId?: string }) {
  const [docs, setDocs] = useState<DocumentView[]>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<DocumentView[]>(`/api/documents?clientId=${clientId}`)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [clientId]);

  return (
    <Card
      title="Documentos"
      description="Propuestas, contratos y facturas"
      actions={
        <button className="btn btn-sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" aria-hidden /> Nuevo
        </button>
      }
    >
      {!docs ? (
        <Skeleton className="h-16 w-full" />
      ) : docs.length ? (
        <ul className="-mx-1 divide-y divide-line text-[13px]">
          {docs.slice(0, 8).map((d) => (
            <li key={d.id}>
              <Link href={`/documentos/${d.id}`} className="flex items-center gap-2 rounded-md px-1 py-2 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.renderedTitle}</span>
                  <span className="block truncate text-xs text-muted">
                    {[d.number, d.lines.length ? formatAmount(d.totals.total, d.currency) : ""].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <DocStatusBadge type={d.type} status={d.status} expired={d.expired} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Crea una propuesta, un contrato o una factura con sus datos ya rellenados.</p>
      )}
      {creating && <NewDocumentDialog clientId={clientId} projectId={projectId} onClose={() => setCreating(false)} />}
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileSignature, FileText, History, Plus, Receipt, Search, Settings2, ShieldAlert, ShieldCheck, Trash2, Pencil } from "lucide-react";
import { DOC_TYPES, STATUSES_BY_TYPE, docTypeLabel, formatAmount, statusLabel, type DocTemplate, type DocType } from "@/core/documents";
import type { DocEvent, DocumentView } from "@/server/documents";
import { api } from "../data/DataProvider";
import { Dialog } from "../clients/Dialog";
import { Card, EmptyState, Loading, Notice, PageHeader, RowsSkeleton, StatCard, StatCardSkeleton } from "../ui";
import { DocStatusBadge } from "../documents/parts";
import { DocumentSettingsDialog, NewDocumentDialog, TemplateForm } from "../documents/dialogs";

type Tab = DocType | "templates";
const TABS: { id: Tab; label: string; slug: string }[] = [
  ...DOC_TYPES.map((t) => ({ id: t.id as Tab, label: t.plural, slug: t.plural.toLowerCase() })),
  { id: "templates", label: "Plantillas", slug: "plantillas" },
];

const NEW_LABEL: Record<Tab, string> = { proposal: "Nueva propuesta", contract: "Nuevo contrato", invoice: "Nueva factura", templates: "Nueva plantilla" };
const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Propuestas, contratos y facturas, con sus plantillas. */
export function Documents() {
  // La pestaña va en la dirección (?tipo=facturas) para poder enlazarla desde el buscador.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = TABS.find((t) => t.slug === params.get("tipo"))?.id ?? "proposal";
  const setTab = (id: Tab) => router.replace(`${pathname}?tipo=${TABS.find((t) => t.id === id)!.slug}`, { scroll: false });
  const [docs, setDocs] = useState<DocumentView[]>();
  const [templates, setTemplates] = useState<DocTemplate[]>();
  const [today, setToday] = useState("");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocTemplate | "new">();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([api<DocumentView[]>("/api/documents"), api<DocTemplate[]>("/api/documents/templates")]);
      setDocs(d);
      setTemplates(t);
      setToday(ymd(new Date()));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stats = useMemo(() => {
    if (!docs) return undefined;
    const year = today.slice(0, 4);
    const sentProposals = docs.filter((d) => d.type === "proposal" && d.status === "sent" && !d.expired);
    const decided = docs.filter((d) => d.type === "proposal" && (d.status === "accepted" || d.status === "rejected"));
    const invoices = docs.filter((d) => d.type === "invoice" && d.number && d.date.startsWith(year));
    const unpaid = docs.filter((d) => d.type === "invoice" && d.status === "issued" && d.kind !== "R4");
    const sum = (list: DocumentView[]) => list.reduce((s, d) => s + d.totals.total, 0);
    return {
      pending: sentProposals.length,
      pendingAmount: sum(sentProposals),
      rate: decided.length ? Math.round((decided.filter((d) => d.status === "accepted").length / decided.length) * 100) : undefined,
      billed: sum(invoices),
      unpaid: sum(unpaid),
      overdue: unpaid.filter((d) => d.dueDate && d.dueDate < today).length,
    };
  }, [docs, today]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (docs ?? [])
      .filter((d) => d.type === tab)
      .filter((d) => !status || d.status === status)
      .filter((d) => !s || [d.renderedTitle, d.clientName, d.projectName, d.number].some((v) => v?.toLowerCase().includes(s)));
  }, [docs, tab, status, q]);

  const money = (n: number) => formatAmount(n, "EUR");

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Propuestas, contratos y facturas para tus clientes, con plantillas que se rellenan solas."
        actions={
          <>
            <button className="btn" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" aria-hidden /> Ajustes
            </button>
            <button className="btn btn-primary" onClick={() => (tab === "templates" ? setEditingTemplate("new") : setCreating(true))}>
              <Plus className="size-4" aria-hidden /> {NEW_LABEL[tab]}
            </button>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Propuestas pendientes" value={stats.pending} detail={stats.pending ? `${money(stats.pendingAmount)} en juego` : "Ninguna esperando respuesta"} icon={<FileText className="size-4" />} />
            <StatCard label="Tasa de aceptación" value={stats.rate !== undefined ? `${stats.rate} %` : "—"} detail="Propuestas aceptadas sobre decididas" icon={<CheckCircle2 className="size-4" />} />
            <StatCard label="Facturado este año" value={money(stats.billed)} detail="Facturas emitidas (total a cobrar)" icon={<Receipt className="size-4" />} />
            <StatCard
              label="Pendiente de cobro"
              value={<span className={stats.overdue ? "text-danger" : ""}>{money(stats.unpaid)}</span>}
              detail={stats.overdue ? `${stats.overdue} ${stats.overdue === 1 ? "factura vencida" : "facturas vencidas"}` : "Facturas emitidas sin cobrar"}
              icon={<FileSignature className="size-4" />}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Tipo de documento" className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${tab === x.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
              onClick={() => {
                setTab(x.id);
                setStatus("");
              }}
            >
              {x.label}
              {x.id !== "templates" && docs && <span className="ml-1.5 text-xs opacity-60">{docs.filter((d) => d.type === x.id).length}</span>}
            </button>
          ))}
        </div>
        {tab === "invoice" && <ChainStatus />}
      </div>

      {tab === "templates" ? (
        <TemplatesList templates={templates} onEdit={setEditingTemplate} onChanged={load} />
      ) : (
        <Card bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input className="input pl-9" placeholder="Buscar por título, cliente o número…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar documentos" />
            </div>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
              <option value="">Todos los estados</option>
              {STATUSES_BY_TYPE[tab].map((s) => (
                <option key={s} value={s}>
                  {statusLabel(tab, s)}
                </option>
              ))}
            </select>
          </div>
          {!docs ? (
            <Loading label="Cargando documentos…">
              <div className="p-5">
                <RowsSkeleton rows={5} cols={4} />
              </div>
            </Loading>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={docs.some((d) => d.type === tab) ? "Ninguno coincide con el filtro" : `Aún no tienes ${DOC_TYPES.find((t) => t.id === tab)!.plural.toLowerCase()}`}
                action={
                  <button className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden /> Crear
                  </button>
                }
              >
                {tab === "invoice"
                  ? "Crea una factura desde cero o convierte una propuesta aceptada. Al emitirla se numera y ya no se puede cambiar."
                  : "Elige un cliente y una plantilla: el texto se rellena con sus datos y los del proyecto."}
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/documentos/${d.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2 sm:px-5 md:grid-cols-[120px_minmax(0,1.6fr)_minmax(0,1fr)_110px_auto] md:items-center"
                  >
                    <span className="hidden text-[13px] text-muted tabular-nums md:block">{d.number ?? "Borrador"}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.renderedTitle}</span>
                      <span className="block truncate text-xs text-muted">
                        {[d.clientName, d.projectName, fmtDay(d.date)].filter(Boolean).join(" · ")}
                        <span className="md:hidden">{d.number ? ` · ${d.number}` : ""}</span>
                      </span>
                    </span>
                    <span className="col-start-2 row-start-1 text-right font-semibold tabular-nums md:col-start-auto md:row-start-auto md:order-last">
                      {d.lines.length ? formatAmount(d.totals.total, d.currency) : "—"}
                    </span>
                    <span className="hidden truncate text-[13px] text-fg-2 md:block">
                      {d.acceptance ? `${d.type === "contract" ? "Firmado" : "Aceptada"} por ${d.acceptance.name}` : d.dueDate && d.type !== "contract" ? `${d.type === "invoice" ? "Vence" : "Válida hasta"} ${fmtDay(d.dueDate)}` : ""}
                    </span>
                    <span>
                      <DocStatusBadge type={d.type} status={d.status} expired={d.expired} overdue={d.type === "invoice" && d.status === "issued" && !!d.dueDate && d.dueDate < today} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {creating && <NewDocumentDialog type={tab === "templates" ? undefined : tab} onClose={() => setCreating(false)} />}
      {settingsOpen && <DocumentSettingsDialog onClose={() => setSettingsOpen(false)} />}
      {editingTemplate && (
        <TemplateForm
          template={editingTemplate === "new" ? undefined : editingTemplate}
          onClose={() => setEditingTemplate(undefined)}
          onSaved={() => {
            setEditingTemplate(undefined);
            void load();
          }}
        />
      )}
    </>
  );
}

function TemplatesList({ templates, onEdit, onChanged }: { templates?: DocTemplate[]; onEdit(t: DocTemplate): void; onChanged(): void }) {
  const [error, setError] = useState<string>();
  if (!templates) return <RowsSkeleton rows={4} cols={2} />;

  async function remove(t: DocTemplate) {
    try {
      await api(`/api/documents/templates/${t.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Notice tone="error" onClose={() => setError(undefined)}>
          {error}
        </Notice>
      )}
      {DOC_TYPES.map((type) => (
        <Card key={type.id} title={type.plural} bodyClassName="p-0">
          <ul className="divide-y divide-line border-t border-line">
            {templates
              .filter((t) => t.type === type.id)
              .map((t) => {
                // Una incluida que has editado se guarda con fecha de cambio distinta de la original.
                const edited = Boolean(t.builtIn && t.updatedAt !== t.createdAt);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[t.builtIn ? (edited ? "Incluida (modificada)" : "Incluida") : "Tuya", t.lines.length ? `${t.lines.length} ${t.lines.length === 1 ? "línea" : "líneas"}` : "", t.days ? `${t.days} días` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(t)}>
                      <Pencil className="size-3.5" aria-hidden /> Editar
                    </button>
                    {(!t.builtIn || edited) && (
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(t)} title={t.builtIn ? "Volver a la versión original" : "Borrar plantilla"}>
                        <Trash2 className="size-3.5" aria-hidden /> {t.builtIn ? "Restaurar" : "Borrar"}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** Estado de la cadena de huellas y registro de eventos. */
function ChainStatus() {
  const [v, setV] = useState<{ ok: boolean; invoices: number; problems: string[] }>();
  const [events, setEvents] = useState<DocEvent[]>();
  useEffect(() => {
    api<{ ok: boolean; invoices: number; problems: string[] }>("/api/documents/verify")
      .then(setV)
      .catch(() => undefined);
  }, []);
  if (!v) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`badge ${v.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        title={v.ok ? "Cada factura emitida conserva su huella y está encadenada con la anterior" : v.problems.join("\n")}
      >
        {v.ok ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldAlert className="size-3.5" aria-hidden />}
        {v.ok ? `Registro íntegro · ${v.invoices} ${v.invoices === 1 ? "factura" : "facturas"}` : `${v.problems.length} problemas en el registro`}
      </span>
      <button
        className="btn btn-sm"
        onClick={() =>
          api<DocEvent[]>("/api/documents/events")
            .then(setEvents)
            .catch(() => setEvents([]))
        }
      >
        <History className="size-3.5" aria-hidden /> Registro
      </button>
      {events && (
        <Dialog title="Registro de eventos" description="Todo lo que ha pasado con tus documentos, del más reciente al más antiguo." onClose={() => setEvents(undefined)} width="max-w-2xl">
          {!v.ok && (
            <ul className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {v.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {events.length ? (
            <ul className="divide-y divide-line text-[13px]">
              {events.map((e, i) => (
                <li key={i} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 py-2">
                  <span className="text-muted tabular-nums">{new Date(e.at).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" })}</span>
                  <span>
                    <strong>{EVENT_LABEL[e.type]}</strong> · {docTypeLabel(e.docType)} {e.number ?? ""}
                    {e.detail && <span className="block text-muted">{e.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Sin eventos todavía.</p>
          )}
        </Dialog>
      )}
    </div>
  );
}

const EVENT_LABEL: Record<DocEvent["type"], string> = {
  create: "Creado",
  send: "Enviado",
  issue: "Factura emitida",
  accept: "Aceptado",
  reject: "Rechazado",
  paid: "Cobrada",
  unpaid: "Cobro deshecho",
  rectify: "Rectificada",
  delete: "Borrador eliminado",
  reopen: "Vuelto a borrador",
  cancel: "Cancelado",
};

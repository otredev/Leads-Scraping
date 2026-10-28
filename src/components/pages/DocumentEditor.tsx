"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Eye, EyeOff, FileSignature, MoreHorizontal, Printer, Receipt, RotateCcw, Send, Stamp, Trash2, Undo2, X } from "lucide-react";
import { VARIABLES, docTypeLabel, formatAmount, longDate, type Document } from "@/core/documents";
import type { DocEvent, DocumentView } from "@/server/documents";
import { api, postJson, useData } from "../data/DataProvider";
import { Dialog, Field } from "../clients/Dialog";
import { MenuItem, Popover } from "../leads/Popover";
import { Card, Notice, Skeleton } from "../ui";
import { DocumentPaper } from "../documents/DocumentPaper";
import { DocStatusBadge, LinesEditor, VariablePicker, fromDraft, insertAtCursor, toDraft, type LineDraft } from "../documents/parts";

interface Draft {
  title: string;
  body: string;
  date: string;
  dueDate: string;
  irpf: string;
  notes: string;
  projectId: string;
  lines: LineDraft[];
}

const toDraftDoc = (d: Document): Draft => ({
  title: d.title,
  body: d.body,
  date: d.date,
  dueDate: d.dueDate ?? "",
  irpf: d.irpf?.toString() ?? "",
  notes: d.notes ?? "",
  projectId: d.projectId ?? "",
  lines: d.lines.map(toDraft),
});

const variableLabel = (key: string) => {
  for (const g of VARIABLES) for (const v of g.items) if (v.key === key) return `${g.group}: ${v.label.toLowerCase()}`;
  return key;
};

type Confirm = "send" | "issue" | "accept" | "paid" | "delete";

/** Editor de un documento (borrador) o su vista con acciones (enviado, emitido…). */
export function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useData();
  const [doc, setDoc] = useState<DocumentView>();
  const [draft, setDraft] = useState<Draft>();
  const [projects, setProjects] = useState<{ id: string; name: string; clientId: string }[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [missingDoc, setMissingDoc] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>();
  const [name, setName] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [registerPayment, setRegisterPayment] = useState(true);
  const [events, setEvents] = useState<DocEvent[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<"title" | "body">("body");
  const dirty = useRef(false);

  const apply = useCallback((v: DocumentView) => {
    setDoc(v);
    if (v.status === "draft") setDraft((d) => (dirty.current && d ? d : toDraftDoc(v)));
    else setDraft(undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api<DocumentView>(`/api/documents/${id}`));
      setEvents(await api<DocEvent[]>(`/api/documents/events?docId=${id}`));
    } catch (err) {
      if (/no encontrado/i.test((err as Error).message)) setMissingDoc(true);
      else setError((err as Error).message);
    }
  }, [id, apply]);

  useEffect(() => {
    void Promise.resolve().then(load);
    api<{ id: string; name: string; clientId: string }[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [load]);

  const latest = useRef<Draft | undefined>(undefined);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  /** Guarda el borrador si hay cambios pendientes. Devuelve false si falló. */
  const saveNow = useCallback(async () => {
    const d = latest.current;
    if (!d || !dirty.current) return true;
    dirty.current = false;
    setSaving("saving");
    try {
      const v = await postJson<DocumentView>(
        `/api/documents/${id}`,
        {
          title: d.title,
          body: d.body,
          date: d.date,
          dueDate: d.dueDate || null,
          irpf: d.irpf || null,
          notes: d.notes,
          projectId: d.projectId || null,
          lines: d.lines.map(fromDraft),
        },
        "PATCH",
      );
      setDoc(v);
      setSaving("saved");
      setError(undefined);
      return true;
    } catch (err) {
      dirty.current = true;
      setError((err as Error).message);
      setSaving("idle");
      return false;
    }
  }, [id]);

  // Guardado automático del borrador (con un pequeño retardo).
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => void saveNow(), 700);
    return () => clearTimeout(t);
  }, [draft, saveNow]);

  const edit = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    dirty.current = true;
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  async function act(body: Record<string, unknown>, path = "actions") {
    setBusy(true);
    setError(undefined);
    // Antes de enviar o emitir, guarda lo último que escribiste.
    if (!(await saveNow())) {
      setBusy(false);
      return;
    }
    try {
      const v = await postJson<DocumentView | Document>(`/api/documents/${id}/${path}`, body);
      if (path === "rectify") router.push(`/documentos/${(v as Document).id}`);
      else {
        apply(v as DocumentView);
        setEvents(await api<DocEvent[]>(`/api/documents/events?docId=${id}`));
      }
      setConfirm(undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function convert(type: Document["type"]) {
    setBusy(true);
    try {
      const created = await postJson<Document>("/api/documents", { fromId: id, type });
      router.push(`/documentos/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      router.push("/documentos");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function toggleVisible() {
    if (!doc) return;
    try {
      apply(await postJson<DocumentView>(`/api/documents/${id}`, { visibleToClient: !doc.visibleToClient }, "PATCH"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (missingDoc)
    return (
      <Card>
        <p className="py-6 text-center text-muted">
          Este documento no existe. <Link href="/documentos" className="underline">Volver a Documentos</Link>
        </p>
      </Card>
    );
  if (!doc)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );

  const isDraft = doc.status === "draft";
  const isInvoice = doc.type === "invoice";
  const clientProjects = projects.filter((p) => p.clientId === doc.clientId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="no-print">
        <Link href="/documentos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Documentos
        </Link>
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{doc.renderedTitle}</h1>
              <DocStatusBadge type={doc.type} status={doc.status} expired={doc.expired} overdue={isInvoice && doc.status === "issued" && !!doc.dueDate && doc.dueDate < today} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {docTypeLabel(doc.type)}
              {doc.number ? ` ${doc.number}` : ""} ·{" "}
              <Link href={`/clientes/${doc.clientId}`} className="hover:underline">
                {doc.clientName}
              </Link>
              {doc.projectName ? ` · ${doc.projectName}` : ""}
              {isDraft && <span className="ml-2 text-xs">{saving === "saving" ? "Guardando…" : saving === "saved" ? "Guardado" : ""}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && !isInvoice && (
              <button className="btn btn-primary" onClick={() => setConfirm("send")} disabled={busy || saving === "saving"}>
                <Send className="size-4" aria-hidden /> Marcar como enviado
              </button>
            )}
            {isDraft && isInvoice && (
              <button className="btn btn-primary" onClick={() => setConfirm("issue")} disabled={busy}>
                <Stamp className="size-4" aria-hidden /> Emitir factura
              </button>
            )}
            {doc.status === "sent" && (
              <button className="btn btn-primary" onClick={() => setConfirm("accept")} disabled={busy}>
                <Check className="size-4" aria-hidden /> {doc.type === "contract" ? "Marcar firmado" : "Marcar aceptada"}
              </button>
            )}
            {doc.status === "accepted" && doc.type === "proposal" && (
              <>
                <button className="btn btn-primary" onClick={() => void convert("invoice")} disabled={busy}>
                  <Receipt className="size-4" aria-hidden /> Crear factura
                </button>
                <button className="btn" onClick={() => void convert("contract")} disabled={busy}>
                  <FileSignature className="size-4" aria-hidden /> Crear contrato
                </button>
              </>
            )}
            {doc.status === "accepted" && doc.type === "contract" && (
              <button className="btn btn-primary" onClick={() => void convert("invoice")} disabled={busy}>
                <Receipt className="size-4" aria-hidden /> Crear factura
              </button>
            )}
            {doc.status === "issued" && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPaidDate(today);
                  setConfirm("paid");
                }}
                disabled={busy}
              >
                <Check className="size-4" aria-hidden /> Marcar cobrada
              </button>
            )}
            <button className="btn" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> PDF
            </button>
            <Popover label={<MoreHorizontal className="size-4" aria-label="Más acciones" />} buttonClassName="btn px-2.5" width="w-60">
              {(close) => (
                <>
                  {!isDraft && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void toggleVisible();
                      }}
                    >
                      {doc.visibleToClient ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                      {doc.visibleToClient ? "Ocultar en el portal" : "Mostrar en el portal"}
                    </MenuItem>
                  )}
                  {(doc.status === "sent" || doc.status === "rejected") && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void act({ action: "reopen" });
                      }}
                    >
                      <Undo2 className="size-4" aria-hidden /> Volver a borrador
                    </MenuItem>
                  )}
                  {doc.status === "sent" && doc.type === "proposal" && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void act({ action: "reject" });
                      }}
                    >
                      <X className="size-4" aria-hidden /> Marcar rechazada
                    </MenuItem>
                  )}
                  {doc.type === "contract" && (doc.status === "sent" || doc.status === "accepted") && (
                    <MenuItem
                      danger
                      onClick={() => {
                        close();
                        void act({ action: "cancel" });
                      }}
                    >
                      <X className="size-4" aria-hidden /> Cancelar contrato
                    </MenuItem>
                  )}
                  {doc.status === "paid" && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void act({ action: "unpaid" });
                      }}
                    >
                      <Undo2 className="size-4" aria-hidden /> Deshacer cobro
                    </MenuItem>
                  )}
                  {isInvoice && (doc.status === "issued" || doc.status === "paid") && doc.kind !== "R4" && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void act({}, "rectify");
                      }}
                    >
                      <RotateCcw className="size-4" aria-hidden /> Crear rectificativa
                    </MenuItem>
                  )}
                  {!isDraft && (
                    <MenuItem
                      onClick={() => {
                        close();
                        void convert(doc.type);
                      }}
                    >
                      <Copy className="size-4" aria-hidden /> Duplicar como borrador
                    </MenuItem>
                  )}
                  {isDraft && (
                    <MenuItem
                      danger
                      onClick={() => {
                        close();
                        setConfirm("delete");
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden /> Borrar borrador
                    </MenuItem>
                  )}
                </>
              )}
            </Popover>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <Notice tone="error" onClose={() => setError(undefined)}>
              {error}
            </Notice>
          </div>
        )}
        {doc.rectifiedBy && (
          <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
            Esta factura está rectificada por{" "}
            <Link href={`/documentos/${doc.rectifiedBy.id}`} className="font-semibold underline">
              {doc.rectifiedBy.number}
            </Link>
            .
          </p>
        )}
      </div>

      <div className={`grid grid-cols-1 items-start gap-5 ${isDraft ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
        {isDraft && draft && (
          <div className="no-print flex flex-col gap-5">
            {doc.missing.length > 0 && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                Faltan datos para: {doc.missing.map(variableLabel).join(", ")}. Aparecen como [variable] en el documento: complétalos en la{" "}
                <Link href={`/clientes/${doc.clientId}`} className="underline">
                  ficha del cliente
                </Link>
                , el proyecto o tus datos legales (Ajustes), o bórralos del texto.
              </p>
            )}
            <Card title="Datos">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Título" className="sm:col-span-2">
                  <input ref={titleRef} className="input" value={draft.title} onChange={(e) => edit("title", e.target.value)} onFocus={() => setFocus("title")} maxLength={200} />
                </Field>
                <Field label={isInvoice ? "Fecha de expedición" : "Fecha"} hint={isInvoice ? "No puede ser futura ni anterior a la última factura" : undefined}>
                  <input className="input" type="date" value={draft.date} onChange={(e) => edit("date", e.target.value)} />
                </Field>
                <Field label={isInvoice ? "Vencimiento" : doc.type === "proposal" ? "Válida hasta" : "Fecha fin (opcional)"}>
                  <input className="input" type="date" value={draft.dueDate} onChange={(e) => edit("dueDate", e.target.value)} />
                </Field>
                <Field label="Proyecto" className={isInvoice ? "" : "sm:col-span-2"}>
                  <select className="input" value={draft.projectId} onChange={(e) => edit("projectId", e.target.value)}>
                    <option value="">Sin proyecto</option>
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {isInvoice && (
                  <Field label="Retención IRPF (%)">
                    <input className="input" inputMode="decimal" value={draft.irpf} onChange={(e) => edit("irpf", e.target.value)} placeholder="Sin retención" />
                  </Field>
                )}
              </div>
            </Card>
            <Card
              title="Texto"
              description="Markdown: ## Título, **negrita**, - lista"
              actions={
                <VariablePicker
                  onPick={(v) =>
                    focus === "title" ? insertAtCursor(titleRef.current, v, draft.title, (x) => edit("title", x)) : insertAtCursor(bodyRef.current, v, draft.body, (x) => edit("body", x))
                  }
                />
              }
            >
              <textarea
                ref={bodyRef}
                className="input min-h-80 resize-y font-mono text-[13px] leading-relaxed"
                value={draft.body}
                onChange={(e) => edit("body", e.target.value)}
                onFocus={() => setFocus("body")}
                placeholder={isInvoice ? "Opcional: texto sobre las líneas (p. ej. periodo facturado)." : "Escribe o elige una plantilla al crear el documento."}
                aria-label="Texto del documento"
              />
            </Card>
            <Card title={isInvoice ? "Líneas de la factura" : "Importes"} description={isInvoice ? undefined : "Opcional en contratos"}>
              <LinesEditor
                lines={draft.lines}
                onChange={(l) => edit("lines", l)}
                defaultVat={settings?.documents?.vat ?? 21}
                irpf={draft.irpf ? Number(draft.irpf.replace(",", ".")) : undefined}
                currency={doc.currency}
              />
            </Card>
            <Card title="Notas al pie">
              <textarea className="input min-h-16 resize-y" value={draft.notes} onChange={(e) => edit("notes", e.target.value)} maxLength={2000} placeholder="Condiciones, forma de pago…" />
            </Card>
          </div>
        )}

        <div className="min-w-0">
          <p className="no-print mb-2 text-xs text-muted">{isDraft ? "Vista previa (con los datos actuales)" : "Documento"}</p>
          <DocumentPaper doc={doc} settings={settings?.documents} />
        </div>

        {!isDraft && (
          <aside className="no-print flex flex-col gap-5">
            <Card title="Detalles">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-muted">Total</dt>
                <dd className="text-right font-semibold">{formatAmount(doc.totals.total, doc.currency)}</dd>
                {doc.sentAt && (
                  <>
                    <dt className="text-muted">Enviado</dt>
                    <dd className="text-right">{longDate(doc.sentAt)}</dd>
                  </>
                )}
                {doc.paidAt && (
                  <>
                    <dt className="text-muted">Cobrada</dt>
                    <dd className="text-right">{longDate(doc.paidAt)}</dd>
                  </>
                )}
                <dt className="text-muted">Portal</dt>
                <dd className="text-right">{doc.visibleToClient ? "Visible para el cliente" : "Oculto"}</dd>
              </dl>
              {doc.acceptance && (
                <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">
                  {doc.type === "contract" ? "Firmado" : "Aceptado"} por <strong>{doc.acceptance.name}</strong>
                  {doc.acceptance.via === "portal" ? " en el portal" : " (marcado a mano)"}
                  {doc.acceptance.ip ? ` · IP ${doc.acceptance.ip}` : ""}
                </p>
              )}
            </Card>

            {doc.record && (
              <Card title="Registro de facturación" description="Sistema NO VERI*FACTU: huella SHA-256 encadenada">
                <dl className="flex flex-col gap-2 text-[12px]">
                  <div>
                    <dt className="text-muted">Huella</dt>
                    <dd className="font-mono break-all">{doc.record.hash}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Huella anterior</dt>
                    <dd className="font-mono break-all">{doc.record.prevHash || "Primera factura"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Generado</dt>
                    <dd className="font-mono">{doc.record.generatedAt}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">QR</dt>
                    <dd className="break-all">
                      <a href={doc.record.qrUrl} target="_blank" rel="noreferrer" className="underline">
                        {doc.record.qrUrl.replace(/^https:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                </dl>
              </Card>
            )}

            {events.length > 0 && (
              <Card title="Historial">
                <ul className="flex flex-col gap-2 text-[13px]">
                  {events.map((e, i) => (
                    <li key={i}>
                      <span className="text-muted">{new Date(e.at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span> · {e.type === "issue" ? "Emitida" : e.type === "accept" ? "Aceptado" : e.type === "send" ? "Enviado" : e.type === "paid" ? "Cobrada" : e.type === "create" ? "Creado" : e.type}
                      {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        )}
      </div>

      {confirm === "send" && (
        <Dialog
          title={`Marcar ${doc.type === "contract" ? "el contrato" : "la propuesta"} como enviado`}
          onClose={() => setConfirm(undefined)}
          busy={busy}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void act({ action: "send" })} disabled={busy}>
                {doc.missing.length ? "Enviar igualmente" : "Marcar como enviado"}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-fg-2">
            {doc.missing.length > 0 && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-warning">
                Faltan datos ({doc.missing.map(variableLabel).join(", ")}): el cliente verá [variable] en su lugar. Mejor complétalos antes.
              </p>
            )}
            <p>
              El texto y los datos de las partes quedan fijados.
              {doc.visibleToClient ? " Si el cliente tiene el portal activo, lo verá allí y podrá " + (doc.type === "contract" ? "firmarlo" : "aceptarla") + "." : ""} También puedes
              enviárselo en PDF (botón PDF).
            </p>
            <p>Si necesitas cambiarlo después, puedes volver a ponerlo en borrador mientras no esté aceptado.</p>
          </div>
        </Dialog>
      )}
      {confirm === "issue" && (
        <Dialog
          title="Emitir factura"
          onClose={() => setConfirm(undefined)}
          busy={busy}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void act({ action: "issue" })} disabled={busy}>
                Emitir {formatAmount(doc.totals.total, doc.currency)}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-fg-2">
            <p>
              Se le asignará el siguiente número de la serie y quedará registrada con su huella. <strong className="text-fg">Después no se podrá modificar ni borrar</strong>: si
              hay un error, se corrige con una factura rectificativa.
            </p>
            <p>Revisa antes la fecha ({longDate(doc.date)}), los datos del cliente y los importes.</p>
            {doc.missing.length > 0 && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-warning">Faltan datos en el texto ({doc.missing.map(variableLabel).join(", ")}): aparecerán como [variable].</p>
            )}
          </div>
        </Dialog>
      )}
      {confirm === "accept" && (
        <Dialog
          title={doc.type === "contract" ? "Marcar como firmado" : "Marcar como aceptada"}
          description="Para cuando el cliente lo acepta fuera del portal (email, en persona…)."
          onClose={() => setConfirm(undefined)}
          busy={busy}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void act({ action: "accept", name })} disabled={busy}>
                Confirmar
              </button>
            </>
          }
        >
          <Field label="Quién lo acepta">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={doc.customer?.tradeName ?? doc.customer?.name} autoFocus />
          </Field>
        </Dialog>
      )}
      {confirm === "paid" && (
        <Dialog
          title="Marcar como cobrada"
          onClose={() => setConfirm(undefined)}
          busy={busy}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void act({ action: "paid", date: paidDate, registerPayment: registerPayment && !!doc.projectId })} disabled={busy}>
                Marcar cobrada
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Fecha de cobro">
              <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </Field>
            {doc.projectId ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={registerPayment} onChange={(e) => setRegisterPayment(e.target.checked)} />
                <span>
                  Registrar el pago de {formatAmount(doc.totals.total, doc.currency)} en el proyecto {doc.projectName}
                  <span className="hint block">Así cuenta en Finanzas y en el portal. Desmárcalo si ya lo apuntaste.</span>
                </span>
              </label>
            ) : (
              <p className="hint">La factura no tiene proyecto: el pago no se añade a Finanzas automáticamente.</p>
            )}
          </div>
        </Dialog>
      )}
      {confirm === "delete" && (
        <Dialog
          title="Borrar borrador"
          onClose={() => setConfirm(undefined)}
          busy={busy}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn border-danger text-danger" onClick={() => void remove()} disabled={busy}>
                Borrar
              </button>
            </>
          }
        >
          <p className="text-sm text-fg-2">Se borrará &ldquo;{doc.renderedTitle}&rdquo;. No se puede deshacer.</p>
        </Dialog>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_TYPES, type DocTemplate, type DocType, type Document, type DocumentSettings } from "@/core/documents";
import { api, postJson, useData } from "../data/DataProvider";
import { Dialog, Field } from "../clients/Dialog";
import { LinesEditor, VariablePicker, fromDraft, insertAtCursor, toDraft, type LineDraft } from "./parts";

interface Option {
  id: string;
  name: string;
  clientId?: string;
}

/** Nuevo documento: tipo, cliente, proyecto y plantilla. Crea el borrador y abre el editor. */
export function NewDocumentDialog({ type: initialType, clientId: initialClient, projectId: initialProject, onClose }: { type?: DocType; clientId?: string; projectId?: string; onClose(): void }) {
  const router = useRouter();
  const [type, setType] = useState<DocType>(initialType ?? "proposal");
  const [clientId, setClientId] = useState(initialClient ?? "");
  const [projectId, setProjectId] = useState(initialProject ?? "");
  const [templateId, setTemplateId] = useState("");
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<{ clients: (Option & { archived?: boolean })[] }>("/api/clients")
      .then((r) => setClients(r.clients.filter((c) => !c.archived || c.id === initialClient)))
      .catch(() => setClients([]));
    api<Option[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
    api<DocTemplate[]>("/api/documents/templates")
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [initialClient]);

  const ofType = templates.filter((t) => t.type === type);
  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const template = ofType.find((t) => t.id === templateId) ?? ofType.find((t) => t.builtIn) ?? ofType[0];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const doc = await postJson<Document>("/api/documents", { type, clientId, projectId: projectId || undefined, templateId: template?.id });
      router.push(`/documentos/${doc.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Nuevo documento"
      description="Se rellena con los datos del cliente y del proyecto; podrás revisarlo antes de enviarlo."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="new-doc" disabled={busy || !clientId}>
            Crear borrador
          </button>
        </>
      }
    >
      <form id="new-doc" className="flex flex-col gap-4" onSubmit={create}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
          {DOC_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={type === t.id}
              className={`rounded-md px-2 py-1.5 text-sm font-medium ${type === t.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
              onClick={() => {
                setType(t.id);
                setTemplateId("");
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Cliente *">
          <select
            className="input"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId("");
            }}
          >
            <option value="">Elige un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Proyecto" hint="Sus datos (presupuesto, hitos, fechas) rellenan el documento">
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!clientProjects.length}>
            <option value="">{clientProjects.length ? "Sin proyecto" : clientId ? "El cliente no tiene proyectos" : "Elige antes el cliente"}</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plantilla">
          <select className="input" value={template?.id ?? ""} onChange={(e) => setTemplateId(e.target.value)}>
            {ofType.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.builtIn ? " (incluida)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Dialog>
  );
}

/** IVA, IRPF, vencimiento, IBAN y pie de factura por defecto. */
export function DocumentSettingsDialog({ onClose }: { onClose(): void }) {
  const { settings, patchSettings } = useData();
  const s: DocumentSettings = settings?.documents ?? {};
  const [d, setD] = useState({
    vat: String(s.vat ?? 21),
    irpf: s.irpf?.toString() ?? "",
    paymentDays: String(s.paymentDays ?? 30),
    iban: s.iban ?? "",
    invoiceFooter: s.invoiceFooter ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await patchSettings({ documents: { ...d, irpf: d.irpf || null } });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Ajustes de documentos"
      description="Tus datos (titular, NIF, domicilio) se toman de Ajustes → Portal del cliente → Datos legales."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="doc-settings" disabled={busy}>
            Guardar
          </button>
        </>
      }
    >
      <form id="doc-settings" className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-3">
            {error}
          </p>
        )}
        <Field label="IVA por defecto (%)">
          <input className="input" inputMode="decimal" value={d.vat} onChange={set("vat")} />
        </Field>
        <Field label="Retención IRPF (%)" hint="15 % general, 7 % nuevos autónomos; vacío si no aplica">
          <input className="input" inputMode="decimal" value={d.irpf} onChange={set("irpf")} placeholder="—" />
        </Field>
        <Field label="Vencimiento (días)">
          <input className="input" inputMode="numeric" value={d.paymentDays} onChange={set("paymentDays")} />
        </Field>
        <Field label="IBAN para cobrar" className="sm:col-span-3">
          <input className="input" value={d.iban} onChange={set("iban")} placeholder="ES00 0000 0000 0000 0000 0000" autoComplete="off" />
        </Field>
        <Field label="Pie de factura" hint="Opcional: condiciones de pago, inscripción registral, exenciones…" className="sm:col-span-3">
          <textarea className="input min-h-20 resize-y" value={d.invoiceFooter} onChange={set("invoiceFooter")} maxLength={1000} />
        </Field>
      </form>
    </Dialog>
  );
}

/** Crear o editar una plantilla (texto con variables y líneas por defecto). */
export function TemplateForm({ template, type: initialType, onClose, onSaved }: { template?: DocTemplate; type?: DocType; onClose(): void; onSaved(): void }) {
  const { settings } = useData();
  const [type, setType] = useState<DocType>(template?.type ?? initialType ?? "proposal");
  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [days, setDays] = useState(template?.days?.toString() ?? "");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>((template?.lines ?? []).map(toDraft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<"title" | "body">("body");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const data = { type, name, title, body, days: days || null, notes, lines: lines.map(fromDraft) };
      if (template) await postJson(`/api/documents/templates/${template.id}`, data, "PATCH");
      else await postJson("/api/documents/templates", data);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={template ? `Editar plantilla${template.builtIn ? " incluida" : ""}` : "Nueva plantilla"}
      description="Escribe en Markdown (## Título, **negrita**, - listas). Las {variables} se rellenan con los datos del cliente y del proyecto."
      onClose={onClose}
      busy={busy}
      width="max-w-3xl"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="template-form" disabled={busy || !name.trim()}>
            Guardar plantilla
          </button>
        </>
      }
    >
      <form id="template-form" className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-3">
            {error}
          </p>
        )}
        <Field label="Nombre *" className="sm:col-span-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Tipo">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as DocType)} disabled={Boolean(template)}>
            {DOC_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Título del documento" className="sm:col-span-2">
          <input ref={titleRef} className="input" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setFocus("title")} placeholder="Propuesta: {proyecto.nombre}" />
        </Field>
        <Field label={type === "invoice" ? "Vencimiento (días)" : type === "proposal" ? "Validez (días)" : "Días"}>
          <input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="—" />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="label">Texto</span>
            <VariablePicker
              onPick={(v) => (focus === "title" ? insertAtCursor(titleRef.current, v, title, setTitle) : insertAtCursor(bodyRef.current, v, body, setBody))}
            />
          </div>
          <textarea
            ref={bodyRef}
            className="input min-h-72 resize-y font-mono text-[13px] leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setFocus("body")}
            placeholder={type === "invoice" ? "Opcional: texto que aparece sobre las líneas de la factura." : "Hola {cliente.contacto}:\n\n## Qué haremos\n…"}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <span className="label">Líneas por defecto</span>
          <LinesEditor lines={lines} onChange={setLines} defaultVat={settings?.documents?.vat ?? 21} currency="EUR" />
          <span className="hint">Si no pones líneas y el proyecto tiene presupuesto, se añade una línea con él.</span>
        </div>
        <Field label="Notas al pie" className="sm:col-span-3">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
      </form>
    </Dialog>
  );
}

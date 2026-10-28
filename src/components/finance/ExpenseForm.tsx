"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { CHANNELS, EXPENSE_CATEGORIES, EXPENSE_TYPES, RECURRENCES, type Expense, type ExpenseType } from "@/core/finance";
import { api, postJson } from "../data/DataProvider";
import { Dialog, Field } from "../clients/Dialog";

interface Option {
  id: string;
  name: string;
  clientId?: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Crear o editar un gasto. */
export function ExpenseForm({
  expense,
  defaults,
  currency,
  onClose,
  onSaved,
}: {
  expense?: Expense;
  /** Valores iniciales al crear (p. ej. desde la ficha de un cliente). */
  defaults?: Partial<Pick<Expense, "type" | "clientId" | "projectId">>;
  currency: string;
  onClose(): void;
  onSaved(): void;
}) {
  const [d, setD] = useState({
    concept: expense?.concept ?? "",
    amount: expense?.amount?.toString() ?? "",
    date: expense?.date ?? "",
    type: (expense?.type ?? defaults?.type ?? "overhead") as ExpenseType,
    category: expense?.category ?? "",
    clientId: expense?.clientId ?? defaults?.clientId ?? "",
    projectId: expense?.projectId ?? defaults?.projectId ?? "",
    channel: expense?.channel ?? "",
    recurrence: expense?.recurrence ?? "",
    endDate: expense?.endDate ?? "",
    vendor: expense?.vendor ?? "",
    notes: expense?.notes ?? "",
  });
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<{ clients: Option[] }>("/api/clients")
      .then((r) => setClients(r.clients.map(({ id, name }) => ({ id, name }))))
      .catch(() => setClients([]));
    api<Option[]>("/api/projects")
      .then((list) => setProjects(list.map(({ id, name, clientId }) => ({ id, name, clientId }))))
      .catch(() => setProjects([]));
  }, []);

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value, ...(k === "clientId" ? { projectId: "" } : {}) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = {
        ...d,
        date: d.date || todayStr(),
        clientId: d.type === "direct" ? d.clientId : null,
        projectId: d.type === "direct" ? d.projectId || null : null,
        channel: d.type === "acquisition" ? d.channel : null,
        recurrence: d.recurrence || null,
        endDate: d.recurrence ? d.endDate || null : null,
      };
      if (expense) await postJson(`/api/expenses/${expense.id}`, body, "PATCH");
      else await postJson("/api/expenses", body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!expense) return;
    setBusy(true);
    try {
      await api(`/api/expenses/${expense.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const clientProjects = projects.filter((p) => p.clientId === d.clientId);
  const typeHint = EXPENSE_TYPES.find((t) => t.id === d.type)?.hint;

  return (
    <Dialog
      title={expense ? "Editar gasto" : "Nuevo gasto"}
      description={`Importes sin IVA, en ${currency}.`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {expense &&
            (confirmDelete ? (
              <button type="button" className="btn mr-auto border-danger text-danger" onClick={remove} disabled={busy}>
                Confirmar borrado
              </button>
            ) : (
              <button type="button" className="btn btn-ghost mr-auto text-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 className="size-4" aria-hidden /> Borrar
              </button>
            ))}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="expense-form" disabled={busy || !d.concept.trim() || !d.amount}>
            {expense ? "Guardar" : "Añadir gasto"}
          </button>
        </>
      }
    >
      <form id="expense-form" className="flex flex-col gap-4" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-1.5">¿A qué se imputa?</legend>
          <div role="radiogroup" aria-label="Tipo de gasto" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
            {EXPENSE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={d.type === t.id}
                className={`rounded-md px-2 py-1.5 text-sm font-medium ${d.type === t.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
                onClick={() => setD((x) => ({ ...x, type: t.id }))}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="hint">{typeHint}</p>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Concepto *" className="sm:col-span-2">
            <input className="input" value={d.concept} onChange={set("concept")} maxLength={200} placeholder="Figma, diseñador freelance, Google Ads…" autoFocus />
          </Field>
          <Field label="Importe *">
            <input className="input" inputMode="decimal" value={d.amount} onChange={set("amount")} placeholder="0" />
          </Field>
          <Field label={d.recurrence ? "Primer cargo" : "Fecha"} hint={d.date ? undefined : "Vacío: hoy"}>
            <input className="input" type="date" value={d.date} onChange={set("date")} />
          </Field>

          {d.type === "direct" && (
            <>
              <Field label="Cliente *">
                <select className="input" value={d.clientId} onChange={set("clientId")}>
                  <option value="">Elige un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Proyecto">
                <select className="input" value={d.projectId} onChange={set("projectId")} disabled={!clientProjects.length}>
                  <option value="">{clientProjects.length ? "Del cliente en general" : "Sin proyectos"}</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {d.type === "acquisition" && (
            <Field label="Canal *" hint="El mismo nombre que pones en el canal de tus clientes" className="sm:col-span-2">
              <input className="input" list="expense-channels" value={d.channel} onChange={set("channel")} maxLength={60} placeholder="Google Maps, Anuncios…" />
              <datalist id="expense-channels">
                {CHANNELS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          )}

          <Field label="Categoría">
            <select className="input" value={d.category} onChange={set("category")}>
              <option value="">Otros</option>
              {EXPENSE_CATEGORIES.filter((c) => c.id !== "other").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Se repite">
            <select className="input" value={d.recurrence} onChange={set("recurrence")}>
              <option value="">No, es un pago único</option>
              {RECURRENCES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          {d.recurrence && (
            <Field label="Último cargo" hint="Vacío: sigue activo" className="sm:col-span-2">
              <input className="input" type="date" value={d.endDate} onChange={set("endDate")} min={d.date || undefined} />
            </Field>
          )}
          <Field label="Proveedor">
            <input className="input" value={d.vendor} onChange={set("vendor")} maxLength={120} />
          </Field>
          <Field label="Notas">
            <input className="input" value={d.notes} onChange={set("notes")} maxLength={2000} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/core/clients";
import { CHANNELS, LEAD_CHANNEL } from "@/core/finance";
import type { SavedLead } from "@/core/lead";
import { api, postJson } from "../data/DataProvider";
import { LeadPicker, type LeadOption } from "../calendar/LeadPicker";
import { Dialog, Field } from "./Dialog";

type Draft = Pick<Client, "name" | "contactName" | "email" | "phone" | "website" | "address" | "notes" | "channel" | "category" | "taxId" | "legalName">;

const empty: Draft = { name: "", contactName: "", email: "", phone: "", website: "", address: "", notes: "", channel: "", category: "", taxId: "", legalName: "" };

/** Crear (a mano o desde un lead) o editar un cliente. */
export function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose(): void; onSaved(client: Client): void }) {
  const editing = Boolean(client);
  const [mode, setMode] = useState<"manual" | "lead">("manual");
  const [draft, setDraft] = useState<Draft>(client ? { ...empty, ...client } : empty);
  const [lead, setLead] = useState<LeadOption>();
  const [leads, setLeads] = useState<LeadOption[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (editing) return;
    api<SavedLead[]>("/api/leads")
      .then((list) => setLeads(list.map(({ id, name, category, address, stage }) => ({ id, name, category, address, stage }))))
      .catch(() => setLeads([]));
  }, [editing]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const saved =
        mode === "lead" && !editing
          ? await postJson<Client>("/api/clients", { fromLeadId: lead?.id })
          : editing
            ? await postJson<Client>(`/api/clients/${client!.id}`, draft, "PATCH")
            : await postJson<Client>("/api/clients", draft);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSave = mode === "lead" && !editing ? Boolean(lead) : Boolean(draft.name?.trim());

  return (
    <Dialog
      title={editing ? "Editar cliente" : "Nuevo cliente"}
      description={editing ? undefined : "Créalo a mano o conviértelo desde uno de tus leads."}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="client-form" disabled={busy || !canSave}>
            {editing ? "Guardar" : "Crear cliente"}
          </button>
        </>
      }
    >
      <form id="client-form" className="flex flex-col gap-4" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {!editing && (
          <div role="radiogroup" aria-label="Origen" className="flex gap-1 self-start rounded-lg border border-line bg-surface p-1">
            {(
              [
                ["manual", "A mano"],
                ["lead", "Desde un lead"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "lead" && !editing ? (
          <div className="flex flex-col gap-2">
            <LeadPicker leads={leads} value={lead} onChange={setLead} />
            <p className="hint">Se copian nombre, email, teléfono, web y dirección, y el lead pasa a tu última etapa (normalmente &ldquo;Clientes&rdquo;).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre del cliente o empresa *" className="sm:col-span-2">
              <input className="input" value={draft.name} onChange={set("name")} maxLength={200} required autoFocus />
            </Field>
            <Field label="Persona de contacto">
              <input className="input" value={draft.contactName ?? ""} onChange={set("contactName")} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={draft.email ?? ""} onChange={set("email")} />
            </Field>
            <Field label="Teléfono">
              <input className="input" type="tel" value={draft.phone ?? ""} onChange={set("phone")} />
            </Field>
            <Field label="Web">
              <input className="input" value={draft.website ?? ""} onChange={set("website")} placeholder="ejemplo.com" />
            </Field>
            <Field label="Dirección" className="sm:col-span-2" hint="Completa (calle, CP y ciudad): aparece en facturas y contratos">
              <input className="input" value={draft.address ?? ""} onChange={set("address")} />
            </Field>
            <Field label="NIF / CIF" hint="Necesario para emitirle facturas">
              <input className="input" value={draft.taxId ?? ""} onChange={set("taxId")} maxLength={30} autoComplete="off" />
            </Field>
            <Field label="Razón social" hint="Si es distinta del nombre">
              <input className="input" value={draft.legalName ?? ""} onChange={set("legalName")} maxLength={200} />
            </Field>
            <Field label="Canal de captación" hint="Para medir qué te trae clientes (Finanzas)">
              <input
                className="input"
                list="client-channels"
                value={draft.channel ?? ""}
                onChange={set("channel")}
                maxLength={60}
                placeholder={client?.leadId ? LEAD_CHANNEL : "Referido, Web…"}
              />
              <datalist id="client-channels">
                {CHANNELS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Sector" hint="Para ver qué tipo de cliente es más rentable">
              <input className="input" value={draft.category ?? ""} onChange={set("category")} maxLength={80} placeholder="Clínica, restaurante…" />
            </Field>
            <Field label="Notas" className="sm:col-span-2">
              <textarea className="input min-h-20 resize-y" value={draft.notes ?? ""} onChange={set("notes")} />
            </Field>
          </div>
        )}
      </form>
    </Dialog>
  );
}

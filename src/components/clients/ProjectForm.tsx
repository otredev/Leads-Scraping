"use client";

import { useState } from "react";
import { CURRENCIES, PROJECT_STATUSES, type Project } from "@/core/clients";
import { postJson } from "../data/DataProvider";
import { Dialog, Field } from "./Dialog";

/** Crear o editar los datos generales de un proyecto. */
export function ProjectForm({
  clientId,
  project,
  defaultCurrency = "EUR",
  onClose,
  onSaved,
}: {
  clientId: string;
  project?: Project;
  defaultCurrency?: string;
  onClose(): void;
  onSaved(p: Project): void;
}) {
  const [d, setD] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "active",
    startDate: project?.startDate ?? "",
    dueDate: project?.dueDate ?? "",
    currency: project?.currency ?? defaultCurrency,
    budget: project?.budget?.toString() ?? "",
    hourlyRate: project?.hourlyRate?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = { ...d, budget: d.budget || null, hourlyRate: d.hourlyRate || null, startDate: d.startDate || null, dueDate: d.dueDate || null };
      onSaved(
        project
          ? await postJson<Project>(`/api/projects/${project.id}`, body, "PATCH")
          : await postJson<Project>("/api/projects", { ...body, clientId }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={project ? "Editar proyecto" : "Nuevo proyecto"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="project-form" disabled={busy || !d.name.trim()}>
            {project ? "Guardar" : "Crear proyecto"}
          </button>
        </>
      }
    >
      <form id="project-form" className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <Field label="Nombre *" className="sm:col-span-2">
          <input className="input" value={d.name} onChange={set("name")} placeholder="Web corporativa, página Otrelink…" required autoFocus maxLength={200} />
        </Field>
        <Field label="Estado">
          <select className="input" value={d.status} onChange={set("status")}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moneda">
          <select className="input" value={d.currency} onChange={set("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Inicio">
          <input className="input" type="date" value={d.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="Entrega">
          <input className="input" type="date" value={d.dueDate} onChange={set("dueDate")} />
        </Field>
        <Field label="Presupuesto">
          <input className="input" inputMode="decimal" value={d.budget} onChange={set("budget")} placeholder="0" />
        </Field>
        <Field label="Precio por hora" hint="Opcional: calcula el coste de las horas">
          <input className="input" inputMode="decimal" value={d.hourlyRate} onChange={set("hourlyRate")} placeholder="0" />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className="input min-h-24 resize-y" value={d.description} onChange={set("description")} placeholder="Alcance, entregables, notas…" />
        </Field>
      </form>
    </Dialog>
  );
}

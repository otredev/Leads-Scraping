"use client";

import { useState } from "react";
import { CURRENCIES } from "@/core/clients";
import type { FinanceSettings } from "@/core/finance";
import { useData } from "../data/DataProvider";
import { Dialog, Field } from "../clients/Dialog";

/** Coste de tu hora y moneda de Finanzas. */
export function FinanceSettingsDialog({ current, currency, onClose, onSaved }: { current?: FinanceSettings; currency: string; onClose(): void; onSaved(): void }) {
  const { patchSettings } = useData();
  const [hourlyCost, setHourlyCost] = useState(current?.hourlyCost?.toString() ?? "");
  const [cur, setCur] = useState(current?.currency ?? currency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await patchSettings({ finance: { hourlyCost: hourlyCost || null, currency: cur } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Ajustes de finanzas"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="finance-settings" disabled={busy}>
            Guardar
          </button>
        </>
      }
    >
      <form id="finance-settings" className="flex flex-col gap-4" onSubmit={save}>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Field
          label="Coste de tu hora"
          hint="Lo que te cuesta una hora de tu trabajo (lo que querrías cobrar como sueldo, más tus gastos personales). Se resta del beneficio por cada hora registrada en los proyectos que la cuentan. Vacío: las horas no cuentan como coste."
        >
          <input className="input" inputMode="decimal" value={hourlyCost} onChange={(e) => setHourlyCost(e.target.value)} placeholder="25" autoFocus />
        </Field>
        <Field label="Moneda" hint="Los pagos de proyectos en otra moneda no se suman (se avisa en la página).">
          <select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </form>
    </Dialog>
  );
}

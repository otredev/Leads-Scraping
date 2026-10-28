"use client";

import { Braces, Plus, X } from "lucide-react";
import { VARIABLES, docTotals, formatAmount, statusLabel, type DocLine, type DocStatus, type DocType } from "@/core/documents";
import { Popover } from "../leads/Popover";

const TONE: Partial<Record<DocStatus, string>> = {
  draft: "bg-surface-2 text-muted",
  sent: "bg-primary-soft text-primary",
  issued: "bg-primary-soft text-primary",
  accepted: "bg-success-soft text-success",
  paid: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-surface-2 text-muted",
  rectified: "bg-warning-soft text-warning",
};

export function DocStatusBadge({ type, status, expired, overdue }: { type: DocType; status: DocStatus; expired?: boolean; overdue?: boolean }) {
  if (expired) return <span className="badge bg-warning-soft text-warning">Caducada</span>;
  if (overdue) return <span className="badge bg-danger-soft text-danger">Vencida</span>;
  return <span className={`badge ${TONE[status] ?? "bg-surface-2 text-fg-2"}`}>{statusLabel(type, status)}</span>;
}

/** Inserta {variable} en la posición del cursor de un textarea o input. */
export function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement | null, text: string, value: string, set: (v: string) => void) {
  if (!el) return set(value + text);
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  set(value.slice(0, start) + text + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  });
}

/** Botón "Variable" con la lista de datos que se rellenan solos. */
export function VariablePicker({ onPick }: { onPick(key: string): void }) {
  return (
    <Popover
      label={
        <>
          <Braces className="size-3.5" aria-hidden /> Variable
        </>
      }
      width="w-72"
      title="Insertar un dato del cliente, del proyecto o tuyo"
    >
      {(close) =>
        VARIABLES.map((g) => (
          <div key={g.group} className="flex flex-col">
            <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.group}</p>
            {g.items.map((v) => (
              <button
                key={v.key}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-2"
                onClick={() => {
                  onPick(`{${v.key}}`);
                  close();
                }}
              >
                <span>{v.label}</span>
                <code className="text-[11px] text-muted">{v.key}</code>
              </button>
            ))}
          </div>
        ))
      }
    </Popover>
  );
}

export interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  vat: string;
}

export const toDraft = (l: DocLine): LineDraft => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), vat: String(l.vat) });
const n = (s: string) => Number(String(s).replace(",", ".")) || 0;
export const fromDraft = (l: LineDraft): DocLine => ({ description: l.description.trim(), quantity: n(l.quantity), unitPrice: n(l.unitPrice), vat: n(l.vat) });

/** Tabla editable de líneas (concepto, cantidad, precio, IVA) con totales. */
export function LinesEditor({
  lines,
  onChange,
  defaultVat,
  irpf,
  currency,
}: {
  lines: LineDraft[];
  onChange(lines: LineDraft[]): void;
  defaultVat: number;
  irpf?: number;
  currency: string;
}) {
  const set = (i: number, k: keyof LineDraft, v: string) => onChange(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const t = docTotals({ lines: lines.filter((l) => l.description.trim() || n(l.unitPrice)).map(fromDraft), irpf });
  const money = (x: number) => formatAmount(x, currency);

  return (
    <div className="flex flex-col gap-2">
      {lines.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,1fr)_64px_96px_64px_32px] gap-2 px-0.5 text-[11px] font-medium text-muted sm:grid">
          <span>Concepto</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Precio</span>
          <span className="text-right">IVA %</span>
          <span />
        </div>
      )}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 sm:grid-cols-[minmax(0,1fr)_64px_96px_64px_32px]">
          <textarea
            rows={1}
            className="input col-span-4 min-h-9 resize-y py-1.5 sm:col-span-1"
            value={l.description}
            onChange={(e) => set(i, "description", e.target.value)}
            placeholder="Diseño web, mantenimiento…"
            aria-label={`Concepto de la línea ${i + 1}`}
          />
          <input className="input py-1.5 text-right" inputMode="decimal" value={l.quantity} onChange={(e) => set(i, "quantity", e.target.value)} aria-label="Cantidad" />
          <input className="input py-1.5 text-right" inputMode="decimal" value={l.unitPrice} onChange={(e) => set(i, "unitPrice", e.target.value)} aria-label="Precio unitario" />
          <input className="input py-1.5 text-right" inputMode="decimal" value={l.vat} onChange={(e) => set(i, "vat", e.target.value)} aria-label="IVA %" />
          <button type="button" className="btn btn-ghost btn-sm px-1.5" onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label={`Quitar línea ${i + 1}`}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" className="btn btn-sm" onClick={() => onChange([...lines, { description: "", quantity: "1", unitPrice: "", vat: String(defaultVat) }])}>
          <Plus className="size-3.5" aria-hidden /> Añadir línea
        </button>
        {lines.length > 0 && (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 text-[13px] tabular-nums">
            <dt className="text-muted">Base</dt>
            <dd className="text-right">{money(t.base)}</dd>
            <dt className="text-muted">IVA</dt>
            <dd className="text-right">{money(t.vatTotal)}</dd>
            {t.irpf !== 0 && (
              <>
                <dt className="text-muted">IRPF</dt>
                <dd className="text-right">−{money(t.irpf)}</dd>
              </>
            )}
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{money(t.total)}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}

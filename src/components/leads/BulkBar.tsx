"use client";

import { useState } from "react";
import { Ban, Bookmark, Palette, Tag as TagIcon, Trash2, X } from "lucide-react";
import type { CrmSettings, LeadUpdate, Tag } from "@/core/crm";
import { ColorDot, ColorPicker } from "./parts";
import { MenuItem, Popover } from "./Popover";
import type { LeadView } from "./useLeadView";

/** Crear una etiqueta nueva desde un menú. */
export function NewTagInput({ onCreate }: { onCreate(name: string): Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-1.5 border-t border-line pt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onCreate(name.trim());
          setName("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="input py-1.5" placeholder="Nueva etiqueta" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la nueva etiqueta" />
      <button className="btn btn-sm" disabled={busy || !name.trim()}>
        Crear
      </button>
    </form>
  );
}

/**
 * Barra de acciones masivas. Aparece al seleccionar filas.
 * En resultados: guardar. En leads: etapa, etiquetas, color, no contactar y papelera.
 */
export function BulkBar({
  view,
  settings,
  onSave,
  onUpdate,
  onTrash,
  onCreateTag,
}: {
  view: LeadView;
  settings?: CrmSettings;
  onSave?(ids: string[]): Promise<void>;
  onUpdate?(ids: string[], update: LeadUpdate): Promise<void>;
  onTrash?(ids: string[]): Promise<void>;
  onCreateTag?(name: string): Promise<Tag>;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const ids = [...view.selection];
  if (!ids.length) return null;

  const run = async (fn: () => Promise<void>, clear = false) => {
    setBusy(true);
    try {
      await fn();
      if (clear) view.clearSelection();
    } finally {
      setBusy(false);
    }
  };
  const update = (u: LeadUpdate) => onUpdate && run(() => onUpdate(ids, u));
  const allFiltered = view.rows.length > ids.length;

  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 sm:px-5 lg:top-0"
    >
      <span className="text-sm font-medium">
        {ids.length} {ids.length === 1 ? "seleccionado" : "seleccionados"}
      </span>
      {allFiltered && (
        <button className="text-[13px] text-fg-2 underline underline-offset-2" onClick={() => view.selectMany(view.rows.map((r) => r.id), true)}>
          Seleccionar los {view.rows.length} filtrados
        </button>
      )}
      <button className="btn btn-ghost btn-sm" onClick={view.clearSelection} aria-label="Quitar selección">
        <X className="size-4" aria-hidden />
      </button>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />

      {onSave && (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => onSave(ids), true)}>
          <Bookmark className="size-4" aria-hidden /> Guardar en Leads
        </button>
      )}

      {onUpdate && settings && (
        <>
          <Popover label="Cambiar etapa" align="left" disabled={busy} width="w-56">
            {(close) =>
              settings.stages.map((s) => (
                <MenuItem
                  key={s.id}
                  onClick={() => {
                    close();
                    void update({ stage: s.id });
                  }}
                >
                  <ColorDot color={s.color} /> {s.name}
                </MenuItem>
              ))
            }
          </Popover>
          <Popover
            align="left"
            disabled={busy}
            width="w-60"
            label={
              <>
                <TagIcon className="size-3.5" aria-hidden /> Etiquetas
              </>
            }
          >
            {(close) => (
              <>
                {settings.tags.length === 0 && <p className="hint px-1">Aún no hay etiquetas. Crea la primera:</p>}
                {settings.tags.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <span className="flex min-w-0 flex-1 items-center gap-2 px-1 text-sm">
                      <ColorDot color={t.color} /> <span className="truncate">{t.name}</span>
                    </span>
                    <button
                      className="btn btn-sm px-2"
                      onClick={() => {
                        close();
                        void update({ addTags: [t.id] });
                      }}
                    >
                      Añadir
                    </button>
                    <button
                      className="btn btn-ghost btn-sm px-2"
                      onClick={() => {
                        close();
                        void update({ removeTags: [t.id] });
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                {onCreateTag && (
                  <NewTagInput
                    onCreate={async (name) => {
                      const tag = await onCreateTag(name);
                      close();
                      await update({ addTags: [tag.id] });
                    }}
                  />
                )}
              </>
            )}
          </Popover>
          <Popover
            align="left"
            disabled={busy}
            width="w-auto"
            label={
              <>
                <Palette className="size-3.5" aria-hidden /> Color
              </>
            }
          >
            {(close) => (
              <ColorPicker
                allowNone
                label="Color de los leads seleccionados"
                onChange={(c) => {
                  close();
                  void update({ color: c });
                }}
              />
            )}
          </Popover>
          <Popover
            align="left"
            disabled={busy}
            width="w-72"
            label={
              <>
                <Ban className="size-3.5" aria-hidden /> No contactar
              </>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-2 p-1">
                <label className="label" htmlFor="dnc-reason">
                  Motivo (opcional)
                </label>
                <input
                  id="dnc-reason"
                  className="input"
                  placeholder="Pidió no ser contactado"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    close();
                    void update({ doNotContact: reason.trim() || true });
                    setReason("");
                  }}
                >
                  Marcar &ldquo;no contactar&rdquo;
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    close();
                    void update({ doNotContact: false });
                  }}
                >
                  Quitar la marca
                </button>
              </div>
            )}
          </Popover>
        </>
      )}

      {onTrash && (
        <button className="btn btn-sm text-danger" disabled={busy} onClick={() => run(() => onTrash(ids), true)}>
          <Trash2 className="size-3.5" aria-hidden /> Papelera
        </button>
      )}
    </div>
  );
}

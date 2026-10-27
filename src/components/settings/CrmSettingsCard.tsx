"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { LABEL_COLORS, type CrmSettings, type LabelColor } from "@/core/crm";
import { useData } from "../data/DataProvider";
import { ColorDot, ColorPicker } from "../leads/parts";
import { Popover } from "../leads/Popover";
import { Card, Notice } from "../ui";

interface Row {
  id?: string;
  name: string;
  color: LabelColor;
}

function ColorButton({ value, onChange }: { value: LabelColor; onChange(c: LabelColor): void }) {
  const name = LABEL_COLORS.find((c) => c.id === value)?.name;
  return (
    <Popover
      align="left"
      width="w-auto"
      buttonClassName="btn btn-ghost size-9 p-0"
      title={`Color: ${name}`}
      label={
        <>
          <ColorDot color={value} className="size-4" />
          <span className="sr-only">Color: {name}</span>
        </>
      }
    >
      {(close) => (
        <ColorPicker
          value={value}
          onChange={(c) => {
            if (c) onChange(c);
            close();
          }}
        />
      )}
    </Popover>
  );
}

/** Lista editable de nombre + color, con orden opcional. */
function RowsEditor({
  rows,
  setRows,
  ordered,
  noun,
  minRows = 0,
}: {
  rows: Row[];
  setRows(r: Row[]): void;
  ordered?: boolean;
  noun: string;
  minRows?: number;
}) {
  const edit = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <p className="hint">Aún no hay {noun}s.</p>}
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex items-center gap-1.5">
          <ColorButton value={r.color} onChange={(color) => edit(i, { color })} />
          <input className="input py-1.5" value={r.name} onChange={(e) => edit(i, { name: e.target.value })} aria-label={`Nombre de la ${noun}`} maxLength={40} />
          {ordered && (
            <>
              <button className="btn btn-ghost size-9 p-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${r.name}`}>
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button className="btn btn-ghost size-9 p-0" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${r.name}`}>
                <ArrowDown className="size-4" aria-hidden />
              </button>
            </>
          )}
          <button
            className="btn btn-ghost size-9 p-0 text-muted hover:text-danger"
            disabled={rows.length <= minRows}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            aria-label={`Borrar ${r.name || noun}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div>
        <button className="btn btn-sm" onClick={() => setRows([...rows, { name: "", color: "gray" }])}>
          <Plus className="size-3.5" aria-hidden /> Añadir {noun}
        </button>
      </div>
    </div>
  );
}

const same = (a: Row[], b: Row[]) => JSON.stringify(a) === JSON.stringify(b);

/** Ajustes del CRM: etapas, etiquetas y umbral de "valoración baja". */
export function CrmSettingsCard({ settings }: { settings: CrmSettings }) {
  const { patchSettings } = useData();
  const [stages, setStages] = useState<Row[]>(settings.stages);
  const [tags, setTags] = useState<Row[]>(settings.tags);
  const [moveTo, setMoveTo] = useState<string>("");
  const [low, setLow] = useState(String(settings.lowRating));
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>();

  const removedStages = settings.stages.filter((s) => !stages.some((r) => r.id === s.id));
  const removedTags = settings.tags.filter((t) => !tags.some((r) => r.id === t.id));

  async function save(key: string, body: unknown, done: string, after?: (s: CrmSettings) => void) {
    setBusy(key);
    setNotice(undefined);
    try {
      const next = await patchSettings(body);
      after?.(next);
      setNotice({ text: done });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Card title="Etapas y etiquetas" description="Cómo organizas tus leads guardados">
      <div className="flex flex-col gap-6">
        {notice && (
          <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
            {notice.text}
          </Notice>
        )}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Etapas</h3>
            <p className="hint">Son las columnas del tablero, en este orden. Los leads nuevos entran en &ldquo;Leads&rdquo; (o en la segunda etapa).</p>
            <RowsEditor rows={stages} setRows={setStages} ordered noun="etapa" minRows={1} />
            {removedStages.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
                <label className="label" htmlFor="move-to">
                  Los leads de {removedStages.map((s) => `"${s.name}"`).join(", ")} pasarán a:
                </label>
                <select id="move-to" className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">{stages.find((s) => s.id)?.name ?? "La primera etapa"}</option>
                  {stages
                    .filter((s) => s.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === "stages" || same(stages, settings.stages) || stages.some((s) => !s.name.trim())}
                onClick={() =>
                  save("stages", { stages, moveTo: moveTo || undefined }, "Etapas guardadas.", (s) => {
                    setStages(s.stages);
                    setMoveTo("");
                  })
                }
              >
                Guardar etapas
              </button>
              {!same(stages, settings.stages) && (
                <button className="btn btn-sm" onClick={() => setStages(settings.stages)}>
                  Descartar
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Etiquetas</h3>
            <p className="hint">También puedes crearlas al vuelo desde la ficha de un lead o la selección múltiple.</p>
            <RowsEditor rows={tags} setRows={setTags} noun="etiqueta" />
            {removedTags.length > 0 && (
              <p className="text-[13px] text-danger">
                Se quitarán de todos los leads: {removedTags.map((t) => t.name).join(", ")}.
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === "tags" || same(tags, settings.tags) || tags.some((t) => !t.name.trim())}
                onClick={() => save("tags", { tags }, "Etiquetas guardadas.", (s) => setTags(s.tags))}
              >
                Guardar etiquetas
              </button>
              {!same(tags, settings.tags) && (
                <button className="btn btn-sm" onClick={() => setTags(settings.tags)}>
                  Descartar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="low-rating">
              &ldquo;Valoración baja&rdquo; por debajo de
            </label>
            <input id="low-rating" className="input w-28" type="number" min={1} max={5} step={0.1} value={low} onChange={(e) => setLow(e.target.value)} />
          </div>
          <button
            className="btn btn-sm"
            disabled={busy === "low" || Number(low) === settings.lowRating}
            onClick={() => save("low", { lowRating: Number(low) }, "Umbral guardado.")}
          >
            Guardar
          </button>
          <p className="hint basis-full">
            Etiquetas automáticas: &ldquo;Sin web&rdquo;, &ldquo;Sin contacto&rdquo; (sin email ni teléfono) y &ldquo;Valoración baja&rdquo;. Se calculan
            solas y sirven para filtrar.
          </p>
        </div>
      </div>
    </Card>
  );
}

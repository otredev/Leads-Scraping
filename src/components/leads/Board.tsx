"use client";

import { useState } from "react";
import { Ban, MoreHorizontal, NotebookPen } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import type { CrmSettings, Stage } from "@/core/crm";
import { ColorDot, LeadTags, Reach, ScoreBar, labelVar } from "./parts";
import { MenuItem, Popover } from "./Popover";

const PER_COLUMN = 50;
const NONE: Stage = { id: "__none", name: "Sin etapa", color: "gray" };

/** Columnas por etapa. Arrastra una tarjeta para cambiarla de etapa (o usa su menú ⋯). */
export function Board({
  leads,
  settings,
  onMove,
  onOpen,
}: {
  leads: SavedLead[];
  settings: CrmSettings;
  onMove(id: string, stage: string): Promise<void>;
  onOpen(lead: SavedLead): void;
}) {
  const [over, setOver] = useState<string>();
  const [limit, setLimit] = useState<Record<string, number>>({});
  const known = new Set(settings.stages.map((s) => s.id));
  const orphans = leads.filter((l) => !known.has(l.stage));
  const columns = orphans.length ? [NONE, ...settings.stages] : settings.stages;

  return (
    <div className="overflow-x-auto p-4 sm:p-5">
      <div className="flex min-w-max gap-4">
        {columns.map((stage) => {
          const list = stage.id === NONE.id ? orphans : leads.filter((l) => l.stage === stage.id);
          const shown = list.slice(0, limit[stage.id] ?? PER_COLUMN);
          const droppable = stage.id !== NONE.id;
          return (
            <section
              key={stage.id}
              aria-label={`${stage.name}: ${list.length} leads`}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-surface-2 transition-colors ${
                over === stage.id ? "border-fg" : "border-line"
              }`}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((o) => (o === stage.id ? undefined : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(undefined);
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find((l) => l.id === id);
                if (droppable && lead && lead.stage !== stage.id) void onMove(id, stage.id);
              }}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <ColorDot color={stage.color} />
                <h3 className="text-sm font-semibold">{stage.name}</h3>
                <span className="ml-auto text-xs tabular-nums text-muted">{list.length}</span>
              </header>
              <ul className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                {shown.map((lead) => (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="group cursor-grab rounded-lg border border-line bg-surface p-3 shadow-card active:cursor-grabbing"
                    style={lead.color ? { boxShadow: `inset 3px 0 0 ${labelVar(lead.color)}` } : undefined}
                  >
                    <div className="flex items-start gap-2">
                      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(lead)}>
                        <span className="block truncate text-sm font-medium">{lead.name}</span>
                        <span className="block truncate text-xs text-muted">{lead.category ?? "Sin categoría"}</span>
                      </button>
                      <Popover
                        buttonClassName="btn btn-ghost size-7 p-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                        width="w-48"
                        label={<MoreHorizontal className="size-4" aria-label={`Opciones de ${lead.name}`} />}
                      >
                        {(close) => (
                          <>
                            <p className="px-2 text-xs font-medium text-muted">Mover a</p>
                            {settings.stages
                              .filter((s) => s.id !== lead.stage)
                              .map((s) => (
                                <MenuItem
                                  key={s.id}
                                  onClick={() => {
                                    close();
                                    void onMove(lead.id, s.id);
                                  }}
                                >
                                  <ColorDot color={s.color} /> {s.name}
                                </MenuItem>
                              ))}
                          </>
                        )}
                      </Popover>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Reach lead={lead} />
                      <ScoreBar lead={lead} />
                    </div>
                    {(lead.tags.length > 0 || lead.notes.length > 0 || lead.doNotContact) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {lead.doNotContact && (
                          <span className="inline-flex items-center gap-1 text-xs text-danger">
                            <Ban className="size-3" aria-hidden /> No contactar
                          </span>
                        )}
                        {lead.tags.length > 0 && <LeadTags lead={lead} settings={settings} showAuto={false} max={3} />}
                        {lead.notes.length > 0 && (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted" title={lead.notes[0].text}>
                            <NotebookPen className="size-3" aria-hidden /> {lead.notes.length}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">
                    {droppable ? "Arrastra leads aquí" : "Vacío"}
                  </li>
                )}
                {list.length > shown.length && (
                  <li>
                    <button
                      className="btn btn-ghost btn-sm w-full"
                      onClick={() => setLimit((l) => ({ ...l, [stage.id]: (l[stage.id] ?? PER_COLUMN) + PER_COLUMN }))}
                    >
                      Mostrar {Math.min(PER_COLUMN, list.length - shown.length)} más
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

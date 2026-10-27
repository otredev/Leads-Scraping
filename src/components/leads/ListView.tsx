"use client";

import { useState } from "react";
import { Ban, ChevronDown, NotebookPen } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import type { CrmSettings, Stage } from "@/core/crm";
import { ColorDot, LeadTags, ScoreBar, labelVar } from "./parts";
import type { LeadView } from "./useLeadView";

const PER_GROUP = 100;
const NONE: Stage = { id: "__none", name: "Sin etapa", color: "gray" };

/** Lista compacta agrupada por etapa. Mantiene el orden y la selección de la vista. */
export function ListView({
  view,
  leads,
  settings,
  onOpen,
}: {
  view: LeadView;
  leads: SavedLead[];
  settings: CrmSettings;
  onOpen(lead: SavedLead): void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState<Record<string, number>>({});
  const known = new Set(settings.stages.map((s) => s.id));
  const orphans = leads.filter((l) => !known.has(l.stage));
  const groups = orphans.length ? [NONE, ...settings.stages] : settings.stages;

  return (
    <div className="flex flex-col">
      {groups.map((stage) => {
        const list = stage.id === NONE.id ? orphans : leads.filter((l) => l.stage === stage.id);
        if (!list.length) return null;
        const isOpen = !collapsed.has(stage.id);
        const shown = list.slice(0, limit[stage.id] ?? PER_GROUP);
        const ids = list.map((l) => l.id);
        const selectedCount = ids.filter((id) => view.selection.has(id)).length;
        return (
          <section key={stage.id} className="border-b border-line last:border-0">
            <header className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selectedCount > 0 && selectedCount === ids.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedCount > 0 && selectedCount < ids.length;
                }}
                onChange={(e) => view.selectMany(ids, e.target.checked)}
                aria-label={`Seleccionar todos en ${stage.name}`}
              />
              <button
                className="flex flex-1 items-center gap-2 text-left text-sm font-semibold"
                onClick={() =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(stage.id)) n.delete(stage.id);
                    else n.add(stage.id);
                    return n;
                  })
                }
                aria-expanded={isOpen}
              >
                <ColorDot color={stage.color} />
                {stage.name}
                <span className="font-normal text-muted tabular-nums">{list.length}</span>
                <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden />
              </button>
            </header>
            {isOpen && (
              <ul>
                {shown.map((lead) => {
                  const selected = view.selection.has(lead.id);
                  return (
                    <li
                      key={lead.id}
                      className={`flex items-center gap-3 border-t border-line px-4 py-3 ${selected ? "bg-primary-soft/60" : "hover:bg-surface-2"}`}
                      style={lead.color ? { boxShadow: `inset 3px 0 0 ${labelVar(lead.color)}` } : undefined}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={selected}
                        onChange={() => view.toggle(lead.id)}
                        aria-label={`Seleccionar ${lead.name}`}
                      />
                      <button className="flex min-w-0 flex-1 flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-4" onClick={() => onOpen(lead)}>
                        <span className="min-w-0 sm:w-64 sm:shrink-0">
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {lead.name}
                            {lead.doNotContact && <Ban className="size-3.5 shrink-0 text-danger" aria-label="No contactar" />}
                          </span>
                          <span className="block truncate text-xs text-muted">{[lead.category, lead.phone].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <LeadTags lead={lead} settings={settings} max={3} />
                        </span>
                        {lead.notes[0] && (
                          <span className="hidden min-w-0 max-w-[260px] items-center gap-1.5 truncate text-xs text-muted lg:flex" title={lead.notes[0].text}>
                            <NotebookPen className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{lead.notes[0].text}</span>
                          </span>
                        )}
                      </button>
                      <ScoreBar lead={lead} />
                    </li>
                  );
                })}
                {list.length > shown.length && (
                  <li className="border-t border-line px-4 py-2">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLimit((l) => ({ ...l, [stage.id]: (l[stage.id] ?? PER_GROUP) + PER_GROUP }))}
                    >
                      Mostrar {Math.min(PER_GROUP, list.length - shown.length)} más
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

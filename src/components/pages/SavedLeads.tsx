"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Columns3 as BoardIcon, List, Table2 } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import { applyLeadUpdate, type CrmSettings, type LeadUpdate, type Tag } from "@/core/crm";
import { api, postJson, useData } from "../data/DataProvider";
import { Board } from "../leads/Board";
import { BulkBar } from "../leads/BulkBar";
import { LeadDrawer } from "../leads/LeadDrawer";
import { ListView } from "../leads/ListView";
import { LeadsTableView, NoMatches, TableSkeleton } from "../leads/Table";
import { LeadsToolbar } from "../leads/Toolbar";
import { useLeadView } from "../leads/useLeadView";
import { EmptyState, Notice, PageHeader } from "../ui";

type ViewMode = "table" | "list" | "board";
const VIEW_KEY = "leads-view";
const VIEWS: { id: ViewMode; label: string; Icon: typeof List }[] = [
  { id: "table", label: "Tabla", Icon: Table2 },
  { id: "list", label: "Lista", Icon: List },
  { id: "board", label: "Tablero", Icon: BoardIcon },
];

// Vista elegida: preferencia de este navegador (localStorage), sin parpadeo.
const viewListeners = new Set<() => void>();
function readView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" || v === "board" ? v : "table";
  } catch {
    return "table";
  }
}
function writeView(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* sin almacenamiento: solo en esta visita */
  }
  viewListeners.forEach((l) => l());
}
function useViewMode() {
  return useSyncExternalStore(
    (cb) => {
      viewListeners.add(cb);
      return () => viewListeners.delete(cb);
    },
    readView,
    () => "table" as ViewMode,
  );
}

/** Leads guardados: tu CRM, en tabla, lista o tablero. */
export function SavedLeads() {
  const { modules, settings, setSettings, refreshSaved } = useData();
  const [leads, setLeads] = useState<SavedLead[]>();
  const [notice, setNotice] = useState<{ text: React.ReactNode; tone?: "error" }>();
  const mode = useViewMode();

  const load = useCallback(
    () =>
      api<SavedLead[]>("/api/leads")
        .then(setLeads)
        .catch((e: Error) => {
          setLeads([]);
          setNotice({ text: e.message, tone: "error" });
        }),
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function trash(ids: string[]) {
    try {
      await postJson("/api/leads/trash", { ids });
      setLeads((list) => list?.filter((l) => !ids.includes(l.id)));
      void refreshSaved();
      const days = modules?.defaults.trashDays ?? 30;
      setNotice({
        text: (
          <>
            {ids.length === 1 ? "Movido" : `${ids.length} leads movidos`} a la papelera. Se eliminarán en {days} días.{" "}
            <button
              className="font-medium underline underline-offset-2"
              onClick={async () => {
                await postJson("/api/leads/restore", { ids });
                setNotice(undefined);
                void refreshSaved();
                await load();
              }}
            >
              Deshacer
            </button>
          </>
        ),
      });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    }
  }

  /** Cambios masivos con actualización optimista. */
  async function update(ids: string[], u: LeadUpdate) {
    const now = new Date().toISOString();
    const set = new Set(ids);
    setLeads((list) => list?.map((l) => (set.has(l.id) ? applyLeadUpdate(l, u, now, () => crypto.randomUUID()) : l)));
    try {
      await postJson("/api/leads", { ids, update: u }, "PATCH");
      if (u.doNotContact !== undefined) void refreshSaved();
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
      await load();
    }
  }

  async function createTag(name: string): Promise<Tag> {
    const r = await postJson<{ tag: Tag; settings: CrmSettings }>("/api/settings/tags", { name });
    setSettings(r.settings);
    return r.tag;
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Los negocios que has guardado. Organízalos por etapa, etiqueta y color, y añade notas."
        actions={
          <div role="radiogroup" aria-label="Vista" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="radio"
                aria-checked={mode === id}
                onClick={() => writeView(id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        }
      />
      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Notice>
      )}
      {settings && leads ? (
        <LeadsBody
          leads={leads}
          settings={settings}
          mode={mode}
          onUpdate={update}
          onTrash={trash}
          onCreateTag={createTag}
          onChangeOne={(lead) => setLeads((list) => list?.map((l) => (l.id === lead.id ? lead : l)))}
          onDncChange={() => void refreshSaved()}
        />
      ) : (
        <section className="card">
          <TableSkeleton />
        </section>
      )}
    </>
  );
}

function LeadsBody({
  leads,
  settings,
  mode,
  onUpdate,
  onTrash,
  onCreateTag,
  onChangeOne,
  onDncChange,
}: {
  leads: SavedLead[];
  settings: CrmSettings;
  mode: ViewMode;
  onUpdate(ids: string[], u: LeadUpdate): Promise<void>;
  onTrash(ids: string[]): Promise<void>;
  onCreateTag(name: string): Promise<Tag>;
  onChangeOne(lead: SavedLead): void;
  onDncChange(): void;
}) {
  const { modules, patchSettings } = useData();
  const view = useLeadView("saved", leads, settings);
  const [openId, setOpenId] = useState<string>();
  const open = leads.find((l) => l.id === openId);
  const rows = view.rows as SavedLead[];

  const empty =
    leads.length === 0 ? (
      <EmptyState
        title="Aún no has guardado ningún lead"
        action={
          <Link href="/resultados" className="btn btn-primary">
            Ir a resultados
          </Link>
        }
      >
        En Resultados, guarda una fila con el icono de marcador o todos los visibles con &ldquo;Guardar visibles&rdquo;.
      </EmptyState>
    ) : (
      <NoMatches onClear={view.clearFilters} />
    );

  return (
    <>
      <section className="card" aria-label="Leads guardados">
        <LeadsToolbar
          view={view}
          leads={leads}
          settings={settings}
          exporters={modules?.exporters ?? []}
          onColumnsChange={(columns) => {
            view.setColumns(columns);
            void patchSettings({ table: "saved", prefs: { ...view.defaults, columns } });
          }}
          onSaveDefaults={async () => {
            await patchSettings({ table: "saved", prefs: { filters: view.filters, sort: view.sort, columns: view.columns } });
          }}
        />
        {mode !== "board" && (
          <BulkBar
            view={view}
            settings={settings}
            onUpdate={async (ids, u) => {
              await onUpdate(ids, u);
              if (u.doNotContact !== undefined) onDncChange();
            }}
            onTrash={onTrash}
            onCreateTag={onCreateTag}
          />
        )}
        {mode === "table" && (
          <LeadsTableView view={view} loading={false} settings={settings} onTrash={onTrash} onOpen={(l) => setOpenId(l.id)} empty={empty} />
        )}
        {mode === "list" && (rows.length ? <ListView view={view} leads={rows} settings={settings} onOpen={(l) => setOpenId(l.id)} /> : <div className="p-5">{empty}</div>)}
        {mode === "board" &&
          (leads.length ? (
            <Board leads={rows} settings={settings} onMove={(id, stage) => onUpdate([id], { stage })} onOpen={(l) => setOpenId(l.id)} />
          ) : (
            <div className="p-5">{empty}</div>
          ))}
      </section>

      {open && (
        <LeadDrawer
          key={open.id}
          initial={open}
          settings={settings}
          onClose={() => setOpenId(undefined)}
          onChange={(lead) => {
            onChangeOne(lead);
            if (Boolean(lead.doNotContact) !== Boolean(open.doNotContact)) onDncChange();
          }}
          onTrash={async (id) => {
            setOpenId(undefined);
            await onTrash([id]);
          }}
          onCreateTag={onCreateTag}
        />
      )}
    </>
  );
}

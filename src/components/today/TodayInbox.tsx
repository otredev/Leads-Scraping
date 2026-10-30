"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock, EyeOff, Trash2, FileSignature, FileText, MessageSquare, PartyPopper, Receipt, Undo2, X } from "lucide-react";
import { taskBucket } from "@/core/calendar";
import { formatAmount } from "@/core/documents";
import { dismissState, inboxKey, isDismissed, type DismissState, type InboxInvoice, type InboxMessage, type InboxProposal, type TodayInbox as Inbox } from "@/core/today";
import { api, postJson, useData, type TaskView } from "../data/DataProvider";
import { MenuItem, Popover } from "../leads/Popover";
import { TaskRow } from "../tasks/TaskParts";
import { Card, ListSkeleton, timeAgo } from "../ui";

/**
 * Bandeja "Hoy": en una sola lista, lo que pide atención para empezar el día.
 * Primero lo vencido, luego lo de hoy y al final lo que espera respuesta.
 */

type Kind = "task" | "message" | "invoice" | "proposal";
type Group = "late" | "today" | "waiting";

type Entry =
  | { kind: "task"; key: string; group: Group; sort: string; task: TaskView }
  | { kind: "message"; key: string; group: Group; sort: string; item: InboxMessage }
  | { kind: "invoice"; key: string; group: Group; sort: string; item: InboxInvoice }
  | { kind: "proposal"; key: string; group: Group; sort: string; item: InboxProposal };

const GROUPS: { id: Group; label: string }[] = [
  { id: "late", label: "Vencido" },
  { id: "today", label: "Para hoy" },
  { id: "waiting", label: "Esperando respuesta" },
];

const FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "task", label: "Tareas" },
  { id: "message", label: "Mensajes" },
  { id: "invoice", label: "Facturas" },
  { id: "proposal", label: "Propuestas" },
];

/** Cuántas filas se ven antes de "Ver todo". */
const VISIBLE = 8;

const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

export function TodayInbox() {
  const { tasks } = useData();
  const [inbox, setInbox] = useState<Inbox>();
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(
    () =>
      api<Inbox>("/api/today")
        .then((r) => {
          setInbox(r);
          setError(undefined);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(load);
    // Se refresca sola cada minuto y cuando respondes un mensaje.
    const t = setInterval(load, 60_000);
    window.addEventListener("messages:changed", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("messages:changed", load);
    };
  }, [load]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const t of tasks) {
      const bucket = taskBucket(t);
      if (bucket === "overdue" || bucket === "today") out.push({ kind: "task", key: inboxKey.task(t), group: bucket === "overdue" ? "late" : "today", sort: t.dueAt ?? "", task: t });
    }
    for (const i of inbox?.invoices ?? []) out.push({ kind: "invoice", key: inboxKey.invoice(i), group: i.daysLate > 0 ? "late" : "today", sort: i.dueDate, item: i });
    for (const m of inbox?.messages ?? []) out.push({ kind: "message", key: inboxKey.message(m), group: "waiting", sort: m.since, item: m });
    for (const p of inbox?.proposals ?? []) out.push({ kind: "proposal", key: inboxKey.proposal(p), group: "waiting", sort: p.sentAt, item: p });
    const order: Record<Group, number> = { late: 0, today: 1, waiting: 2 };
    return out.sort((a, b) => order[a.group] - order[b.group] || a.sort.localeCompare(b.sort));
  }, [tasks, inbox]);

  // Lo que quitaste (hasta mañana o hasta que cambie) no se ve, salvo que pidas ver los ocultos.
  // Cambios hechos aquí que aún no han vuelto del servidor (si no, manda lo que trae la bandeja).
  const [pending, setPending] = useState<Inbox["dismissed"]>();
  const dismissed = pending ?? inbox?.dismissed ?? {};
  const setDismissed = (fn: Inbox["dismissed"] | ((d: Inbox["dismissed"]) => Inbox["dismissed"])) =>
    setPending((cur) => (typeof fn === "function" ? fn(cur ?? inbox?.dismissed ?? {}) : fn));
  const [showHidden, setShowHidden] = useState(false);
  const [undo, setUndo] = useState<{ key: string; label: string }>();
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(undefined), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const today = inbox?.today ?? "";
  // Los eliminados no salen en "ocultos" (vuelven solos si cambia algo).
  const hidden = entries.filter((e) => {
    const state = dismissState(e.key, dismissed, today);
    return state === "tomorrow" || state === "always";
  });
  const active = entries.filter((e) => !isDismissed(e.key, dismissed, today));

  async function change(entry: Entry, action: "dismiss" | "restore", until?: DismissState) {
    const previous = dismissed;
    // Al momento en pantalla; si falla, se deshace.
    setDismissed((d) => {
      const next = { ...d };
      delete next[entry.key];
      if (action === "dismiss") next[entry.key] = until === "tomorrow" || !until ? "9999-12-31" : until;
      return next;
    });
    if (action === "dismiss") setUndo({ key: entry.key, label: DISMISS_LABEL[until ?? "tomorrow"].done });
    else setUndo(undefined);
    try {
      const r = await postJson<{ dismissed: Inbox["dismissed"] }>("/api/today", { action, key: entry.key, until });
      setInbox((cur) => (cur ? { ...cur, dismissed: r.dismissed } : cur));
      setPending(undefined);
    } catch (err) {
      setPending(previous);
      setError((err as Error).message);
    }
  }

  const counts = useMemo(() => {
    const c: Record<Kind | "all", number> = { all: active.length, task: 0, message: 0, invoice: 0, proposal: 0 };
    for (const e of active) c[e.kind]++;
    return c;
  }, [active]);

  const shown = active.filter((e) => filter === "all" || e.kind === filter);
  const visible = expanded ? shown : shown.slice(0, VISIBLE);
  const late = active.filter((e) => e.group === "late").length;
  const undoEntry = undo && entries.find((e) => e.key === undo.key);

  return (
    <Card
      title="Hoy"
      description={
        !inbox
          ? "Lo que pide tu atención"
          : active.length === 0
            ? "Todo al día"
            : `${active.length} ${active.length === 1 ? "cosa pendiente" : "cosas pendientes"}${late ? ` · ${late} ${late === 1 ? "vencida" : "vencidas"}` : ""}`
      }
    >
      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
      {!inbox ? (
        <ListSkeleton rows={4} />
      ) : active.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-4">
          <PartyPopper className="size-5 shrink-0 text-muted" aria-hidden />
          <p className="text-[13.5px] text-fg-2">
            Nada vencido ni pendiente de respuesta. Puedes dedicar el día a <Link href="/busquedas" className="font-medium text-fg underline underline-offset-2">buscar leads nuevos</Link>.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div role="tablist" aria-label="Filtrar" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setExpanded(false);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  filter === f.id ? "border-primary bg-primary text-primary-fg" : "border-line text-fg-2 hover:bg-surface-2"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${filter === f.id ? "opacity-80" : "text-muted"}`}>{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <ul className="-mx-1">
            {visible.map((e, i) => {
              const header = i === 0 || visible[i - 1].group !== e.group;
              return (
                <li key={e.key} className="list-none">
                  {header && (
                    <p className={`px-1 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase first:pt-0 ${e.group === "late" ? "text-danger" : "text-muted"}`}>
                      {GROUPS.find((g) => g.id === e.group)!.label}
                    </p>
                  )}
                  <div className={`flex items-center gap-1 ${header ? "" : "border-t border-line"}`}>
                    <ul className="min-w-0 flex-1">{e.kind === "task" ? <TaskRow task={e.task} /> : <InboxRow entry={e} />}</ul>
                    <DismissMenu onPick={(until) => void change(e, "dismiss", until)} />
                  </div>
                </li>
              );
            })}
          </ul>

          {shown.length > VISIBLE && (
            <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ver menos" : `Ver todo (${shown.length})`}
            </button>
          )}
        </div>
      )}

      {inbox && undoEntry && (
        <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
          <span className="text-fg-2">{undo!.label}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void change(undoEntry, "restore")}>
            <Undo2 className="size-3.5" aria-hidden /> Deshacer
          </button>
        </div>
      )}

      {inbox && hidden.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button type="button" className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-fg" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden}>
            <EyeOff className="size-3.5" aria-hidden />
            {hidden.length} {hidden.length === 1 ? "oculto" : "ocultos"} · {showHidden ? "Esconder" : "Mostrar"}
          </button>
          {showHidden && (
            <ul className="mt-2 flex flex-col">
              {hidden.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px] first:border-0">
                  <span className="min-w-0 truncate text-fg-2">{entryLabel(e)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[11.5px] text-muted">{DISMISS_LABEL[dismissState(e.key, dismissed, today) ?? "tomorrow"].state}</span>
                    <button type="button" className="btn btn-sm" onClick={() => void change(e, "restore")}>
                      Volver a mostrar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/** Texto corto de un elemento (para la lista de ocultos). */
function entryLabel(e: Entry) {
  switch (e.kind) {
    case "task":
      return `Tarea: ${e.task.title}`;
    case "message":
      return `Mensajes de ${e.item.clientName}`;
    case "invoice":
      return `Factura ${e.item.number} · ${e.item.clientName}`;
    case "proposal":
      return `${e.item.type === "contract" ? "Contrato" : "Propuesta"}: ${e.item.title} · ${e.item.clientName}`;
  }
}

/** Botón para quitar un elemento de la bandeja. */
const DISMISS_LABEL: Record<DismissState, { done: string; state: string }> = {
  tomorrow: { done: "Oculto hasta mañana", state: "Hasta mañana" },
  always: { done: "Quitado de Hoy", state: "Quitado" },
  deleted: { done: "Eliminado de Hoy", state: "Eliminado" },
};

function DismissMenu({ onPick }: { onPick(until: DismissState): void }) {
  return (
    <Popover
      buttonClassName="btn btn-ghost size-7 shrink-0 p-0 text-muted hover:text-fg"
      width="w-64"
      title="Quitar de Hoy"
      label={<X className="size-4" aria-label="Quitar de Hoy" />}
    >
      {(close) => (
        <>
          <MenuItem
            onClick={() => {
              close();
              onPick("tomorrow");
            }}
          >
            <Clock className="size-4" aria-hidden /> Ocultar hasta mañana
          </MenuItem>
          <MenuItem
            onClick={() => {
              close();
              onPick("always");
            }}
          >
            <X className="size-4" aria-hidden />
            <span>
              Quitar de la lista
              <span className="block text-[11.5px] text-muted">Queda en ocultos; vuelve si hay algo nuevo</span>
            </span>
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              close();
              onPick("deleted");
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            <span>
              Eliminar de la lista
              <span className="block text-[11.5px] text-muted">Desaparece del todo; vuelve solo si hay algo nuevo</span>
            </span>
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function InboxRow({ entry }: { entry: Exclude<Entry, { kind: "task" }> }) {
  const view =
    entry.kind === "message"
      ? {
          href: `/mensajes?cliente=${entry.item.clientId}`,
          Icon: MessageSquare,
          title: entry.item.clientName,
          detail: `“${entry.item.preview}”`,
          meta: `${entry.item.count > 1 ? `${entry.item.count} mensajes · ` : ""}${timeAgo(entry.item.since)}`,
          tone: entry.item.unread ? "fg" : "muted",
          badge: entry.item.unread ? "Sin leer" : "Sin responder",
        }
      : entry.kind === "invoice"
        ? {
            href: `/documentos/${entry.item.id}`,
            Icon: Receipt,
            title: `Factura ${entry.item.number} · ${entry.item.clientName}`,
            detail: entry.item.daysLate > 0 ? `Vencida hace ${days(entry.item.daysLate)} · sin cobrar` : "Vence hoy · sin cobrar",
            meta: formatAmount(entry.item.total, entry.item.currency),
            tone: entry.item.daysLate > 0 ? "danger" : "fg",
            badge: undefined,
          }
        : {
            href: `/documentos/${entry.item.id}`,
            Icon: entry.item.type === "contract" ? FileSignature : FileText,
            title: `${entry.item.type === "contract" ? "Contrato sin firmar" : "Propuesta sin respuesta"} · ${entry.item.clientName}`,
            detail: `${entry.item.title}${entry.item.daysWaiting ? ` · enviada hace ${days(entry.item.daysWaiting)}` : " · enviada hoy"}`,
            meta: entry.item.total ? formatAmount(entry.item.total, entry.item.currency) : "",
            tone: "fg",
            badge: entry.item.expired ? "Validez vencida" : undefined,
          };
  const { Icon } = view;
  return (
    <li>
      <Link href={view.href} className="group flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-surface-2">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg ${view.tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg-2 group-hover:bg-surface"}`}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-fg">{view.title}</span>
            {view.badge && <span className="badge shrink-0 bg-warning-soft text-warning">{view.badge}</span>}
          </span>
          <span className={`block truncate text-xs ${view.tone === "danger" ? "font-medium text-danger" : "text-muted"}`}>{view.detail}</span>
          {/* En el móvil, el importe o la fecha van debajo para dejar sitio al nombre. */}
          {view.meta && <span className="block text-[12px] text-muted tabular-nums sm:hidden">{view.meta}</span>}
        </span>
        {view.meta && <span className="hidden shrink-0 text-right text-[12.5px] whitespace-nowrap text-muted tabular-nums sm:block">{view.meta}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </Link>
    </li>
  );
}

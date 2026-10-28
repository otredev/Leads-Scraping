"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, ExternalLink, Lock, MessageSquare, Search, Send, ShieldCheck, ShieldQuestion, Trash2 } from "lucide-react";
import type { Conversation, Message, PortalConsent } from "@/core/messages";
import { api, postJson } from "../data/DataProvider";
import { Card, EmptyState, ListSkeleton, Notice, PageHeader, Skeleton, timeAgo } from "../ui";

interface Thread {
  client: { id: string; name: string; contactName?: string; portalEnabled: boolean; consents: PortalConsent[]; messagesSeenAt?: string };
  projects: { id: string; name: string }[];
  messages: Message[];
}

const timeFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Mensajes con tus clientes (desde su portal) y notas internas. */
export function Messages() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("cliente") ?? undefined;
  const [list, setList] = useState<{ conversations: Conversation[]; unread: number; syncError?: string }>();
  const [thread, setThread] = useState<Thread>();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string>();

  const loadList = useCallback(
    () =>
      api<{ conversations: Conversation[]; unread: number; syncError?: string }>("/api/messages")
        .then(setList)
        .catch((e: Error) => setError(e.message)),
    [],
  );
  const loadThread = useCallback(async (id: string, markRead = true) => {
    try {
      const t = await api<Thread>(`/api/messages/${id}`);
      setThread(t);
      if (markRead && t.messages.some((m) => m.author === "client" && !m.readAt)) {
        await postJson(`/api/messages/${id}`, { read: true }, "PATCH");
        window.dispatchEvent(new Event("messages:changed"));
        void loadList();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadList]);

  useEffect(() => {
    void Promise.resolve().then(loadList);
    // Mientras la página está abierta, busca mensajes nuevos cada 20 s.
    const t = setInterval(() => void loadList(), 20_000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    void Promise.resolve().then(() => loadThread(selected));
    const t = setInterval(() => void loadThread(selected), 20_000);
    return () => clearInterval(t);
  }, [selected, loadThread]);

  const open = (id?: string) => router.replace(id ? `${pathname}?cliente=${id}` : pathname, { scroll: false });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list?.conversations ?? []).filter((c) => !s || c.clientName.toLowerCase().includes(s));
  }, [list, q]);

  return (
    <>
      <PageHeader title="Mensajes" description="Lo que te escriben tus clientes desde su portal, tus respuestas y tus notas internas." />
      {(error || list?.syncError) && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error ?? `No se pudieron traer los mensajes nuevos del portal: ${list?.syncError}`}
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card bodyClassName="p-0" className={selected ? "hidden lg:flex" : ""}>
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input className="input pl-9" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar conversación" />
            </div>
          </div>
          {!list ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <p className="hint p-4">{list.conversations.length ? "Ningún cliente coincide." : "Aún no hay conversaciones. Activa el portal de un cliente para que pueda escribirte."}</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {rows.map((c) => (
                <li key={c.clientId}>
                  <button
                    type="button"
                    onClick={() => open(c.clientId)}
                    aria-current={selected === c.clientId ? "true" : undefined}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 ${selected === c.clientId ? "bg-surface-2" : ""}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden>
                      {c.clientName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.clientName}</span>
                        {c.last && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.last.createdAt)}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[13px] ${c.unread ? "text-fg" : "text-muted"}`}>
                          {c.last ? `${c.last.author === "client" ? "" : c.last.author === "note" ? "Nota: " : "Tú: "}${c.last.body}` : "Sin mensajes"}
                        </span>
                        {c.unread > 0 && <span className="badge ml-auto shrink-0 bg-primary text-primary-fg">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className={selected ? "" : "hidden lg:block"}>
          {!selected ? (
            <Card>
              <EmptyState title="Elige una conversación">Tus clientes te escriben desde su portal. Aquí respondes y también puedes dejar notas internas que solo ves tú.</EmptyState>
            </Card>
          ) : !thread || thread.client.id !== selected ? (
            <Card>
              <Skeleton className="h-96 w-full" />
            </Card>
          ) : (
            <ThreadView
              thread={thread}
              onBack={() => open(undefined)}
              onSent={() => {
                void loadThread(selected, false);
                void loadList();
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ConsentBadge({ consents, portalEnabled }: { consents: PortalConsent[]; portalEnabled: boolean }) {
  if (!portalEnabled) return null;
  const last = consents.at(-1);
  return last ? (
    <span className="badge bg-success-soft text-success" aria-label="Condiciones aceptadas" title={`${last.name} · ${new Date(last.at).toLocaleString("es")}${last.ip ? ` · IP ${last.ip}` : ""}`}>
      <ShieldCheck className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Condiciones aceptadas</span>
    </span>
  ) : (
    <span className="badge bg-warning-soft text-warning" aria-label="Aún no ha aceptado las condiciones" title="Las verá la primera vez que abra el portal">
      <ShieldQuestion className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Aún no ha aceptado las condiciones</span>
    </span>
  );
}

function ThreadView({ thread, onBack, onSent }: { thread: Thread; onBack(): void; onSent(): void }) {
  const { client, messages, projects } = thread;
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState("");
  const [internal, setInternal] = useState(!client.portalEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  const lastAdmin = [...messages].reverse().find((m) => m.author === "admin");
  const seen = lastAdmin && client.messagesSeenAt && client.messagesSeenAt >= lastAdmin.createdAt;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await postJson(`/api/messages/${client.id}`, { body, projectId: projectId || undefined, internal });
      window.dispatchEvent(new Event("messages:changed"));
      setBody("");
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(id: string) {
    try {
      await api(`/api/messages/${client.id}?id=${id}`, { method: "DELETE" });
      onSent();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card flex min-h-[70vh] flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <button type="button" className="btn btn-ghost btn-sm px-1.5 lg:hidden" onClick={onBack} aria-label="Volver a las conversaciones">
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{client.name}</h2>
          <p className="truncate text-xs text-muted">{client.portalEnabled ? (client.contactName ? `Contacto: ${client.contactName}` : "Portal activo") : "Sin portal: solo notas internas"}</p>
        </div>
        <ConsentBadge consents={client.consents} portalEnabled={client.portalEnabled} />
        <Link href={`/clientes/${client.id}`} className="btn btn-sm">
          <ExternalLink className="size-3.5" aria-hidden /> Ficha
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {messages.length === 0 ? (
          <p className="hint py-10 text-center">
            {client.portalEnabled ? "Todavía no hay mensajes. Escribe el primero: le aparecerá en su portal." : "Activa su portal en la ficha del cliente para poder escribirle. Mientras, puedes guardar notas internas."}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.author !== "client";
              const note = m.author === "note";
              return (
                <li key={m.id} className={`group flex max-w-[85%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    {note && <Lock className="size-3" aria-hidden />}
                    {m.author === "client" ? client.name : note ? "Nota interna" : "Tú"} · {timeFmt.format(new Date(m.createdAt))}
                    {m.projectName ? ` · ${m.projectName}` : ""}
                    {note && (
                      <button type="button" className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100" onClick={() => void removeNote(m.id)} aria-label="Borrar nota">
                        <Trash2 className="size-3" aria-hidden />
                      </button>
                    )}
                  </span>
                  <p
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      note
                        ? "border border-dashed border-warning/60 bg-warning-soft text-fg"
                        : mine
                          ? "rounded-br-md bg-primary text-primary-fg"
                          : "rounded-bl-md bg-surface-2 text-fg"
                    }`}
                  >
                    {m.body}
                  </p>
                  {m.id === lastAdmin?.id && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      {seen ? <CheckCheck className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                      {seen ? `Visto ${timeAgo(client.messagesSeenAt!)}` : "Enviado"}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:px-5">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <textarea
          className={`input min-h-20 resize-y ${internal ? "border-dashed bg-warning-soft/40" : ""}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder={internal ? "Nota interna: solo la ves tú…" : `Escribe a ${client.contactName ?? client.name}…`}
          aria-label={internal ? "Nota interna" : "Mensaje"}
          maxLength={8000}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className={`flex items-center gap-2 text-[13px] ${client.portalEnabled ? "text-fg-2" : "text-muted"}`}>
            <input type="checkbox" className="size-4 accent-primary" checked={internal} onChange={(e) => setInternal(e.target.checked)} disabled={!client.portalEnabled} />
            <Lock className="size-3.5" aria-hidden /> Nota interna
          </label>
          {projects.length > 0 && (
            <select className="input w-auto py-1.5 text-[13px]" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyecto">
              <option value="">General</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <span className="hint ml-auto hidden sm:inline">Ctrl + Enter para enviar</span>
          <button className="btn btn-primary" disabled={busy || !body.trim()}>
            {internal ? <Lock className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} {internal ? "Guardar nota" : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Últimos mensajes de un cliente, en su ficha. */
export function ClientMessagesCard({ clientId }: { clientId: string }) {
  const [thread, setThread] = useState<Thread>();
  useEffect(() => {
    api<Thread>(`/api/messages/${clientId}`)
      .then(setThread)
      .catch(() => undefined);
  }, [clientId]);
  const last = thread?.messages.slice(-3) ?? [];
  const unread = thread?.messages.filter((m) => m.author === "client" && !m.readAt).length ?? 0;
  return (
    <Card
      title="Mensajes"
      description={unread ? `${unread} sin leer` : "Desde su portal"}
      actions={
        <Link href={`/mensajes?cliente=${clientId}`} className="btn btn-sm">
          <MessageSquare className="size-3.5" aria-hidden /> Abrir
        </Link>
      }
    >
      {!thread ? (
        <Skeleton className="h-12 w-full" />
      ) : last.length ? (
        <ul className="flex flex-col gap-2 text-[13px]">
          {last.map((m) => (
            <li key={m.id} className="min-w-0">
              <span className="text-xs text-muted">{m.author === "client" ? thread.client.name : m.author === "note" ? "Nota interna" : "Tú"} · {timeAgo(m.createdAt)}</span>
              <p className={`line-clamp-2 ${m.author === "client" && !m.readAt ? "font-medium text-fg" : "text-fg-2"}`}>{m.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{thread.client.portalEnabled ? "Aún no te ha escrito." : "Activa su portal para que pueda escribirte."}</p>
      )}
      {thread && <div className="mt-3"><ConsentBadge consents={thread.client.consents} portalEnabled={thread.client.portalEnabled} /></div>}
    </Card>
  );
}

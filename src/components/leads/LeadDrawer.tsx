"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Ban, Briefcase, ExternalLink, Globe, MapPin, Pencil, Phone, RefreshCw, Share2, Sparkles, Trash2, X } from "lucide-react";
import type { SavedLead } from "@/core/lead";
import type { CrmSettings, LeadUpdate, Tag } from "@/core/crm";
import { AUTO_TAGS, autoTags, leadScore } from "@/core/score";
import { compareTasks } from "@/core/calendar";
import { api, postJson, useData } from "../data/DataProvider";
import { TaskForm, TaskRow } from "../tasks/TaskParts";
import { ContactPanel } from "./ContactPanel";
import { PagePanel } from "./PagePanel";
import { Skeleton } from "../ui";
import { NewTagInput } from "./BulkBar";
import { ColorDot, ColorPicker, DncBadge, HoursAndReviews, SocialLinks, TagChip, hostname } from "./parts";
import { describeEnrichResult, type EnrichJobView } from "./enrich";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line px-5 py-4">
      <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ficha lateral de un lead guardado: etapa, color, etiquetas, notas, no contactar. */
export function LeadDrawer({
  initial,
  settings,
  onClose,
  onChange,
  onTrash,
  onCreateTag,
  onRefresh,
}: {
  initial: SavedLead;
  settings: CrmSettings;
  onClose(): void;
  onChange(lead: SavedLead): void;
  onTrash(id: string): Promise<void>;
  onCreateTag(name: string): Promise<Tag>;
  onRefresh(): Promise<void>;
}) {
  const [lead, setLead] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string }>();
  const [reason, setReason] = useState("");
  const [loadingFresh, setLoadingFresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { tasks } = useData();
  const leadTasks = tasks
    .filter((t) => t.leadId === initial.id)
    .sort(compareTasks);
  const pendingTasks = leadTasks.filter((t) => !t.done).length;

  // Datos frescos del servidor y foco inicial.
  useEffect(() => {
    closeRef.current?.focus();
    let cancelled = false;
    api<SavedLead>(`/api/leads/${initial.id}`)
      .then((l) => !cancelled && setLead(l))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingFresh(false));
    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(update: LeadUpdate) {
    setBusy(true);
    setError(undefined);
    try {
      const next = await postJson<SavedLead>(`/api/leads/${lead.id}`, update, "PATCH");
      setLead(next);
      onChange(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tags = lead.tags.map((id) => settings.tags.find((t) => t.id === id)).filter(Boolean) as Tag[];
  const available = settings.tags.filter((t) => !lead.tags.includes(t.id));
  const auto = autoTags(lead, settings.lowRating).map((id) => AUTO_TAGS.find((t) => t.id === id)!);
  const score = leadScore(lead);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l border-line bg-surface shadow-pop sm:w-[480px]">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="flex items-center gap-2 text-lg font-semibold leading-snug">
              {lead.color && <ColorDot color={lead.color} className="size-3" />}
              <span className="truncate">{lead.name}</span>
            </h2>
            <p className="truncate text-[13px] text-muted">{[lead.category, lead.address].filter(Boolean).join(" · ")}</p>
            {lead.doNotContact && (
              <div className="mt-2">
                <DncBadge reason={lead.doNotContact.reason} />
              </div>
            )}
          </div>
          <button ref={closeRef} className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar ficha">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {error && (
          <p role="alert" className="mx-5 mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="drawer-stage">
              Etapa
            </label>
            <select id="drawer-stage" className="input" value={lead.stage} disabled={busy} onChange={(e) => void patch({ stage: e.target.value })}>
              {!settings.stages.some((s) => s.id === lead.stage) && <option value={lead.stage}>Sin etapa</option>}
              {settings.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label">Color</span>
            <ColorPicker value={lead.color} allowNone onChange={(c) => void patch({ color: c })} label="Color del lead" />
          </div>
        </div>

        <Section title="Contactar">
          <ContactPanel lead={lead} settings={settings} onLog={patch} />
        </Section>

        <Section title={`Tareas${pendingTasks ? ` (${pendingTasks} ${pendingTasks === 1 ? "pendiente" : "pendientes"})` : ""}`}>
          <TaskForm leadId={lead.id} />
          {leadTasks.length > 0 && (
            <ul className="-mx-1 divide-y divide-line">
              {leadTasks.map((t) => (
                <TaskRow key={t.id} task={t} lead={lead} showLead={false} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Página web">
          <PagePanel key={lead.pageUrl ?? "none"} lead={lead} onPatch={patch} busy={busy} />
        </Section>

        <Section title="Datos de contacto">
          <ul className="flex flex-col gap-1.5 text-sm">
            {lead.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-muted" aria-hidden />
                <a href={`tel:${lead.phoneE164 ?? lead.phone}`} className="underline decoration-line-strong underline-offset-2">
                  {lead.phone}
                </a>
              </li>
            )}
            {lead.emails.map((e) => (
              <li key={e} className="flex items-center gap-2">
                <AtSign className="size-4 text-muted" aria-hidden />
                <a href={`mailto:${e}`} className="underline decoration-line-strong underline-offset-2">
                  {e}
                </a>
              </li>
            ))}
            {lead.website && (
              <li className="flex items-center gap-2">
                <Globe className="size-4 text-muted" aria-hidden />
                <a href={lead.website} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2">
                  {hostname(lead.website)}
                </a>
              </li>
            )}
            {lead.address && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-muted" aria-hidden />
                <span>{lead.address}</span>
              </li>
            )}
            {lead.url && (
              <li className="flex items-center gap-2">
                <ExternalLink className="size-4 text-muted" aria-hidden />
                <a href={lead.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2">
                  Ver en Google Maps
                </a>
              </li>
            )}
            {lead.socials && Object.keys(lead.socials).length > 0 && (
              <li className="flex items-start gap-2">
                <Share2 className="mt-1 size-4 text-muted" aria-hidden />
                <SocialLinks socials={lead.socials} />
              </li>
            )}
            {!lead.phone && !lead.emails.length && !lead.website && <li className="text-muted">Sin datos de contacto.</li>}
          </ul>
          <EnrichButton
            lead={lead}
            onDone={(next) => {
              setLead(next);
              onChange(next);
            }}
          />
        </Section>

        <Section title={`Puntuación: ${score} de 100`}>
          <div className="h-2 overflow-hidden rounded-full bg-primary-track" aria-hidden>
            <div className="h-full rounded-full bg-chart" style={{ width: `${score}%` }} />
          </div>
          <p className="hint">Suma datos de contacto (hasta 60), valoración (25) y nº de reseñas (15).</p>
          {auto.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {auto.map((t) => (
                <TagChip key={t.id} name={t.name} auto />
              ))}
            </div>
          )}
        </Section>

        <Section title="Etiquetas">
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && <span className="hint">Sin etiquetas.</span>}
            {tags.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} onRemove={() => void patch({ removeTags: [t.id] })} />
            ))}
          </div>
          {available.length > 0 && (
            <select
              className="input"
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && void patch({ addTags: [e.target.value] })}
              aria-label="Añadir etiqueta"
            >
              <option value="">Añadir etiqueta…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <NewTagInput
            onCreate={async (name) => {
              const tag = await onCreateTag(name);
              await patch({ addTags: [tag.id] });
            }}
          />
        </Section>

        <Section title={`Notas (${lead.notes.length})`}>
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!note.trim()) return;
              await patch({ addNote: note });
              setNote("");
            }}
          >
            <textarea
              className="input min-h-20 resize-y"
              placeholder="Escribe una nota: llamada, próxima acción, lo que te dijeron…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Nueva nota"
            />
            <div>
              <button className="btn btn-primary btn-sm" disabled={busy || !note.trim()}>
                Añadir nota
              </button>
            </div>
          </form>
          {loadingFresh && !lead.notes.length ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <ul className="flex flex-col gap-3">
              {lead.notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3">
                  {editing?.id === n.id ? (
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await patch({ updateNote: editing });
                        setEditing(undefined);
                      }}
                    >
                      <textarea
                        className="input min-h-16"
                        value={editing.text}
                        onChange={(e) => setEditing({ id: n.id, text: e.target.value })}
                        aria-label="Editar nota"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button className="btn btn-primary btn-sm" disabled={busy || !editing.text.trim()}>
                          Guardar
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(undefined)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <span>
                          {fmtDate(n.createdAt)}
                          {n.updatedAt ? " · editada" : ""}
                        </span>
                        <button className="ml-auto inline-flex items-center gap-1 hover:text-fg" onClick={() => setEditing({ id: n.id, text: n.text })}>
                          <Pencil className="size-3" aria-hidden /> Editar
                        </button>
                        <button
                          className="inline-flex items-center gap-1 hover:text-danger"
                          onClick={() => {
                            if (window.confirm("¿Borrar esta nota?")) void patch({ deleteNote: n.id });
                          }}
                        >
                          <Trash2 className="size-3" aria-hidden /> Borrar
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="No contactar">
          {lead.doNotContact ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Marcado el {new Date(lead.doNotContact.at).toLocaleDateString("es")}
                {lead.doNotContact.reason ? `: ${lead.doNotContact.reason}` : "."}
              </p>
              <div>
                <button className="btn btn-sm" disabled={busy} onClick={() => void patch({ doNotContact: false })}>
                  Quitar la marca
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="hint">Para personas que han pedido no volver a ser contactadas (RGPD). Se ocultan por defecto y no se exportan salvo que lo pidas.</p>
              <div className="flex gap-2">
                <input className="input" placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motivo" />
                <button
                  className="btn btn-sm whitespace-nowrap"
                  disabled={busy}
                  onClick={async () => {
                    await patch({ doNotContact: reason.trim() || true });
                    setReason("");
                  }}
                >
                  <Ban className="size-3.5" aria-hidden /> Marcar
                </button>
              </div>
            </div>
          )}
        </Section>

        <section className="border-t border-line px-5 py-4">
          <HoursAndReviews lead={lead} columns={false} />
        </section>

        <footer className="mt-auto flex flex-col gap-3 border-t border-line px-5 py-4 text-xs text-muted">
          <span>
            {lead.providerId === "csv" ? "Importado" : "Guardado"} el {new Date(lead.savedAt).toLocaleDateString("es")}
            {lead.updatedAt && lead.updatedAt.slice(0, 10) !== lead.savedAt.slice(0, 10)
              ? ` · actualizado el ${new Date(lead.updatedAt).toLocaleDateString("es")}`
              : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-sm"
              disabled={busy || refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              title="Lanza una búsqueda de su ficha en Google Maps y actualiza teléfono, web, valoración, horario y reseñas"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden /> Volver a extraer datos
            </button>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const c = await postJson<{ id: string }>("/api/clients", { fromLeadId: lead.id });
                  router.push(`/clientes/${c.id}`);
                } catch (err) {
                  setError((err as Error).message);
                  setBusy(false);
                }
              }}
              title="Crea un cliente con sus datos (o abre el que ya existe) para gestionar proyectos, pagos y horas"
            >
              <Briefcase className="size-3.5" aria-hidden /> Convertir en cliente
            </button>
            <button className="btn btn-sm text-danger" disabled={busy} onClick={() => void onTrash(lead.id)}>
              <Trash2 className="size-3.5" aria-hidden /> Mover a la papelera
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

/** Completa redes y emails del lead con los enriquecedores (p. ej. visitando su web). */
function EnrichButton({ lead, onDone }: { lead: SavedLead; onDone(lead: SavedLead): void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean }>();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setResult(undefined);
            try {
              const job = await postJson<EnrichJobView>("/api/enrich", { ids: [lead.id], wait: true });
              const r = job.results[0];
              setResult(r ? describeEnrichResult(r) : { text: "Sin resultado", ok: false });
              onDone(await api<SavedLead>(`/api/leads/${lead.id}`));
            } catch (err) {
              setResult({ text: (err as Error).message, ok: false });
            } finally {
              setBusy(false);
            }
          }}
          title={lead.website ? "Visita su web y busca redes sociales, emails y teléfono" : "Necesita que el lead tenga web"}
        >
          <Sparkles className={`size-3.5 ${busy ? "animate-pulse" : ""}`} aria-hidden /> {busy ? "Buscando en su web…" : "Completar redes y emails"}
        </button>
        {lead.enrichedAt && !result && <span className="text-xs text-muted">Revisado el {new Date(lead.enrichedAt).toLocaleDateString("es")}</span>}
      </div>
      {result && <p className={`text-[13px] ${result.ok ? "text-fg-2" : "text-muted"}`}>{result.text}</p>}
    </div>
  );
}

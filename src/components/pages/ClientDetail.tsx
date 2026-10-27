"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, AtSign, ExternalLink, Globe, MapPin, MoreHorizontal, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { OPEN_STATUSES, nextMilestone, projectProgress, statusLabel, type Client, type Project } from "@/core/clients";
import { compareTasks } from "@/core/calendar";
import { api, postJson, useData } from "../data/DataProvider";
import { ClientForm } from "../clients/ClientForm";
import { ProjectForm } from "../clients/ProjectForm";
import { ProjectPanel } from "../clients/ProjectPanel";
import { MenuItem, Popover } from "../leads/Popover";
import { hostname } from "../leads/parts";
import { TaskForm, TaskRow } from "../tasks/TaskParts";
import { Card, EmptyState, Loading, Notice, Skeleton } from "../ui";

const dayFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/** Ficha de un cliente: datos, proyectos y el detalle del proyecto elegido. */
export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { tasks, refreshTasks } = useData();
  const [client, setClient] = useState<Client>();
  const [projects, setProjects] = useState<Project[]>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const load = useCallback(
    () =>
      api<{ client: Client; projects: Project[] }>(`/api/clients/${id}`)
        .then((r) => {
          setClient(r.client);
          setProjects(r.projects);
        })
        .catch((e: Error) => (/no encontrado/i.test(e.message) ? setMissing(true) : setError(e.message))),
    [id],
  );
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  // Por defecto, el proyecto más "vivo": en curso, en revisión, propuesta, pausado… y si no, el más reciente.
  const byPriority = [...(projects ?? [])].sort(
    (a, b) => (OPEN_STATUSES.indexOf(a.status) + 1 || 99) - (OPEN_STATUSES.indexOf(b.status) + 1 || 99),
  );
  const selectedId = params.get("proyecto") ?? byPriority[0]?.id ?? undefined;
  const selected = projects?.find((p) => p.id === selectedId);
  const select = (pid: string) => router.replace(`${pathname}?proyecto=${pid}`, { scroll: false });

  async function patchProject(pid: string, body: Record<string, unknown>) {
    try {
      const p = await postJson<Project>(`/api/projects/${pid}`, body, "PATCH");
      setProjects((list) => list?.map((x) => (x.id === p.id ? p : x)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function patchClient(body: Record<string, unknown>) {
    try {
      setClient(await postJson<Client>(`/api/clients/${id}`, body, "PATCH"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (missing) {
    return (
      <EmptyState
        title="Cliente no encontrado"
        action={
          <Link href="/clientes" className="btn btn-primary">
            Ver clientes
          </Link>
        }
      >
        Puede que se haya borrado.
      </EmptyState>
    );
  }

  const generalTasks = tasks.filter((t) => t.clientId === id && !t.projectId).sort(compareTasks);

  return (
    <>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>

      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {client ? (
            <>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
                {client.name}
                {client.archived && <span className="badge border border-line text-xs font-medium text-muted">Archivado</span>}
              </h1>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
                {client.contactName && (
                  <li className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted" aria-hidden /> {client.contactName}
                  </li>
                )}
                {client.email && (
                  <li className="flex items-center gap-1.5">
                    <AtSign className="size-3.5 text-muted" aria-hidden />
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  </li>
                )}
                {client.phone && (
                  <li className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted" aria-hidden />
                    <a href={`tel:${client.phoneE164 ?? client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  </li>
                )}
                {client.website && (
                  <li className="flex items-center gap-1.5">
                    <Globe className="size-3.5 text-muted" aria-hidden />
                    <a href={client.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {hostname(client.website)}
                    </a>
                  </li>
                )}
                {client.address && (
                  <li className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted" aria-hidden /> {client.address}
                  </li>
                )}
                {client.leadId && (
                  <li className="flex items-center gap-1.5">
                    <ExternalLink className="size-3.5 text-muted" aria-hidden />
                    <Link href={`/leads?lead=${client.leadId}`} className="hover:underline">
                      Ver como lead
                    </Link>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="mt-3 h-4 w-96 max-w-full" />
            </>
          )}
        </div>
        {client && (
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Editar
            </button>
            <Popover buttonClassName="btn size-10 p-0" width="w-52" label={<MoreHorizontal className="size-4" aria-label="Más opciones del cliente" />}>
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close();
                      void patchClient({ archived: !client.archived });
                    }}
                  >
                    {client.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                    {client.archived ? "Desarchivar" : "Archivar"}
                  </MenuItem>
                  <MenuItem
                    danger
                    onClick={async () => {
                      close();
                      if (!window.confirm(`¿Borrar "${client.name}" con sus ${projects?.length ?? 0} proyectos y tareas? No se puede deshacer.`)) return;
                      try {
                        await postJson(`/api/clients/${id}`, {}, "DELETE");
                        await refreshTasks();
                        router.push("/clientes");
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /> Borrar cliente
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        )}
      </header>

      {/* Móvil: proyectos → detalle → tareas generales y notas. Escritorio: dos columnas. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        <div className="xl:col-start-1 xl:row-start-1">
          <Card
            title="Proyectos"
            actions={
              client && (
                <button className="btn btn-sm" onClick={() => setCreatingProject(true)}>
                  <Plus className="size-3.5" aria-hidden /> Nuevo
                </button>
              )
            }
            bodyClassName="px-2 pb-2"
          >
            {!projects ? (
              <Loading label="Cargando proyectos…">
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              </Loading>
            ) : projects.length === 0 ? (
              <p className="hint px-3 pb-3">Sin proyectos todavía. Crea el primero para organizar hitos, tareas, pagos y horas.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {projects.map((p) => {
                  const progress = projectProgress(p, tasks.filter((t) => t.projectId === p.id));
                  const next = nextMilestone(p);
                  return (
                    <li key={p.id}>
                      <button
                        className={`flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left ${p.id === selectedId ? "bg-primary-soft" : "hover:bg-surface-2"}`}
                        onClick={() => select(p.id)}
                        aria-current={p.id === selectedId ? "true" : undefined}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted">{statusLabel(p.status)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-track" aria-hidden>
                            <span className="block h-full rounded-full bg-chart" style={{ width: `${progress}%` }} />
                          </span>
                          <span className="w-9 text-right text-xs tabular-nums text-muted">{progress}%</span>
                        </span>
                        {(next || p.dueDate) && (
                          <span className="truncate text-xs text-muted">
                            {next ? `${next.title} · ${dayFmt.format(new Date(next.dueAt!))}` : `Entrega ${dayFmt.format(new Date(`${p.dueDate}T12:00:00`))}`}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {selected ? (
            <ProjectPanel
              key={selected.id}
              project={selected}
              onPatch={(body) => patchProject(selected.id, body)}
              onDelete={async () => {
                try {
                  await postJson(`/api/projects/${selected.id}`, {}, "DELETE");
                  setProjects((list) => list?.filter((p) => p.id !== selected.id));
                  router.replace(pathname, { scroll: false });
                  await refreshTasks();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          ) : projects && client ? (
            <EmptyState
              title="Crea su primer proyecto"
              action={
                <button className="btn btn-primary" onClick={() => setCreatingProject(true)}>
                  <Plus className="size-4" aria-hidden /> Nuevo proyecto
                </button>
              }
            >
              Un proyecto agrupa el cronograma de hitos, las tareas, el presupuesto con sus pagos y las horas dedicadas.
            </EmptyState>
          ) : (
            <Card>
              <Loading label="Cargando…">
                <div className="flex flex-col gap-3 py-5">
                  <Skeleton className="h-7 w-72" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              </Loading>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-5 xl:col-start-1 xl:row-start-2">
          {client && (
            <Card title="Tareas generales" description="Del cliente, sin proyecto concreto">
              <div className="flex flex-col gap-3">
                <TaskForm clientId={client.id} />
                {generalTasks.length > 0 && (
                  <ul className="-mx-1 divide-y divide-line">
                    {generalTasks.map((t) => (
                      <TaskRow key={t.id} task={t} showLead={false} />
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}

          {client?.notes && (
            <Card title="Notas">
              <p className="whitespace-pre-wrap text-sm text-fg-2">{client.notes}</p>
            </Card>
          )}
        </div>

      </div>

      {editing && client && (
        <ClientForm
          client={client}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setEditing(false);
            setClient(c);
          }}
        />
      )}
      {creatingProject && client && (
        <ProjectForm
          clientId={client.id}
          onClose={() => setCreatingProject(false)}
          onSaved={(p) => {
            setCreatingProject(false);
            setProjects((list) => [p, ...(list ?? [])]);
            select(p.id);
          }}
        />
      )}
    </>
  );
}

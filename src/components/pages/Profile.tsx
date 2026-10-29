"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, KeyRound, LogOut, Monitor, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
import { api, postJson } from "../data/DataProvider";
import { Field } from "../clients/Dialog";
import { Card, Notice, PageHeader, Skeleton, timeAgo } from "../ui";
import { FormError, PasswordInput, RecoveryCodeBox, StrengthMeter, deviceLabel } from "../auth/parts";
import { hardNavigate } from "../auth/safeNext";

interface Me {
  user: { id: string; email: string; name: string; createdAt: string; lastLoginAt?: string; founder: boolean; hasMcpToken: boolean };
  emailRecovery: boolean;
}

interface SessionView {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent?: string;
  ip?: string;
}

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });

/** Tu cuenta: datos, contraseña, código de recuperación, sesiones, Claude y eliminar la cuenta. */
export function Profile() {
  const [me, setMe] = useState<Me>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => api<Me>("/api/auth/me").then(setMe).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <>
      <PageHeader title="Perfil" description="Tu cuenta, tu contraseña y los dispositivos donde has iniciado sesión." />
      {error && (
        <div className="mb-4">
          <Notice tone="error" onClose={() => setError(undefined)}>
            {error}
          </Notice>
        </div>
      )}
      {!me ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <AccountCard me={me} onSaved={load} />
            <PasswordCard />
            <RecoveryCard />
          </div>
          <div className="flex flex-col gap-5">
            <SessionsCard />
            <ClaudeCard hasToken={me.user.hasMcpToken} onChanged={load} />
            <DeleteCard me={me} />
          </div>
        </div>
      )}
    </>
  );
}

function useSaved() {
  const [notice, setNotice] = useState<string>();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

function AccountCard({ me, onSaved }: { me: Me; onSaved(): void }) {
  const [name, setName] = useState(me.user.name);
  const [email, setEmail] = useState(me.user.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useSaved();
  const emailChanged = email.trim().toLowerCase() !== me.user.email;
  const dirty = name.trim() !== me.user.name || emailChanged;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/me", { name, email, currentPassword: password }, "PATCH");
      setPassword("");
      setSaved("Datos guardados.");
      onSaved();
      window.dispatchEvent(new Event("account:changed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Tu cuenta" description={`Desde el ${dateFmt.format(new Date(me.user.createdAt))}${me.user.founder ? " · primera cuenta de esta instalación" : ""}`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <FormError>{error}</FormError>
        {saved && <p className="rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">{saved}</p>}
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-fg" aria-hidden>
            {initials(name || me.user.name)}
          </span>
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
          </div>
        </div>
        {emailChanged && (
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="email-password">
              Contraseña actual (para cambiar el email)
            </label>
            <PasswordInput id="email-password" value={password} onChange={setPassword} autoComplete="current-password" />
          </div>
        )}
        <div>
          <button className="btn btn-primary btn-sm" disabled={busy || !dirty}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useSaved();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setSaved("Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.");
      window.dispatchEvent(new Event("sessions:changed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Contraseña" description="Al cambiarla se cierran las sesiones abiertas en otros dispositivos.">
      <form onSubmit={save} className="flex flex-col gap-4">
        <FormError>{error}</FormError>
        {saved && <p className="rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">{saved}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="current-password">
              Contraseña actual
            </label>
            <PasswordInput id="current-password" value={current} onChange={setCurrent} autoComplete="current-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="next-password">
              Contraseña nueva
            </label>
            <PasswordInput id="next-password" value={next} onChange={setNext} autoComplete="new-password" />
            <StrengthMeter password={next} />
          </div>
        </div>
        <div>
          <button className="btn btn-primary btn-sm" disabled={busy || !current || next.length < 8}>
            {busy ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function RecoveryCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await postJson<{ recoveryCode: string }>("/api/auth/recovery-code", { currentPassword: password });
      setCode(res.recoveryCode);
      setPassword("");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Código de recuperación" description="Si olvidas la contraseña, con tu email y este código eliges otra.">
      <div className="flex flex-col gap-4">
        {code ? (
          <RecoveryCodeBox code={code} />
        ) : (
          <p className="text-[13.5px] text-fg-2">
            Se te mostró al crear la cuenta. Si no lo encuentras o crees que alguien lo ha visto, genera uno nuevo: el anterior dejará de valer.
          </p>
        )}
        {open ? (
          <form onSubmit={generate} className="flex flex-col gap-3">
            <FormError>{error}</FormError>
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="recovery-password">
                Confirma con tu contraseña
              </label>
              <PasswordInput id="recovery-password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" disabled={busy || !password}>
                <KeyRound className="size-3.5" aria-hidden /> {busy ? "Generando…" : "Generar código nuevo"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button className="btn btn-sm" onClick={() => setOpen(true)}>
              <KeyRound className="size-3.5" aria-hidden /> {code ? "Generar otro" : "Generar un código nuevo"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function SessionsCard() {
  const [sessions, setSessions] = useState<SessionView[]>();
  const [error, setError] = useState<string>();
  const load = useCallback(
    () =>
      api<{ sessions: SessionView[] }>("/api/auth/sessions")
        .then((r) => setSessions(r.sessions))
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void Promise.resolve().then(load);
    window.addEventListener("sessions:changed", load);
    return () => window.removeEventListener("sessions:changed", load);
  }, [load]);

  async function close(query: string) {
    try {
      await api(`/api/auth/sessions?${query}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0;
  return (
    <Card
      title="Sesiones abiertas"
      description="Dispositivos donde has iniciado sesión en los últimos 30 días."
      actions={
        others > 0 && (
          <button className="btn btn-sm" onClick={() => void close("otras=1")}>
            <LogOut className="size-3.5" aria-hidden /> Cerrar las demás
          </button>
        )
      }
    >
      <FormError>{error}</FormError>
      {!sessions ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const mobile = /iPhone|iPad|Android/.test(s.userAgent ?? "");
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    {deviceLabel(s.userAgent)}
                    {s.current && <span className="badge bg-success-soft text-success">Este dispositivo</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {s.current ? "Activa ahora" : `Última actividad ${timeAgo(s.lastSeenAt)}`}
                    {s.ip ? ` · IP ${s.ip}` : ""} · desde el {dateFmt.format(new Date(s.createdAt))}
                  </span>
                </span>
                {!s.current && (
                  <button className="btn btn-sm" onClick={() => void close(`id=${encodeURIComponent(s.id)}`)} aria-label={`Cerrar la sesión de ${deviceLabel(s.userAgent)}`}>
                    Cerrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ClaudeCard({ hasToken, onChanged }: { hasToken: boolean; onChanged(): void }) {
  const [token, setToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      setToken((await postJson<{ token: string }>("/api/auth/mcp-token", {})).token);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api("/api/auth/mcp-token", { method: "DELETE" });
      setToken(undefined);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Conectar Claude" description="Para que Claude trabaje con tu CRM (y solo con el tuyo) mediante MCP.">
      <div className="flex flex-col gap-3 text-[13.5px]">
        <FormError>{error}</FormError>
        <p className="text-fg-2">
          Dirección del conector: <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12.5px]">{url}</code>
        </p>
        {token ? (
          <>
            <p className="text-fg-2">Tu token (cópialo ahora: no se volverá a mostrar). Úsalo como cabecera <code className="text-[12.5px]">Authorization: Bearer …</code>:</p>
            <code className="rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 py-2 font-mono text-[12.5px] break-all">{token}</code>
          </>
        ) : (
          <p className="text-muted">{hasToken ? "Claude está conectado con un token. Si lo pierdes, crea otro (el anterior dejará de valer)." : "Aún no has creado un token."}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={() => void create()} disabled={busy}>
            <Bot className="size-3.5" aria-hidden /> {hasToken ? "Crear un token nuevo" : "Crear token"}
          </button>
          {hasToken && (
            <button className="btn btn-sm btn-ghost" onClick={() => void revoke()} disabled={busy}>
              Desconectar
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function DeleteCard({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/me", { currentPassword: password, confirm }, "DELETE");
      hardNavigate("/login");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card title="Eliminar la cuenta">
      <div className="flex flex-col gap-3 text-[13.5px]">
        <p className="flex gap-2 text-fg-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <span>
            Se borran tu cuenta y <strong>todos tus datos</strong>: leads, clientes, documentos, facturas, gastos y mensajes. No se puede deshacer. Si quieres
            conservarlos, descarga antes una copia en Ajustes → General → Copia de seguridad.
            {me.user.founder && " Esta es la primera cuenta: se borran también los datos que había antes de añadir el inicio de sesión."}
          </span>
        </p>
        {open ? (
          <form onSubmit={remove} className="flex flex-col gap-3">
            <FormError>{error}</FormError>
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="delete-password">
                Tu contraseña
              </label>
              <PasswordInput id="delete-password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <Field label={`Escribe tu email (${me.user.email}) para confirmar`}>
              <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
            <div className="flex gap-2">
              <button className="btn btn-sm border-danger bg-danger text-white hover:bg-danger/90" disabled={busy || !password || confirm.trim().toLowerCase() !== me.user.email}>
                <Trash2 className="size-3.5" aria-hidden /> {busy ? "Eliminando…" : "Eliminar mi cuenta"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button className="btn btn-sm text-danger" onClick={() => setOpen(true)}>
              <Trash2 className="size-3.5" aria-hidden /> Eliminar la cuenta…
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { postJson } from "../data/DataProvider";
import { Field } from "../clients/Dialog";
import { AuthCard, FormError, PasswordInput, RecoveryCodeBox, StrengthMeter } from "./parts";
import { useAuthConfig } from "./LoginForm";
import { hardNavigate } from "./safeNext";

/**
 * Recuperar el acceso:
 * - con el código de recuperación (siempre), o
 * - con un enlace por email (si el servidor tiene configurado el envío).
 * Con ?token= (el enlace del email) se elige directamente la contraseña nueva.
 */
export function RecoverForm() {
  const token = useSearchParams().get("token");
  return token ? <ResetWithLink token={token} /> : <RecoverChoice />;
}

const backToLogin = (
  <Link href="/login" className="font-medium text-fg underline underline-offset-2">
    Volver a iniciar sesión
  </Link>
);

function RecoverChoice() {
  const config = useAuthConfig();
  const [mode, setMode] = useState<"code" | "email">("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [newCode, setNewCode] = useState<string>();
  const [sent, setSent] = useState(false);

  async function withCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await postJson<{ recoveryCode: string }>("/api/auth/recover", { email, code, newPassword: password });
      setNewCode(res.recoveryCode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function byEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/recover/email", { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (newCode)
    return (
      <AuthCard title="Contraseña cambiada" description="Ya has entrado con tu contraseña nueva. Tu código de recuperación anterior ya no vale: guarda este.">
        <RecoveryCodeBox code={newCode} />
        <button className="btn btn-primary mt-5 w-full py-2.5" onClick={() => hardNavigate("/")}>
          Entrar en la app <ArrowRight className="size-4" aria-hidden />
        </button>
      </AuthCard>
    );

  if (sent)
    return (
      <AuthCard title="Revisa tu correo" description={`Si hay una cuenta con ${email}, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en una hora.`} footer={backToLogin}>
        <p className="hint">¿No llega? Mira en la carpeta de spam o usa tu código de recuperación.</p>
      </AuthCard>
    );

  return (
    <AuthCard title="Recuperar la contraseña" description="Elige una contraseña nueva para tu cuenta." footer={backToLogin}>
      {config?.emailRecovery && (
        <div role="tablist" aria-label="Cómo recuperarla" className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["code", "Con mi código", KeyRound],
              ["email", "Por email", Mail],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => {
                setMode(id);
                setError(undefined);
              }}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${mode === id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}

      {mode === "code" ? (
        <form onSubmit={withCode} className="flex flex-col gap-4">
          <FormError>{error}</FormError>
          <Field label="Email de tu cuenta">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          <Field label="Código de recuperación" hint="El que guardaste al crear la cuenta, como ABCDE-FGHJK-LMNPQ-RSTUV.">
            <input
              className="input font-mono uppercase tracking-wider"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              spellCheck={false}
              required
              maxLength={40}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="new-password">
              Contraseña nueva
            </label>
            <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
            <StrengthMeter password={password} />
          </div>
          <button className="btn btn-primary mt-1 w-full py-2.5" disabled={busy}>
            {busy ? "Comprobando…" : "Cambiar la contraseña"}
          </button>
          {!config?.emailRecovery && (
            <p className="hint">¿Has perdido también el código? Pide a quien administra esta instalación que te ayude a recuperar la cuenta.</p>
          )}
        </form>
      ) : (
        <form onSubmit={byEmail} className="flex flex-col gap-4">
          <FormError>{error}</FormError>
          <Field label="Email de tu cuenta">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          <button className="btn btn-primary mt-1 w-full py-2.5" disabled={busy}>
            <Mail className="size-4" aria-hidden /> {busy ? "Enviando…" : "Enviarme un enlace"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

function ResetWithLink({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/reset", { token, newPassword: password });
      hardNavigate("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Elige una contraseña nueva" description="Al guardarla se cerrarán las sesiones abiertas en otros dispositivos." footer={backToLogin}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError>{error}</FormError>
        <div className="flex flex-col gap-1.5">
          <label className="label" htmlFor="new-password">
            Contraseña nueva
          </label>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
          <StrengthMeter password={password} />
        </div>
        <button className="btn btn-primary mt-1 w-full py-2.5" disabled={busy}>
          {busy ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </AuthCard>
  );
}

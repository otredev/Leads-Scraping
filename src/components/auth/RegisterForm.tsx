"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, UserPlus } from "lucide-react";
import { postJson } from "../data/DataProvider";
import { Field } from "../clients/Dialog";
import { AuthCard, FormError, PasswordInput, RecoveryCodeBox, StrengthMeter } from "./parts";
import { useAuthConfig } from "./LoginForm";
import { hardNavigate, safeNext } from "./safeNext";

export function RegisterForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const config = useAuthConfig();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [code, setCode] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await postJson<{ recoveryCode: string }>("/api/auth/register", { name, email, password, accept });
      setCode(res.recoveryCode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Paso 2: el código de recuperación (se muestra una sola vez).
  if (code)
    return (
      <AuthCard title="Guarda tu código de recuperación" description="Tu cuenta está creada. Antes de entrar, guarda este código: es la forma de recuperar el acceso si olvidas la contraseña.">
        <RecoveryCodeBox code={code} />
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>He guardado el código en un lugar seguro</span>
        </label>
        <button className="btn btn-primary mt-5 w-full py-2.5" disabled={!saved} onClick={() => hardNavigate(next)}>
          Entrar en la app <ArrowRight className="size-4" aria-hidden />
        </button>
      </AuthCard>
    );

  if (config && !config.registration)
    return (
      <AuthCard title="Registro cerrado" description="En esta instalación no se pueden crear cuentas nuevas.">
        <Link href="/login" className="btn btn-primary w-full">
          Iniciar sesión
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Crear cuenta"
      description={
        config?.firstAccount
          ? "Es la primera cuenta de esta instalación: tendrá los leads, clientes y documentos que ya hay en la app."
          : "Tendrás tu propio CRM, con tus leads, clientes y documentos. Nadie más los ve."
      }
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-fg underline underline-offset-2">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError>{error}</FormError>
        <Field label="Nombre">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} autoFocus />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <div className="flex flex-col gap-1.5">
          <label className="label" htmlFor="new-password">
            Contraseña
          </label>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
          <StrengthMeter password={password} />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-2">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
          <span>Acepto que mis datos de acceso (nombre, email y sesiones) se guarden en este servidor para usar la app.</span>
        </label>
        <button className="btn btn-primary mt-1 w-full py-2.5" disabled={busy}>
          <UserPlus className="size-4" aria-hidden /> {busy ? "Creando la cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { postJson, api } from "../data/DataProvider";
import { Field } from "../clients/Dialog";
import { AuthCard, FormError, PasswordInput } from "./parts";
import { hardNavigate, safeNext } from "./safeNext";

interface AuthConfig {
  registration: boolean;
  emailRecovery: boolean;
  firstAccount: boolean;
}

export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig>();
  useEffect(() => {
    api<AuthConfig>("/api/auth/config")
      .then(setConfig)
      .catch(() => setConfig({ registration: true, emailRecovery: false, firstAccount: false }));
  }, []);
  return config;
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const config = useAuthConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postJson("/api/auth/login", { email, password });
      // Carga completa: la app arranca con los datos de esta cuenta.
      hardNavigate(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const registerHref = next !== "/" ? `/registro?next=${encodeURIComponent(next)}` : "/registro";
  return (
    <AuthCard
      title="Iniciar sesión"
      description="Entra en tu CRM de leads."
      footer={
        config?.registration !== false && (
          <>
            ¿No tienes cuenta?{" "}
            <Link href={registerHref} className="font-medium text-fg underline underline-offset-2">
              Crea una
            </Link>
          </>
        )
      }
    >
      {config?.firstAccount && (
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-fg-2">
          Todavía no hay ninguna cuenta.{" "}
          <Link href="/registro" className="font-medium text-fg underline underline-offset-2">
            Crea la tuya
          </Link>{" "}
          para entrar: tendrá los datos que ya hay en la app.
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError>{error}</FormError>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <Link href="/recuperar" className="text-[12.5px] text-muted hover:text-fg">
              ¿La has olvidado?
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary mt-1 w-full py-2.5" disabled={busy}>
          <LogIn className="size-4" aria-hidden /> {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";

/** Piezas comunes de las pantallas de acceso (login, registro, recuperar) y del perfil. */

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5 font-semibold tracking-tight text-fg">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
        </span>
        <span className="text-base">Leads Scraping</span>
      </Link>
      <section className="card w-full max-w-[420px] p-6 sm:p-8">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </section>
      {footer && <div className="mt-5 text-center text-[13.5px] text-muted">{footer}</div>}
    </main>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {children}
    </p>
  );
}

/** Campo de contraseña con botón para verla. */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  id,
  placeholder,
  required = true,
}: {
  value: string;
  onChange(v: string): void;
  autoComplete: "current-password" | "new-password";
  id?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        className="input pr-10"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={autoComplete === "new-password" ? 8 : undefined}
        maxLength={200}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Fuerza orientativa de una contraseña nueva (0–4). */
export function passwordStrength(p: string) {
  if (p.length < 8) return 0;
  let score = 1;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.min(score, 4);
}

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return <span className="hint">Mínimo 8 caracteres. Mejor una frase larga que una palabra rara.</span>;
  const s = passwordStrength(password);
  const labels = ["Demasiado corta", "Débil", "Aceptable", "Buena", "Muy buena"];
  return (
    <span className="flex items-center gap-2">
      <span className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= s ? (s <= 1 ? "bg-danger" : s === 2 ? "bg-warning" : "bg-success") : "bg-line"}`} />
        ))}
      </span>
      <span className="hint w-28 text-right">{labels[s]}</span>
    </span>
  );
}

/** Muestra el código de recuperación (solo se ve una vez). */
export function RecoveryCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-3">
        <KeyRound className="size-5 shrink-0 text-muted" aria-hidden />
        {/* Cada grupo de 5 no se parte: si no cabe en una línea, salta por los guiones. */}
        <code className="flex flex-1 flex-wrap font-mono text-[15px] font-semibold tracking-wide text-fg" aria-label="Código de recuperación">
          {code.split("-").map((g, i) => (
            <span key={i} className="whitespace-nowrap">
              {i > 0 && "-"}
              {g}
            </span>
          ))}
        </code>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="hint">
        Guárdalo en tu gestor de contraseñas o apúntalo en un lugar seguro. Si olvidas la contraseña, con tu email y este código podrás elegir otra. No lo
        volveremos a mostrar.
      </p>
    </div>
  );
}

/** "Chrome en Windows" a partir del user-agent. */
export function deviceLabel(ua?: string) {
  if (!ua) return "Dispositivo desconocido";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|python|node/i.test(ua)
              ? "Programa"
              : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return os ? `${browser} en ${os}` : browser;
}

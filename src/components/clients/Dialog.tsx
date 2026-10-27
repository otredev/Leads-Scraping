"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

/** Ventana modal sencilla (Escape o clic fuera la cierran). */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  busy,
  width = "max-w-lg",
}: {
  title: string;
  description?: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  width?: string;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-pop sm:rounded-card`}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={id} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="text-[13px] text-muted">{description}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/** Campo con etiqueta. */
export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

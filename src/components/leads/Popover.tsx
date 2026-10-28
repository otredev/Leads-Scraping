"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Botón + panel flotante. Se cierra al hacer clic fuera o con Escape.
 * `children` puede ser una función que recibe `close`.
 */
export function Popover({
  label,
  buttonClassName = "btn btn-sm",
  align = "right",
  width = "w-64",
  disabled,
  children,
  title,
}: {
  label: ReactNode;
  buttonClassName?: string;
  align?: "left" | "right";
  width?: string;
  disabled?: boolean;
  title?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={buttonClassName} onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={disabled} title={title}>
        {label}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-2 flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-pop ${width} ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/** Opción de menú dentro de un Popover. */
export function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${danger ? "text-danger" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

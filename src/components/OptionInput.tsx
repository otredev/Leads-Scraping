"use client";

import type { OptionField } from "@/core/options";

interface Props {
  field: OptionField;
  value: string | number | boolean;
  onChange(value: string | number | boolean): void;
}

/** Renderiza cualquier opción declarada por un módulo. */
export function OptionInput({ field, value, onChange }: Props) {
  const id = `opt-${field.key}`;
  const help = field.help ? <p className="hint">{field.help}</p> : null;

  if (field.type === "boolean") {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {help && <div className="pl-6.5">{help}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={id}>
        {field.label}
      </label>
      {field.type === "select" ? (
        <select id={id} className="input" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : field.type === "number" ? (
        <input
          id={id}
          className="input"
          type="number"
          value={Number(value)}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(e.target.value === "" ? field.default : Number(e.target.value))}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          value={String(value)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help}
    </div>
  );
}

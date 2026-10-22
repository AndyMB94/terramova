import { type KeyboardEvent, useId, useState } from "react";

import { cn } from "@/shared/lib/utils";

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  placeholder?: string;
  /** Si existe, el valor no puede ser menor (p. ej. el máximo frente al mínimo). */
  lowerBound?: number;
  onCommit: (value: number | undefined) => void;
}

/**
 * Campo numérico que aplica el filtro al salir del campo o con Intro, no en cada tecla:
 * así no se lanza una consulta por carácter. Acepta coma o punto decimal.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  lowerBound,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  // Si el filtro cambia desde fuera (Restablecer, URL compartida), el borrador lo sigue.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value === undefined ? "" : String(value));
  }

  const parsed = draft.trim() === "" ? undefined : Number(draft.replace(",", "."));
  const error =
    parsed !== undefined && (Number.isNaN(parsed) || parsed < min || parsed > max)
      ? `Entre ${min} y ${max}`
      : parsed !== undefined && lowerBound !== undefined && parsed < lowerBound
        ? "Menor que el mínimo"
        : undefined;

  const commit = () => {
    if (error) return;
    if (parsed !== value) onCommit(parsed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cn(
          "tabular h-10 w-full rounded-md border bg-surface px-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/80",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

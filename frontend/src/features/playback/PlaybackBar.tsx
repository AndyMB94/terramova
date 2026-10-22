import { Pause, Play, X } from "lucide-react";
import { useId } from "react";

import { cn } from "@/shared/lib/utils";

import { formatCursor, KEYBOARD_STEPS, type PlaybackWindow, type Speed, SPEEDS } from "./timeline";

interface PlaybackBarProps {
  range: PlaybackWindow;
  cursorMs: number;
  playing: boolean;
  speed: Speed;
  visibleCount: number;
  /** El mapa trae solo los eventos de mayor magnitud (límite de puntos). */
  truncated: boolean;
  onTogglePlaying: () => void;
  onSeek: (cursorMs: number) => void;
  onSpeed: (speed: Speed) => void;
  onClose: () => void;
}

/** Controles de la reproducción temporal; todo se maneja también con el teclado. */
export function PlaybackBar(props: PlaybackBarProps) {
  const { range, cursorMs, playing, speed } = props;
  const sliderId = useId();
  const cursorLabel = formatCursor(cursorMs);

  return (
    <section
      aria-label="Reproducción temporal"
      className="flex flex-col gap-2 border-t border-border-subtle bg-panel px-3 py-2.5 lg:px-4"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={props.onTogglePlaying}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-raised px-3 text-[13px] font-medium"
        >
          {playing ? (
            <Pause aria-hidden="true" className="size-4" />
          ) : (
            <Play aria-hidden="true" className="size-4" />
          )}
          {playing ? "Pausar" : "Reproducir"}
        </button>
        <label htmlFor={sliderId} className="sr-only">
          Momento de la reproducción
        </label>
        <input
          id={sliderId}
          type="range"
          min={range.startMs}
          max={range.endMs}
          step={(range.endMs - range.startMs) / KEYBOARD_STEPS}
          value={cursorMs}
          aria-valuetext={cursorLabel}
          onChange={(event) => props.onSeek(Number(event.target.value))}
          className="min-w-0 flex-1 cursor-pointer accent-[var(--tm-accent)]"
        />
        <button
          type="button"
          aria-label="Cerrar la reproducción"
          onClick={props.onClose}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-xs text-muted-foreground" aria-live="off">
          <span className="tabular font-mono text-foreground">{cursorLabel}</span> ·{" "}
          <span className="tabular font-mono">{props.visibleCount}</span> eventos hasta este
          momento. La lista sigue completa.
          {props.truncated
            ? " Se reproducen los eventos de mayor magnitud que muestra el mapa."
            : ""}
        </p>
        <div
          role="group"
          aria-label="Velocidad"
          className="flex gap-1 rounded-[10px] border border-border-subtle bg-surface p-1"
        >
          {SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={speed === option}
              onClick={() => props.onSpeed(option)}
              className={cn(
                "h-8 min-w-11 cursor-pointer rounded-sm px-2 text-[13px]",
                speed === option ? "bg-selected font-medium" : "text-muted-foreground",
              )}
            >
              ×{option}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";

import { advanceCursor, type PlaybackWindow, type Speed } from "./timeline";

// El cursor avanza a 10 pasos por segundo: suficiente para ver aparecer los eventos sin
// recalcular los puntos del globo en cada fotograma.
const TICK_MS = 100;

interface State {
  /** Ventana con la que se abrió: si los filtros la cambian, la reproducción se cierra. */
  windowKey: string | null;
  playing: boolean;
  speed: Speed;
  cursorMs: number;
}

function keyOf(range: PlaybackWindow | null): string | null {
  return range ? `${range.startMs}-${range.endMs}` : null;
}

export function usePlayback(range: PlaybackWindow | null, reducedMotion: boolean) {
  const [state, setState] = useState<State>({
    windowKey: null,
    playing: false,
    speed: 1,
    cursorMs: 0,
  });
  const key = keyOf(range);
  const active = state.windowKey !== null && state.windowKey === key;
  const playing = active && state.playing;

  useEffect(() => {
    if (!playing || !range) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      setState((current) => {
        const { cursorMs, ended } = advanceCursor(current.cursorMs, elapsed, current.speed, range);
        return { ...current, cursorMs, playing: !ended };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, range]);

  /** Abre desde el inicio; con movimiento reducido no arranca sola (docs/UI_UX.md). */
  const open = useCallback(() => {
    if (!range) return;
    setState((current) => ({
      ...current,
      windowKey: keyOf(range),
      cursorMs: range.startMs,
      playing: !reducedMotion,
    }));
  }, [range, reducedMotion]);

  const close = useCallback(() => {
    setState((current) => ({ ...current, windowKey: null, playing: false }));
  }, []);

  /** Al terminar, volver a reproducir empieza de nuevo. */
  const togglePlaying = useCallback(() => {
    if (!range) return;
    setState((current) => {
      if (current.playing) return { ...current, playing: false };
      const restart = current.cursorMs >= range.endMs;
      return { ...current, playing: true, cursorMs: restart ? range.startMs : current.cursorMs };
    });
  }, [range]);

  const seek = useCallback(
    (cursorMs: number) => {
      if (!range) return;
      const clamped = Math.min(Math.max(cursorMs, range.startMs), range.endMs);
      setState((current) => ({ ...current, cursorMs: clamped }));
    },
    [range],
  );

  const setSpeed = useCallback((speed: Speed) => {
    setState((current) => ({ ...current, speed }));
  }, []);

  return {
    active,
    playing,
    speed: state.speed,
    cursorMs: active ? state.cursorMs : null,
    open,
    close,
    togglePlaying,
    seek,
    setSpeed,
  };
}

import { Cartesian3, type CesiumWidget } from "cesium";
import { useEffect, useRef, useState } from "react";

import { EventPointLayer, type GlobePoint } from "@/features/explore/globe/points";
import { createGlobe } from "@/features/explore/globe/viewer";
import { formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/**
 * Laboratorio de rendimiento (solo en desarrollo): mide los fps del globo con N puntos
 * SINTÉTICOS mientras gira sin parar, que es el peor caso (dibuja todos los fotogramas).
 * El resultado se documenta en docs/DECISIONS.md y decide la capa nocturna (Fase 3, PR 3).
 */
const COUNTS = [1000, 5000, 10000] as const;
const WINDOW_SECONDS = 10;

export default function PerformanceLab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLSpanElement>(null);
  const widgetRef = useRef<CesiumWidget | null>(null);
  const layerRef = useRef<EventPointLayer | null>(null);
  const spinningRef = useRef(true);
  const [count, setCount] = useState<number>(1000);
  const [spinning, setSpinning] = useState(true);
  const [quality, setQuality] = useState({ msaa: 4, atmosphere: true, scale: 1 });
  const [samples, setSamples] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [environment] = useState(describeEnvironment);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    const container = containerRef.current;
    const credits = creditsRef.current;
    if (!container || !credits) return;
    const widget = createGlobe(container, credits);
    widgetRef.current = widget;
    layerRef.current = new EventPointLayer(widget.scene);

    let frames = 0;
    const removeListener = widget.scene.postRender.addEventListener(() => {
      frames += 1;
    });
    const interval = window.setInterval(() => {
      // Se copia antes de reiniciar: React puede ejecutar el actualizador más tarde.
      const lastSecond = frames;
      frames = 0;
      setSamples((previous) => [...previous, lastSecond].slice(-WINDOW_SECONDS));
    }, 1000);

    let raf = 0;
    const tick = () => {
      if (spinningRef.current) widget.camera.rotate(Cartesian3.UNIT_Z, -0.004);
      widget.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      removeListener();
      layerRef.current?.destroy();
      layerRef.current = null;
      widgetRef.current = null;
      widget.destroy();
    };
  }, []);

  useEffect(() => {
    layerRef.current?.update(syntheticPoints(count));
  }, [count]);

  // Ajustes que pueden formar el modo de calidad baja (Fase 3, PR 3).
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    widget.scene.msaaSamples = quality.msaa;
    widget.scene.globe.showGroundAtmosphere = quality.atmosphere;
    if (widget.scene.skyAtmosphere) widget.scene.skyAtmosphere.show = quality.atmosphere;
    widget.resolutionScale = quality.scale;
    widget.scene.requestRender();
  }, [quality]);

  const changeQuality = (changes: Partial<typeof quality>) => {
    setQuality((current) => ({ ...current, ...changes }));
    setSamples([]);
  };

  const average = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
  const minimum = samples.length ? Math.min(...samples) : null;
  const summary =
    average === null
      ? ""
      : `TerraMova · rendimiento del globo\nPuntos: ${count}\nGiro: ${spinning ? "sí" : "no"}\n` +
        `MSAA: ${quality.msaa}x · Atmósfera: ${quality.atmosphere ? "sí" : "no"} · ` +
        `Resolución: ${Math.round(quality.scale * 100)} %\n` +
        `fps medio (${samples.length} s): ${average.toFixed(1)} · mínimo: ${minimum}\n${environment}`;

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="relative h-[calc(100dvh-56px)] bg-background">
      <div ref={containerRef} className="absolute inset-0" />
      <section
        aria-label="Laboratorio de rendimiento"
        className="absolute top-4 left-4 w-[340px] rounded-lg border border-border bg-surface/95 p-4 text-sm"
      >
        <h1 className="text-base font-semibold">Laboratorio de rendimiento</h1>
        <p className="mt-1 text-xs text-warning">
          Solo desarrollo · puntos sintéticos aleatorios, no son sismos.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-[10px] border border-border-subtle p-1">
          {COUNTS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={count === option}
              onClick={() => {
                setCount(option);
                setSamples([]);
              }}
              className={cn(
                "h-9 cursor-pointer rounded-sm text-[13px]",
                count === option ? "bg-selected font-medium" : "text-muted-foreground",
              )}
            >
              {formatCount(option)}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={spinning}
            onChange={(event) => setSpinning(event.target.checked)}
          />
          Girar sin parar (peor caso)
        </label>
        <fieldset className="mt-3 flex flex-col gap-1.5 text-[13px]">
          <legend className="mb-1 text-xs text-muted-foreground">Calidad</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quality.msaa > 1}
              onChange={(event) => changeQuality({ msaa: event.target.checked ? 4 : 1 })}
            />
            Antialiasing MSAA ×4
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quality.atmosphere}
              onChange={(event) => changeQuality({ atmosphere: event.target.checked })}
            />
            Atmósfera
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quality.scale < 1}
              onChange={(event) => changeQuality({ scale: event.target.checked ? 0.75 : 1 })}
            />
            Resolución al 75 %
          </label>
        </fieldset>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[13px]">
          <dt className="text-muted-foreground">fps medio</dt>
          <dd aria-live="polite">{average === null ? "midiendo…" : average.toFixed(1)}</dd>
          <dt className="text-muted-foreground">fps mínimo</dt>
          <dd>{minimum ?? "—"}</dd>
          <dt className="text-muted-foreground">muestras</dt>
          <dd>
            {samples.length} / {WINDOW_SECONDS} s
          </dd>
        </dl>
        <pre className="mt-3 text-[11px] whitespace-pre-wrap text-muted-foreground">
          {environment}
        </pre>
        <button
          type="button"
          disabled={!summary}
          onClick={() => void copy()}
          className="mt-3 h-9 w-full cursor-pointer rounded-md border border-border bg-surface-raised text-[13px] disabled:opacity-50"
        >
          {copied ? "Copiado" : "Copiar resultado"}
        </button>
      </section>
      <p className="absolute right-4 bottom-4 text-[11px] text-muted-foreground">
        <span ref={creditsRef} className="terramova-credits" /> · Motor: CesiumJS
      </p>
    </main>
  );
}

/** Puntos aleatorios reproducibles (semilla fija) repartidos uniformemente por la esfera. */
function syntheticPoints(count: number): GlobePoint[] {
  let seed = 20261022;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({
    id: `sintetico-${index}`,
    longitude: random() * 360 - 180,
    latitude: (Math.asin(2 * random() - 1) * 180) / Math.PI,
    magnitude: 1 + random() * 6,
    depthKm: random() * 650,
    // Antiguos a propósito: el laboratorio mide los puntos, no las ondas.
    occurredAtMs: 0,
  }));
}

function describeEnvironment(): string {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  let renderer = "desconocida";
  if (gl) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = String(
      info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
  }
  return [
    `GPU: ${renderer}`,
    `Pantalla: ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}x`,
    `Navegador: ${navigator.userAgent}`,
  ].join("\n");
}

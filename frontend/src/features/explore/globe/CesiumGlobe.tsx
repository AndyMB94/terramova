import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  type CesiumWidget,
  Math as CesiumMath,
  SceneMode,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";
import { Minus, Pause, Play, Plus } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { GlobeApiRef } from "@/features/explore/globe/controller";
import { SELECTION_FLIGHT_SECONDS } from "@/features/explore/globe/effects";
import { longitudeForScreenOffset, rectangleToBbox } from "@/features/explore/globe/geometry";
import { GlobeMotion } from "@/features/explore/globe/motion";
import { EventPointLayer, type GlobePoint } from "@/features/explore/globe/points";
import {
  LOW_FPS_THRESHOLD,
  parseQualityChoice,
  QUALITY_CHOICES,
  QUALITY_PROFILES,
  type QualityChoice,
  type QualityLevel,
  resolveQuality,
} from "@/features/explore/globe/quality";
import { RippleLayer } from "@/features/explore/globe/ripples";
import { addBorders, createGlobe, HOME } from "@/features/explore/globe/viewer";
import { readPreference, readSession, writePreference, writeSession } from "@/shared/lib/storage";
import { cn } from "@/shared/lib/utils";

export interface CesiumGlobeProps {
  points: readonly GlobePoint[];
  selectedId: string | undefined;
  /** Centra la cámara en un evento; `nonce` permite repetir la misma petición. */
  focus: { id: string; nonce: number } | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  /** Píxeles tapados a la derecha (ficha flotante): los vuelos centran en la zona libre. */
  rightInsetPx: number;
  apiRef: GlobeApiRef;
  onUnavailable: () => void;
}

const MORPH_SECONDS = 1;
const KEY_ROTATION = CesiumMath.toRadians(4);
const HOVER_PICK_MS = 80;
const RIPPLE_REFRESH_MS = 60_000;
const SELECTION_MAX_HEIGHT_M = 9_000_000;

const INTRO_KEY = "terramova:intro";
const AUTO_QUALITY_KEY = "terramova:quality-auto";
const QUALITY_KEY = "terramova:quality";
const SPIN_KEY = "terramova:spin";

const QUALITY_LABELS: Record<QualityChoice, string> = {
  auto: "Automática",
  high: "Alta",
  low: "Baja",
};

/** En automático: baja si ya se midió en esta pestaña o en pantallas táctiles (móvil). */
function initialAutoLevel(): QualityLevel {
  if (readSession(AUTO_QUALITY_KEY) === "low") return "low";
  return window.matchMedia("(pointer: coarse)").matches ? "low" : "high";
}

export default function CesiumGlobe(props: CesiumGlobeProps) {
  const { points, selectedId, focus, reducedMotion, apiRef } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLSpanElement>(null);
  const widgetRef = useRef<CesiumWidget | null>(null);
  const layerRef = useRef<EventPointLayer | null>(null);
  const ripplesRef = useRef<RippleLayer | null>(null);
  const motionRef = useRef<GlobeMotion | null>(null);
  const qualityId = useId();
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [qualityChoice, setQualityChoice] = useState<QualityChoice>(() =>
    parseQualityChoice(readPreference(QUALITY_KEY)),
  );
  const [autoLevel, setAutoLevel] = useState<QualityLevel>(initialAutoLevel);
  const [spinPaused, setSpinPaused] = useState(() => readPreference(SPIN_KEY) === "paused");
  const [fps, setFps] = useState<number | null>(null);
  const quality = resolveQuality(qualityChoice, autoLevel);

  const callbacks = useRef<{
    onSelect: (id: string) => void;
    onUnavailable: () => void;
    onFps: (fps: number) => void;
  }>({ onSelect: props.onSelect, onUnavailable: props.onUnavailable, onFps: () => {} });
  useEffect(() => {
    callbacks.current = {
      onSelect: props.onSelect,
      onUnavailable: props.onUnavailable,
      onFps: (measured: number) => {
        if (import.meta.env.DEV) setFps(measured);
        // Solo se baja: volver a subir sola haría que la calidad oscilara.
        if (qualityChoice === "auto" && autoLevel === "high" && measured < LOW_FPS_THRESHOLD) {
          writeSession(AUTO_QUALITY_KEY, "low");
          setAutoLevel("low");
        }
      },
    };
  });
  // Valores iniciales para el efecto de montaje, que no debe repetirse al cambiar.
  const inset = useRef(props.rightInsetPx);
  useEffect(() => {
    inset.current = props.rightInsetPx;
  });
  const initial = useRef<{
    reducedMotion: boolean;
    selectedId: string | undefined;
    playIntro: boolean | null;
  }>({ reducedMotion, selectedId, playIntro: null });
  // Vuelo pendiente al evento del enlace; se activa en cada creación del visor.
  const deepLinkPending = useRef(false);

  // El visor se crea UNA vez y se destruye al desmontar (libera WebGL y listeners). Los
  // efectos siguientes se declaran después: en cada montaje corren con el visor ya creado.
  useEffect(() => {
    const container = containerRef.current;
    const credits = creditsRef.current;
    if (!container || !credits) return;

    let widget: CesiumWidget;
    try {
      widget = createGlobe(container, credits);
    } catch (error) {
      console.warn("No se pudo crear el globo", error);
      callbacks.current.onUnavailable();
      return;
    }
    widgetRef.current = widget;
    // Las ondas primero: así quedan dibujadas bajo los puntos.
    const ripples = new RippleLayer(widget.scene);
    ripplesRef.current = ripples;
    layerRef.current = new EventPointLayer(widget.scene);
    const motion = new GlobeMotion({
      widget,
      ripples,
      host: container,
      onFps: (measured) => callbacks.current.onFps(measured),
    });
    motionRef.current = motion;
    motion.reducedMotion = initial.current.reducedMotion;
    // Una vez por pestaña; si el enlace trae un evento, el vuelo a ese evento la sustituye.
    // Se decide en el primer montaje y se guarda: React en modo estricto monta dos veces.
    if (initial.current.playIntro === null) {
      initial.current.playIntro = readSession(INTRO_KEY) !== "done" && !initial.current.selectedId;
      writeSession(INTRO_KEY, "done");
    }
    motion.playIntro(HOME, initial.current.playIntro);
    deepLinkPending.current = initial.current.selectedId !== undefined;

    const borders = new AbortController();
    addBorders(widget, borders.signal).catch((error: unknown) => {
      if (!borders.signal.aborted) console.warn("No se pudieron cargar las fronteras", error);
    });

    const handler = new ScreenSpaceEventHandler(widget.scene.canvas);
    const pickId = (position: Cartesian2): string | undefined => {
      const picked: unknown = widget.scene.pick(position);
      const id = (picked as { id?: unknown } | undefined)?.id;
      return typeof id === "string" ? id : undefined;
    };
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const id = pickId(click.position);
      if (id) callbacks.current.onSelect(id);
    }, ScreenSpaceEventType.LEFT_CLICK);
    let lastHover = 0;
    handler.setInputAction((move: { endPosition: Cartesian2 }) => {
      const now = performance.now();
      if (now - lastHover < HOVER_PICK_MS) return;
      lastHover = now;
      widget.scene.canvas.style.cursor = pickId(move.endPosition) ? "pointer" : "";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    apiRef.current = {
      getViewBbox: () => {
        const rect = widget.camera.computeViewRectangle();
        if (!rect) return null;
        return rectangleToBbox({
          west: CesiumMath.toDegrees(rect.west),
          south: CesiumMath.toDegrees(rect.south),
          east: CesiumMath.toDegrees(rect.east),
          north: CesiumMath.toDegrees(rect.north),
        });
      },
    };

    return () => {
      borders.abort();
      apiRef.current = null;
      handler.destroy();
      motion.destroy();
      motionRef.current = null;
      ripples.destroy();
      ripplesRef.current = null;
      layerRef.current?.destroy();
      layerRef.current = null;
      widgetRef.current = null;
      widget.destroy();
    };
  }, [apiRef]);

  useEffect(() => {
    layerRef.current?.update(points);
    const ripples = ripplesRef.current;
    if (!ripples) return;
    ripples.update(points, Date.now());
    // Las ondas son de la última hora: se recalculan cada minuto aunque no lleguen datos.
    const interval = window.setInterval(
      () => ripples.update(points, Date.now()),
      RIPPLE_REFRESH_MS,
    );
    return () => window.clearInterval(interval);
  }, [points]);

  useEffect(() => {
    layerRef.current?.select(selectedId ?? null);
    if (motionRef.current) motionRef.current.hasSelection = selectedId !== undefined;
  }, [selectedId, points]);

  // Enlace con un evento seleccionado: al llegar los puntos se vuela a él (una vez).
  useEffect(() => {
    const id = initial.current.selectedId;
    const point = id ? layerRef.current?.position(id) : undefined;
    if (!deepLinkPending.current || !point) return;
    deepLinkPending.current = false;
    flyToPoint(widgetRef.current, motionRef.current, point, inset.current);
  }, [points]);

  useEffect(() => {
    const point = focus ? layerRef.current?.position(focus.id) : undefined;
    if (point) flyToPoint(widgetRef.current, motionRef.current, point, inset.current);
  }, [focus]);

  useEffect(() => {
    const motion = motionRef.current;
    if (motion) motion.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (motionRef.current) motionRef.current.spinPaused = spinPaused;
  }, [spinPaused]);

  // Perfil de calidad (D85) y ondas animadas solo si la calidad y el movimiento lo permiten.
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    const profile = QUALITY_PROFILES[quality];
    const { scene } = widget;
    scene.msaaSamples = profile.msaaSamples;
    scene.globe.showGroundAtmosphere = profile.atmosphere;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = profile.atmosphere;
    widget.resolutionScale = profile.resolutionScale;
    const base = widget.imageryLayers.get(0);
    if (base) {
      base.brightness = profile.imageryBrightness;
      base.saturation = profile.imagerySaturation;
      base.gamma = profile.imageryGamma;
    }
    ripplesRef.current?.setAnimated(profile.animatedRipples && !reducedMotion);
    scene.requestRender();
  }, [quality, reducedMotion]);

  const changeQuality = (choice: QualityChoice) => {
    setQualityChoice(choice);
    writePreference(QUALITY_KEY, choice === "auto" ? null : choice);
  };

  const toggleSpin = () => {
    setSpinPaused((paused) => {
      writePreference(SPIN_KEY, paused ? null : "paused");
      return !paused;
    });
  };

  const zoom = (direction: 1 | -1) => {
    const widget = widgetRef.current;
    if (!widget) return;
    motionRef.current?.takeControl();
    const amount = widget.camera.positionCartographic.height * 0.35;
    if (direction > 0) widget.camera.zoomIn(amount);
    else widget.camera.zoomOut(amount);
    widget.scene.requestRender();
  };

  const changeMode = (next: "3d" | "2d") => {
    const widget = widgetRef.current;
    if (!widget || next === mode) return;
    motionRef.current?.takeControl();
    const { scene, camera } = widget;
    // Cesium reinicia la cámara al cambiar de modo: se guarda el centro de la vista y se
    // restaura al terminar la transición para no perder la zona que se estaba mirando.
    const canvas = scene.canvas;
    const center = camera.pickEllipsoid(
      new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
    );
    const target = center ? Cartographic.fromCartesian(center) : undefined;
    const height = Math.min(camera.positionCartographic.height, 20_000_000);
    const restore = scene.morphComplete.addEventListener(() => {
      restore();
      if (!target) return;
      camera.setView({
        destination: Cartesian3.fromRadians(target.longitude, target.latitude, height),
      });
      scene.requestRender();
    });
    const duration = reducedMotion ? 0 : MORPH_SECONDS;
    if (next === "2d") scene.morphTo2D(duration);
    else scene.morphTo3D(duration);
    setMode(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const widget = widgetRef.current;
    if (!widget) return;
    const { camera, scene } = widget;
    const in2d = scene.mode === SceneMode.SCENE2D;
    const step = camera.positionCartographic.height * 0.1;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => (in2d ? camera.moveLeft(step) : camera.rotateLeft(KEY_ROTATION)),
      ArrowRight: () => (in2d ? camera.moveRight(step) : camera.rotateRight(KEY_ROTATION)),
      ArrowUp: () => (in2d ? camera.moveUp(step) : camera.rotateUp(KEY_ROTATION)),
      ArrowDown: () => (in2d ? camera.moveDown(step) : camera.rotateDown(KEY_ROTATION)),
      "+": () => zoom(1),
      "=": () => zoom(1),
      "-": () => zoom(-1),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
    scene.requestRender();
  };

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-roledescription="globo"
        aria-label="Globo con los eventos del periodo. Arrastra o usa las flechas para girar y + o − para acercar. La lista contiene los mismos eventos."
        data-quality={quality}
        onKeyDown={onKeyDown}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      />

      <div className="absolute top-3 left-3 flex flex-col items-start gap-2 lg:top-4 lg:left-4">
        <div className="flex flex-wrap gap-2">
          <div
            role="group"
            aria-label="Vista del mapa"
            className="flex gap-1 rounded-[10px] border border-border bg-surface/95 p-1"
          >
            {(["3d", "2d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => changeMode(option)}
                className={cn(
                  "h-9 min-w-11 cursor-pointer rounded-sm px-3 text-[13px]",
                  mode === option
                    ? "bg-selected font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "3d" ? "Globo 3D" : "Mapa 2D"}
              </button>
            ))}
          </div>
          {/* WCAG 2.2.2: el giro automático siempre se puede pausar. */}
          {!reducedMotion && mode === "3d" ? (
            <button
              type="button"
              aria-pressed={spinPaused}
              onClick={toggleSpin}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface/95 px-3 text-[13px] lg:h-[46px]"
            >
              {spinPaused ? (
                <Play aria-hidden="true" className="size-4" />
              ) : (
                <Pause aria-hidden="true" className="size-4" />
              )}
              {/* En móvil solo el icono; el nombre sigue disponible para lectores de pantalla. */}
              <span className="max-sm:sr-only">{spinPaused ? "Reanudar giro" : "Pausar giro"}</span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface/95 py-1 pr-1 pl-3 text-[13px] max-sm:pl-1">
          <label htmlFor={qualityId} className="text-muted-foreground max-sm:sr-only">
            Calidad
          </label>
          <select
            id={qualityId}
            value={qualityChoice}
            onChange={(event) => changeQuality(parseQualityChoice(event.target.value))}
            className="h-8 cursor-pointer rounded-sm bg-surface px-1 text-[13px] text-foreground"
          >
            {QUALITY_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice === "auto"
                  ? `${QUALITY_LABELS.auto} (${quality === "high" ? "alta" : "baja"})`
                  : QUALITY_LABELS[choice]}
              </option>
            ))}
          </select>
        </div>
        {import.meta.env.DEV && fps !== null ? (
          <p className="rounded-sm bg-surface/95 px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {fps.toFixed(1)} fps · solo desarrollo
          </p>
        ) : null}
      </div>

      <div className="absolute top-3 right-3 flex flex-col gap-2 lg:top-4 lg:right-4">
        <button
          type="button"
          aria-label="Acercar"
          onClick={() => zoom(1)}
          className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-border bg-surface/95 lg:size-10"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Alejar"
          onClick={() => zoom(-1)}
          className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-border bg-surface/95 lg:size-10"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
      </div>

      <p className="pointer-events-none absolute right-2 bottom-2 max-w-[45%] rounded-sm bg-surface/85 px-1.5 py-0.5 text-right text-[11px] leading-snug text-muted-foreground lg:right-4 lg:bottom-4 lg:max-w-[calc(100%-300px)]">
        <span ref={creditsRef} className="terramova-credits pointer-events-auto" /> · Fronteras:
        Natural Earth · Datos: USGS · Motor: CesiumJS
      </p>
    </div>
  );
}

function flyToPoint(
  widget: CesiumWidget | null,
  motion: GlobeMotion | null,
  point: GlobePoint,
  insetPx: number,
): void {
  if (!widget || !motion) return;
  const { camera, canvas } = widget;
  const height = Math.min(camera.positionCartographic.height, SELECTION_MAX_HEIGHT_M);
  const fovy = (camera.frustum as { fovy?: number }).fovy;
  // Con la ficha a la derecha, el punto se deja en el centro de la parte visible.
  const longitude =
    fovy === undefined
      ? point.longitude
      : longitudeForScreenOffset({
          longitude: point.longitude,
          latitude: point.latitude,
          heightM: height,
          offsetPx: insetPx / 2,
          canvasHeightPx: canvas.clientHeight,
          fovyRadians: fovy,
        });
  motion.flyTo({ longitude, latitude: point.latitude, height }, SELECTION_FLIGHT_SECONDS);
}

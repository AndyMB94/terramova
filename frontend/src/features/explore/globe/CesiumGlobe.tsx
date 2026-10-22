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
import { Minus, Plus } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { GlobeApiRef } from "@/features/explore/globe/controller";
import { rectangleToBbox } from "@/features/explore/globe/geometry";
import { EventPointLayer, type GlobePoint } from "@/features/explore/globe/points";
import { addBorders, createGlobe } from "@/features/explore/globe/viewer";
import { cn } from "@/shared/lib/utils";

export interface CesiumGlobeProps {
  points: readonly GlobePoint[];
  selectedId: string | undefined;
  /** Centra la cámara en un evento; `nonce` permite repetir la misma petición. */
  focus: { id: string; nonce: number } | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  apiRef: GlobeApiRef;
  onUnavailable: () => void;
}

const MORPH_SECONDS = 1;
const KEY_ROTATION = CesiumMath.toRadians(4);
const HOVER_PICK_MS = 80;

export default function CesiumGlobe(props: CesiumGlobeProps) {
  const { points, selectedId, focus, reducedMotion, apiRef } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLSpanElement>(null);
  const widgetRef = useRef<CesiumWidget | null>(null);
  const layerRef = useRef<EventPointLayer | null>(null);
  const callbacks = useRef({ onSelect: props.onSelect, onUnavailable: props.onUnavailable });
  const [mode, setMode] = useState<"3d" | "2d">("3d");

  useEffect(() => {
    callbacks.current = { onSelect: props.onSelect, onUnavailable: props.onUnavailable };
  });

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
    layerRef.current = new EventPointLayer(widget.scene);

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
      layerRef.current?.destroy();
      layerRef.current = null;
      widgetRef.current = null;
      widget.destroy();
    };
  }, [apiRef]);

  useEffect(() => {
    layerRef.current?.update(points);
  }, [points]);

  useEffect(() => {
    layerRef.current?.select(selectedId ?? null);
  }, [selectedId, points]);

  useEffect(() => {
    const widget = widgetRef.current;
    const point = focus ? layerRef.current?.position(focus.id) : undefined;
    if (!widget || !point) return;
    const height = Math.min(widget.camera.positionCartographic.height, 9_000_000);
    // Centrado instantáneo; el vuelo animado llega con el sistema de movimiento (PR 3).
    widget.camera.flyTo({
      destination: Cartesian3.fromDegrees(point.longitude, point.latitude, height),
      duration: 0,
    });
  }, [focus]);

  const zoom = (direction: 1 | -1) => {
    const widget = widgetRef.current;
    if (!widget) return;
    const amount = widget.camera.positionCartographic.height * 0.35;
    if (direction > 0) widget.camera.zoomIn(amount);
    else widget.camera.zoomOut(amount);
    widget.scene.requestRender();
  };

  const changeMode = (next: "3d" | "2d") => {
    const widget = widgetRef.current;
    if (!widget || next === mode) return;
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
        onKeyDown={onKeyDown}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      />

      <div
        role="group"
        aria-label="Vista del mapa"
        className="absolute top-3 left-3 flex gap-1 rounded-[10px] border border-border bg-surface/95 p-1 lg:top-4 lg:left-4"
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

      <p className="pointer-events-none absolute right-2 bottom-2 max-w-[45%] text-right text-[11px] leading-snug text-muted-foreground lg:right-4 lg:bottom-4 lg:max-w-[calc(100%-300px)]">
        <span ref={creditsRef} className="terramova-credits pointer-events-auto" /> · Fronteras:
        Natural Earth · Datos: USGS · Motor: CesiumJS
      </p>
    </div>
  );
}

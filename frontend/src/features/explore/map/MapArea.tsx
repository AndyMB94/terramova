import { lazy, type ReactNode, Suspense } from "react";

import type { GlobeApiRef } from "@/features/explore/globe/controller";
import type { GlobePoint } from "@/features/explore/globe/points";
import { DEPTH_CLASSES } from "@/shared/lib/depth";

// Cesium (~1 MB comprimido) se carga en un fragmento aparte, solo cuando hace falta.
const CesiumGlobe = lazy(() => import("@/features/explore/globe/CesiumGlobe"));

interface MapAreaProps {
  points: readonly GlobePoint[];
  selectedId: string | undefined;
  focus: { id: string; nonce: number } | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  rightInsetPx: number;
  apiRef: GlobeApiRef;
  /** La página decide si hay globo (WebGL) y se entera si Cesium falla al crearse. */
  available: boolean;
  onUnavailable: () => void;
  children?: ReactNode;
}

export function MapArea({ children, available, onUnavailable, ...globe }: MapAreaProps) {
  return (
    <div className="relative h-full min-h-[312px] bg-background">
      {available ? (
        <Suspense fallback={<Notice title="Cargando el globo…" />}>
          <CesiumGlobe {...globe} onUnavailable={onUnavailable} />
        </Suspense>
      ) : (
        <Notice
          title="Este navegador no puede mostrar el globo"
          detail="WebGL no está disponible. La lista muestra los mismos eventos con sus coordenadas y profundidad."
        />
      )}
      <DepthLegend />
      {children}
    </div>
  );
}

function Notice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-tertiary">{title}</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function DepthLegend() {
  return (
    <figure className="absolute bottom-3 left-3 w-[248px] rounded-lg border border-border bg-surface/95 p-3.5 max-sm:w-[150px] max-sm:p-2.5 lg:bottom-4 lg:left-4">
      <figcaption className="mb-2 text-xs font-medium text-tertiary">Profundidad</figcaption>
      <ul className="grid grid-cols-5 gap-[3px]">
        {DEPTH_CLASSES.map((item) => (
          <li
            key={item.label}
            className="h-2.5 rounded-[3px]"
            style={{ backgroundColor: item.cssVar }}
          >
            <span className="sr-only">{item.label}</span>
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="tabular mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground"
      >
        <span>0</span>
        <span className="max-sm:hidden">35</span>
        <span>70</span>
        <span className="max-sm:hidden">150</span>
        <span>300+ km</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground max-sm:hidden">
        Tamaño según magnitud (escala visual, no proporcional a la energía).
      </p>
    </figure>
  );
}

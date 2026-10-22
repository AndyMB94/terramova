import type { ReactNode } from "react";

import { DEPTH_CLASSES } from "@/shared/lib/depth";

/**
 * Zona del globo. En esta entrega aún no hay mapa: se muestra un aviso honesto en vez de
 * una imagen que aparente datos. El globo Cesium la sustituye en el siguiente PR.
 */
export function MapArea({ children }: { children?: ReactNode }) {
  return (
    <div className="relative h-full min-h-[312px] bg-[radial-gradient(circle_at_50%_46%,color-mix(in_oklab,var(--tm-surface)_70%,transparent)_0%,var(--tm-background)_62%)]">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-tertiary">
            El globo interactivo está en preparación
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mientras tanto, la lista muestra los mismos eventos con sus coordenadas y profundidad.
          </p>
        </div>
      </div>
      <DepthLegend />
      {children}
    </div>
  );
}

function DepthLegend() {
  return (
    <figure className="absolute bottom-3 left-3 w-[248px] rounded-lg border border-border bg-surface/95 p-3.5 max-sm:w-[180px] max-sm:p-2.5 lg:bottom-4 lg:left-4">
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
        <span>35</span>
        <span>70</span>
        <span>150</span>
        <span>300+ km</span>
      </div>
    </figure>
  );
}

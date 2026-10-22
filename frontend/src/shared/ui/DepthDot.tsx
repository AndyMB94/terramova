import { depthClass } from "@/shared/lib/depth";
import { cn } from "@/shared/lib/utils";

/** Punto de color según la profundidad; decorativo, el valor numérico va siempre al lado. */
export function DepthDot({ depthKm, className }: { depthKm: number | null; className?: string }) {
  const depth = depthClass(depthKm);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/30",
        !depth && "bg-muted-foreground/40",
        className,
      )}
      style={depth ? { backgroundColor: depth.cssVar } : undefined}
    />
  );
}

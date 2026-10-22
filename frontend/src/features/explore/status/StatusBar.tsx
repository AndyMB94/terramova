import { Link } from "react-router";

import type { Meta } from "@/features/explore/api/queries";
import { formatDateRange, formatRelative } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

interface StatusBarProps {
  meta: Meta | undefined;
  status: "pending" | "error" | "success";
  now?: Date;
}

/** Frescura y cobertura de los datos: siempre visibles (docs/UI_UX.md, Estados obligatorios). */
export function StatusBar({ meta, status, now = new Date() }: StatusBarProps) {
  const lastSync = meta?.last_successful_sync_at;
  const stale =
    meta !== undefined &&
    (meta.is_stale ||
      !lastSync ||
      now.getTime() - new Date(lastSync).getTime() > meta.stale_after_seconds * 1000);

  return (
    <footer className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-border-subtle bg-panel px-4 py-1.5 text-xs text-muted-foreground lg:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1" role="status" aria-live="polite">
        {status === "pending" ? <span>Comprobando el estado de los datos…</span> : null}
        {status === "error" ? (
          <span className="flex items-center gap-1.5 text-tertiary">
            <Dot className="bg-warning" />
            Estado de los datos no disponible
          </span>
        ) : null}
        {meta ? (
          <>
            <span
              className={cn("flex items-center gap-1.5", stale ? "text-warning" : "text-tertiary")}
            >
              <Dot className={stale ? "bg-warning" : "bg-success"} />
              {stale ? "Datos desactualizados" : "Datos al día"}
            </span>
            <span>
              Última sincronización:{" "}
              <span className="tabular font-mono">
                {lastSync ? formatRelative(lastSync, now) : "ninguna todavía"}
              </span>
            </span>
            <span>
              Cobertura:{" "}
              <span className="tabular font-mono">
                {meta.coverage
                  ? formatDateRange(meta.coverage.start, meta.coverage.end)
                  : "sin datos"}
              </span>
            </span>
          </>
        ) : null}
      </div>
      <Link
        to="/acerca"
        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Fuente: {meta?.source.name ?? "USGS"} · créditos
      </Link>
    </footer>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 rounded-full", className)} />;
}

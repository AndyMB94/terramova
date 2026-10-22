import { ExternalLink, X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";

import type { Earthquake } from "@/features/explore/api/queries";
import { FavoriteButton } from "@/features/favorites";
import { userMessage } from "@/shared/api/errors";
import {
  formatCoordinates,
  formatDepth,
  formatEventType,
  formatLocalDateTime,
  formatMagnitude,
  formatPlace,
  formatStatus,
  formatUtcDateTime,
  utcOffsetLabel,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { DepthDot } from "@/shared/ui/DepthDot";

interface EventDetailProps {
  event: Earthquake | undefined;
  status: "pending" | "error" | "success";
  error: unknown;
  onClose: () => void;
  className?: string;
}

export function EventDetail({ event, status, error, onClose, className }: EventDetailProps) {
  const headingId = useId();

  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "animate-panel-in flex flex-col gap-3.5 rounded-lg border border-border bg-surface/[.97] p-[18px] shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {status === "success" && event ? (
        <DetailContent event={event} headingId={headingId} onClose={onClose} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <h3 id={headingId} className="text-[15px] font-medium" aria-live="polite">
            {status === "pending" ? "Cargando evento…" : userMessage(error)}
          </h3>
          <CloseButton onClose={onClose} />
        </div>
      )}
    </section>
  );
}

function DetailContent({
  event,
  headingId,
  onClose,
}: {
  event: Earthquake;
  headingId: string;
  onClose: () => void;
}) {
  const offset = utcOffsetLabel(new Date(event.occurred_at));
  const eventType = event.event_type ?? "";
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="tabular font-mono text-3xl font-medium tracking-tight">
              M {formatMagnitude(event.magnitude)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{event.magnitude_type}</span>
          </p>
          <h3 id={headingId} className="mt-1 text-[15px] font-medium">
            {formatPlace(event.place ?? "")}
          </h3>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <Field label={`Hora local (${offset})`} mono>
          <DateTimeLines value={formatLocalDateTime(event.occurred_at)} />
        </Field>
        <Field label="UTC" mono>
          <DateTimeLines value={formatUtcDateTime(event.occurred_at)} />
        </Field>
        <Field label="Profundidad" mono>
          <span className="flex items-center gap-1.5">
            <DepthDot depthKm={event.depth_km} />
            {formatDepth(event.depth_km)}
          </span>
        </Field>

        <Field label="Estado">{formatStatus(event.status ?? "")}</Field>
        <Field label="Coordenadas" mono wide>
          {formatCoordinates(event.latitude, event.longitude)}
        </Field>
        <Field label="Identificador" mono>
          {event.external_id}
        </Field>
        {eventType && eventType !== "earthquake" ? (
          <Field label="Tipo">{formatEventType(eventType)}</Field>
        ) : null}
      </dl>

      <p className="rounded-md bg-panel px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        La magnitud mide la energía liberada en el foco; no indica la intensidad sentida ni los
        daños.
      </p>

      <FavoriteButton
        event={{
          id: event.id,
          place: event.place ?? "",
          magnitude: event.magnitude,
          occurred_at: event.occurred_at,
        }}
      />

      {event.source_url ? (
        <a
          href={event.source_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          Ver en USGS
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
      ) : null}
    </>
  );
}

function Field({
  label,
  mono,
  wide,
  children,
}: {
  label: string;
  mono?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5", mono && "tabular font-mono")}>{children}</dd>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      size="icon"
      aria-label="Cerrar detalle"
      onClick={onClose}
      className="shrink-0 text-tertiary"
    >
      <X aria-hidden="true" className="size-4" />
    </Button>
  );
}

/** "20 oct 2026, 12:05:48" → fecha y hora en dos líneas, para que no se corten a mitad. */
function DateTimeLines({ value }: { value: string }) {
  const [date, time] = value.split(", ");
  return (
    <>
      <span className="block">{date}</span>
      {time ? <span className="block">{time}</span> : null}
    </>
  );
}

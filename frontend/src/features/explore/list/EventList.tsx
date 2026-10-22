import { AlertTriangle } from "lucide-react";
import { useId } from "react";

import type { Earthquake } from "@/features/explore/api/queries";
import type { Order } from "@/features/explore/filters/schema";
import { userMessage } from "@/shared/api/errors";
import {
  formatCount,
  formatDepth,
  formatMagnitude,
  formatPlace,
  formatRelative,
  formatShortLocal,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { DepthDot } from "@/shared/ui/DepthDot";
import { useImmediateValue } from "@/features/explore/filters/useImmediateValue";

interface EventListProps {
  events: Earthquake[];
  status: "pending" | "error" | "success";
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  selectedId: string | undefined;
  order: Order;
  onOrderChange: (order: Order) => void;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onReset: () => void;
}

export function EventList(props: EventListProps) {
  const { events, status, hasMore, selectedId, order } = props;
  const orderId = useId();
  const [shownOrder, setShownOrder] = useImmediateValue(order);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 lg:px-5">
        <div>
          <h2 id={headingId} className="text-[15px] font-semibold">
            Eventos
          </h2>
          {status === "success" ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              <span className="tabular font-mono">{formatCount(events.length)}</span>
              {hasMore ? " cargados · hay más" : events.length === 1 ? " evento" : " eventos"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label htmlFor={orderId}>Orden</label>
          <select
            id={orderId}
            value={shownOrder}
            onChange={(event) => {
              const next = event.target.value as Order;
              setShownOrder(next);
              props.onOrderChange(next);
            }}
            className="h-10 rounded-md border border-border bg-surface px-2 text-[13px] text-foreground lg:h-9"
          >
            <option value="magnitude">Mayor magnitud</option>
            <option value="recent">Más recientes</option>
          </select>
        </div>
      </div>

      {status === "pending" ? <ListSkeleton /> : null}

      {status === "error" ? (
        <div
          role="alert"
          className="mx-4 flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <p className="flex items-center gap-2 text-sm">
            <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
            {userMessage(props.error)}
          </p>
          <Button variant="solid" size="sm" onClick={props.onRetry}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {status === "success" && events.length === 0 ? (
        <div className="mx-4 flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">
            No hay eventos registrados con estos filtros en el periodo consultado.
          </p>
          <Button variant="solid" size="sm" onClick={props.onReset}>
            Restablecer filtros
          </Button>
        </div>
      ) : null}

      {status === "success" && events.length > 0 ? (
        <>
          <ol className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 lg:px-2.5">
            {events.map((event) => (
              <li key={event.id}>
                <EventRow
                  event={event}
                  selected={event.id === selectedId}
                  onSelect={props.onSelect}
                />
              </li>
            ))}
          </ol>
          {hasMore ? (
            <div className="px-4 pt-3 pb-4 lg:px-5">
              <Button
                variant="solid"
                className="w-full"
                disabled={props.loadingMore}
                onClick={props.onLoadMore}
              >
                {props.loadingMore ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: Earthquake;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const now = new Date();
  return (
    <button
      type="button"
      id={`event-${event.id}`}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
      className={cn(
        "flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-[var(--duration-fast)]",
        selected ? "border-primary bg-surface-raised" : "border-transparent hover:bg-surface",
      )}
    >
      <span className="tabular w-12 shrink-0 font-mono text-lg font-medium tracking-tight">
        {formatMagnitude(event.magnitude)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium">{formatPlace(event.place ?? "")}</span>
        <span className="tabular font-mono text-xs text-muted-foreground">
          {formatShortLocal(event.occurred_at)} · {formatRelative(event.occurred_at, now)}
        </span>
      </span>
      <span className="tabular flex items-center gap-1.5 font-mono text-xs text-tertiary">
        <DepthDot depthKm={event.depth_km} />
        {formatDepth(event.depth_km)}
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label="Cargando eventos"
      className="flex flex-col gap-0.5 px-2 lg:px-2.5"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="h-[60px] animate-pulse rounded-md bg-surface motion-reduce:animate-none"
        />
      ))}
    </ul>
  );
}

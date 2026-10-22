import { type ReactNode, useId, useState } from "react";

import { cn } from "@/shared/lib/utils";

interface ChartCardProps {
  title: string;
  description: ReactNode;
  /** Resumen en texto de lo que muestra la gráfica (lectores de pantalla). */
  summary: string;
  chart: ReactNode;
  table: ReactNode;
  note?: ReactNode;
}

/** Gráfica con su alternativa en tabla: toda cifra también se puede leer como texto. */
export function ChartCard({ title, description, summary, chart, table, note }: ChartCardProps) {
  const headingId = useId();
  const [asTable, setAsTable] = useState(false);

  return (
    <section
      aria-labelledby={headingId}
      className="animate-fade-in flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 lg:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-[15px] font-medium">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((current) => !current)}
          className={cn(
            "h-9 shrink-0 cursor-pointer rounded-md border border-border px-3 text-[13px]",
            asTable ? "bg-selected font-medium" : "bg-surface-raised text-tertiary",
          )}
        >
          Ver como tabla
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        <figure className="m-0">
          <figcaption className="sr-only">{summary}</figcaption>
          {chart}
        </figure>
      )}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

/** Tabla de datos con el estilo de la aplicación; `caption` describe su contenido. */
export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border-subtle text-xs text-muted-foreground">
          {headers.map((header, index) => (
            <th
              key={header}
              scope="col"
              className={cn("py-2 pr-3 font-medium", index > 0 && "text-right")}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular font-mono">
        {rows.map((row) => (
          <tr key={String(row[0])} className="border-b border-border-subtle last:border-0">
            {row.map((cell, index) => (
              <td key={index} className={cn("py-1.5 pr-3", index > 0 && "text-right")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

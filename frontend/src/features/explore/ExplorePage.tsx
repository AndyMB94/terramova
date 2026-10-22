// Pantalla inicial de la Fase 0. No muestra datos sísmicos: el globo, la lista y
// la conexión con la API llegan en las Fases 2–3.
export function ExplorePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
      <p className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
        En construcción · Fase 0
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">TerraMova</h1>
      <p className="max-w-prose text-base text-muted-foreground sm:text-lg">
        Explorador de actividad sísmica mundial con datos públicos del USGS. Todavía no hay datos
        conectados: esta página solo confirma que el entorno de desarrollo funciona.
      </p>
    </main>
  );
}

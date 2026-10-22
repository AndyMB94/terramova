import { Activity, Moon, Sun } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { usePreferences } from "@/shared/hooks/preferences-context";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-2 text-sm sm:px-3",
    isActive
      ? "bg-surface-raised font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );

export function AppShell() {
  const { reducedMotion, toggleMotion, theme, toggleTheme } = usePreferences();
  const motionLabel = reducedMotion ? "Movimiento: reducido" : "Movimiento: completo";
  // Explorar y Analítica comparten los filtros de la URL: cambiar de sección los conserva.
  const { search } = useLocation();

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-panel px-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-7">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="7" opacity="0.6" />
              <circle cx="12" cy="12" r="10.5" opacity="0.3" />
            </svg>
            <span className="max-sm:sr-only">TerraMova</span>
          </Link>
          <nav aria-label="Secciones" className="flex items-center gap-1">
            <NavLink to={{ pathname: "/", search }} end className={navLinkClass}>
              Explorar
            </NavLink>
            <NavLink to={{ pathname: "/analitica", search }} className={navLinkClass}>
              Analítica
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <NavLink to="/acerca" className={cn(navLinkClass, "hidden md:inline-flex")}>
            Fuentes y créditos
          </NavLink>
          <Button
            aria-pressed={reducedMotion}
            aria-label={`${motionLabel}. Cambiar`}
            onClick={toggleMotion}
            className="size-11 p-0 text-[13px] lg:size-auto lg:h-9 lg:px-3"
          >
            <Activity aria-hidden="true" className="size-4" />
            <span className="hidden lg:inline" aria-hidden="true">
              {motionLabel}
            </span>
          </Button>
          <Button
            size="icon"
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            onClick={toggleTheme}
            className="size-11 lg:size-9"
          >
            {theme === "dark" ? (
              <Moon aria-hidden="true" className="size-4" />
            ) : (
              <Sun aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>
      </header>
      <div id="contenido">
        <Outlet />
      </div>
    </div>
  );
}

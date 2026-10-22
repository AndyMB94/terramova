import { type ReactNode, useCallback, useEffect, useState } from "react";

import { readPreference, writePreference } from "@/shared/lib/storage";

import { PreferencesContext, type Theme } from "./preferences-context";
import { useMediaQuery } from "./useMediaQuery";

const MOTION_KEY = "terramova:motion";
const THEME_KEY = "terramova:theme";

type MotionChoice = "system" | "full" | "reduced";

/** Refleja las preferencias en <html data-motion data-theme> para CSS y efectos. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [motionChoice, setMotionChoice] = useState<MotionChoice>(() => {
    const stored = readPreference(MOTION_KEY);
    return stored === "full" || stored === "reduced" ? stored : "system";
  });
  const [theme, setTheme] = useState<Theme>(() =>
    readPreference(THEME_KEY) === "light" ? "light" : "dark",
  );
  const reducedMotion = motionChoice === "system" ? systemReduced : motionChoice === "reduced";

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleMotion = useCallback(() => {
    const next: MotionChoice = reducedMotion ? "full" : "reduced";
    setMotionChoice(next);
    writePreference(MOTION_KEY, next);
  }, [reducedMotion]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      writePreference(THEME_KEY, next);
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ reducedMotion, toggleMotion, theme, toggleTheme }}>
      {children}
    </PreferencesContext.Provider>
  );
}

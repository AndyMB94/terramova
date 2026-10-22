import { createContext, useContext } from "react";

export type Theme = "dark" | "light";

export interface Preferences {
  /** Movimiento reducido: interruptor propio o, si no se eligió, preferencia del sistema. */
  reducedMotion: boolean;
  toggleMotion: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

export const PreferencesContext = createContext<Preferences | null>(null);

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences debe usarse dentro de PreferencesProvider.");
  }
  return value;
}

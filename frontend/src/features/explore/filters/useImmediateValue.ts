import { useState } from "react";

/**
 * Valor que se muestra al instante al cambiarlo, aunque su fuente de verdad (la URL) se
 * actualice de forma asíncrona: React Router completa la navegación un momento después y,
 * mientras tanto, un control ligado solo a la URL se repintaría con el valor anterior.
 * Si la fuente cambia por otra vía (Restablecer, URL compartida), el valor la sigue.
 */
export function useImmediateValue<T>(source: T): [T, (value: T) => void] {
  const [shown, setShown] = useState(source);
  const [syncedSource, setSyncedSource] = useState(source);
  if (!Object.is(source, syncedSource)) {
    setSyncedSource(source);
    setShown(source);
  }
  return [shown, setShown];
}

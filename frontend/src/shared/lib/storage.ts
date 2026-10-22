// localStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado).
// Solo guarda preferencias de este navegador; la app funciona igual sin él.

export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la preferencia dura solo esta visita; no es un error.
  }
}

/** Igual que las preferencias, pero solo durante esta pestaña (sessionStorage). */
export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento de sesión se repetiría la intro al recargar; no es un error.
  }
}

/** Escribe y dice si funcionó: los favoritos necesitan saberlo (cuota llena, bloqueo). */
export function tryWritePreference(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Si el navegador permite guardar datos (no lo permite en algunos modos privados). */
export function isStorageAvailable(): boolean {
  const probe = "terramova:probe";
  try {
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

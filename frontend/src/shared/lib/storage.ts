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

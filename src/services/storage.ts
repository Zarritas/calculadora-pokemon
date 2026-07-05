/**
 * Persistencia de datos de usuario (builds, equipos) en localStorage.
 * A diferencia de `cache.ts` estos datos no caducan: son del usuario.
 * Las claves están versionadas para poder migrar el esquema en el futuro.
 */

const ROOT = 'pkmn-lib:'
const VERSION = 'v1'
const PREFIX = `${ROOT}${VERSION}:`

/** Lee una colección; devuelve [] si no existe o hay error de parseo. */
export function loadCollection<T>(name: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

/** Guarda una colección (silencioso si localStorage falla). */
export function saveCollection<T>(name: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(items))
  } catch {
    /* cuota/modo privado: se ignora */
  }
}

/** Identificador único para builds y equipos. */
export function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  }
}

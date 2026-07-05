/**
 * Caché en dos niveles para las respuestas de la API:
 *  1. Memoria (Map): instantánea durante la sesión.
 *  2. localStorage: persiste entre recargas, con TTL.
 *
 * Si localStorage falla (cuota llena, modo privado, SSR) se degrada
 * silenciosamente a solo-memoria: nunca rompe la app.
 */

const MEMORY = new Map<string, unknown>()

/** Raíz común de todas las claves (para poder purgar cualquier versión). */
const ROOT = 'pkmn-cache:'

/**
 * Versión del esquema de datos cacheados. Incrementar cuando cambie la forma
 * de los objetos guardados (p. ej. al pasar `abilities` de objeto a lista),
 * para invalidar automáticamente las entradas antiguas y forzar una recarga.
 */
const VERSION = 'v3'
const PREFIX = `${ROOT}${VERSION}:`

/** TTL por defecto: 7 días (los datos de PokéAPI son muy estables). */
export const DEFAULT_TTL = 1000 * 60 * 60 * 24 * 7

/** Elimina entradas de versiones antiguas del esquema al iniciar. */
function purgeOldVersions(): void {
  try {
    const stale = Object.keys(localStorage).filter(
      (k) => k.startsWith(ROOT) && !k.startsWith(PREFIX),
    )
    for (const k of stale) localStorage.removeItem(k)
  } catch {
    /* ignorar */
  }
}
purgeOldVersions()

interface Entry<T> {
  value: T
  /** Timestamp de expiración; null = no caduca. */
  expires: number | null
}

/** Lee de caché (memoria → localStorage). Devuelve null si no existe o caducó. */
export function readCache<T>(key: string): T | null {
  if (MEMORY.has(key)) return MEMORY.get(key) as T

  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null

    const entry = JSON.parse(raw) as Entry<T>
    if (entry.expires !== null && entry.expires < Date.now()) {
      localStorage.removeItem(PREFIX + key)
      return null
    }

    MEMORY.set(key, entry.value)
    return entry.value
  } catch {
    return null
  }
}

/** Escribe en ambos niveles de caché. */
export function writeCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  MEMORY.set(key, value)
  try {
    const entry: Entry<T> = {
      value,
      expires: ttl > 0 ? Date.now() + ttl : null,
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
  } catch {
    /* Sin persistencia: se mantiene solo en memoria. */
  }
}

/**
 * Devuelve el valor cacheado o ejecuta `fn`, cachea el resultado y lo devuelve.
 * Deduplica también las peticiones en vuelo para la misma clave.
 */
const inFlight = new Map<string, Promise<unknown>>()

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  const hit = readCache<T>(key)
  if (hit !== null) return hit

  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>

  const promise = (async () => {
    try {
      const value = await fn()
      writeCache(key, value, ttl)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

/** Borra toda la caché de la app (memoria + localStorage). */
export function clearCache(): void {
  MEMORY.clear()
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(ROOT))
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignorar */
  }
}

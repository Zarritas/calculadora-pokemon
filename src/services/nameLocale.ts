import { ref } from 'vue'
import { locale } from '@/i18n'

/**
 * Localización de nombres de CONTENIDO del juego (movimientos, habilidades,
 * objetos) desde PokéAPI, que los ofrece por idioma. El dataset de Champions
 * viene en inglés; aquí se traducen al mostrarlos.
 *
 * Estrategia: bajo demanda + caché reactiva. Al pedir un nombre en español se
 * devuelve el inglés al instante y se lanza la búsqueda en segundo plano; cuando
 * llega el nombre ES, se guarda en el mapa reactivo (la vista se re-renderiza) y
 * en localStorage para futuras sesiones. Los nombres de Pokémon NO se traducen
 * (son iguales en todos los idiomas).
 */

type Kind = 'move' | 'ability' | 'item'

const STORAGE_KEY = 'pkmn-lib:es-names'
const ENDPOINT: Record<Kind, string> = { move: 'move', ability: 'ability', item: 'item' }

function loadCache(): Record<Kind, Record<string, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* sin localStorage o JSON inválido */
  }
  return { move: {}, ability: {}, item: {} }
}

const esNames = ref<Record<Kind, Record<string, string>>>(loadCache())
const pending = new Set<string>()

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(esNames.value))
  } catch {
    /* cuota/modo privado */
  }
}

/** "Will-O-Wisp" → "will-o-wisp", "Forest's Curse" → "forests-curse" (id de PokéAPI). */
function toApiId(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.:]/g, '')
    .replace(/\s+/g, '-')
}

async function fetchName(kind: Kind, name: string): Promise<void> {
  const cacheKey = `${kind}:${name}`
  if (pending.has(cacheKey)) return
  pending.add(cacheKey)
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/${ENDPOINT[kind]}/${toApiId(name)}`)
    if (!res.ok) return
    const data = (await res.json()) as { names?: { language?: { name?: string }; name: string }[] }
    const es = data.names?.find((n) => n.language?.name === 'es')?.name
    if (es) {
      esNames.value = { ...esNames.value, [kind]: { ...esNames.value[kind], [name]: es } }
      persist()
    }
  } catch {
    /* sin red: se queda en inglés */
  } finally {
    pending.delete(cacheKey)
  }
}

/**
 * Nombre a mostrar de un movimiento/habilidad/objeto según el idioma. En español
 * devuelve el nombre ES si ya está en caché; si no, devuelve el inglés y lo pide
 * en segundo plano (se actualizará al llegar). En inglés devuelve el original.
 */
export function localizeName(kind: Kind, name: string | null | undefined): string {
  if (!name) return name ?? ''
  if (locale.value !== 'es') return name
  const cached = esNames.value[kind][name]
  if (cached) return cached
  fetchName(kind, name)
  return name
}

export const localizeMove = (name: string | null | undefined) => localizeName('move', name)
export const localizeAbility = (name: string | null | undefined) => localizeName('ability', name)
export const localizeItem = (name: string | null | undefined) => localizeName('item', name)

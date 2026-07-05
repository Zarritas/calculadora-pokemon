import type {
  ChampionsItem,
  ChampionsMon,
  ChampionsMove,
  ChampionsForm,
  StatSpread,
} from '@/types/pokemon'
import {
  normalizeCategory,
  normalizeType,
  showdownSprite,
  smogonNameCandidates,
  spriteUrl,
} from '@/utils/championsNames'
import { cached, clearCache } from './cache'

/**
 * Fuente de datos de Pokémon Champions: dataset comunitario abierto
 * (github.com/otterlyclueless/pokemon-champions-data). Provee el roster
 * exacto de Champions (con megas y regionales), learnsets, movimientos e
 * items, que PokéAPI no distingue.
 *
 * - roster / base-stats / items: pequeños, se cachean en localStorage.
 * - learnsets (~0,8 MB) y moves (~0,4 MB): solo en memoria durante la sesión,
 *   para no saturar la cuota de localStorage.
 */

const BASE =
  import.meta.env.VITE_CHAMPIONS_DATA_URL ??
  'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`Dataset Champions ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

/* --- Formas crudas del dataset --- */

interface RawRoster {
  name: string
  dexNumber: number
  types: string[]
  form: ChampionsForm
  abilities: { '0': string; '1'?: string; H?: string; S?: string }
}

/** Lista ordenada y sin duplicados de las habilidades de un Pokémon. */
function abilityList(a: RawRoster['abilities']): string[] {
  const ordered = [a['0'], a['1'], a.H, a.S].filter((x): x is string => Boolean(x))
  return [...new Set(ordered)]
}

interface RawStats {
  name: string
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

interface RawMove {
  name: string
  type: string
  category: string
  power: number | null
  accuracy: number | null
  pp: number
  priority?: number
}

type RawLearnsets = Record<string, { moves: { name: string }[] }>

/* --- Caché en memoria para los datasets grandes --- */

let learnsetsPromise: Promise<RawLearnsets> | null = null
let movesPromise: Promise<Map<string, ChampionsMove>> | null = null

function toBaseStats(s: RawStats): StatSpread {
  return {
    hp: s.hp,
    attack: s.atk,
    defense: s.def,
    spAttack: s.spa,
    spDefense: s.spd,
    speed: s.spe,
  }
}

/** Roster completo de Champions con stats fusionadas, ordenado por Pokédex. */
export async function getRoster(): Promise<ChampionsMon[]> {
  return cached('champions:roster', async () => {
    const [roster, stats] = await Promise.all([
      fetchJson<RawRoster[]>('pokemon/roster.json'),
      fetchJson<RawStats[]>('pokemon/base-stats.json'),
    ])

    const statsByName = new Map(stats.map((s) => [s.name, s]))

    return roster
      .map((r): ChampionsMon => {
        const s = statsByName.get(r.name)
        const base = spriteUrl(r.dexNumber)
        const smogon = smogonNameCandidates(r.name, r.form)[0]
        return {
          name: r.name,
          dexNumber: r.dexNumber,
          form: r.form,
          types: r.types.map(normalizeType),
          abilities: abilityList(r.abilities),
          baseStats: s
            ? toBaseStats(s)
            : { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
          sprite: showdownSprite(smogon) || base,
          spriteBase: base,
        }
      })
      .sort((a, b) => a.dexNumber - b.dexNumber || a.name.localeCompare(b.name))
  })
}

/** Lista de objetos equipables. */
export async function getItems(): Promise<ChampionsItem[]> {
  return cached('champions:items', () =>
    fetchJson<ChampionsItem[]>('items/items.json').then((items) =>
      [...items].sort((a, b) => a.name.localeCompare(b.name)),
    ),
  )
}

/** Índice de movimientos por nombre (solo en memoria). */
function getMovesIndex(): Promise<Map<string, ChampionsMove>> {
  if (!movesPromise) {
    movesPromise = fetchJson<RawMove[]>('moves/moves.json').then((moves) => {
      const map = new Map<string, ChampionsMove>()
      for (const m of moves) {
        map.set(m.name, {
          name: m.name,
          type: normalizeType(m.type),
          category: normalizeCategory(m.category),
          power: m.power ?? null,
          accuracy: m.accuracy ?? null,
          pp: m.pp,
          priority: m.priority ?? 0,
        })
      }
      return map
    })
  }
  return movesPromise
}

function getLearnsets(): Promise<RawLearnsets> {
  if (!learnsetsPromise) {
    learnsetsPromise = fetchJson<RawLearnsets>('learnsets/learnsets.json')
  }
  return learnsetsPromise
}

/**
 * Vacía toda la caché de datos de Champions (roster, objetos, movimientos y
 * learnsets), tanto en memoria como en localStorage. No afecta a las builds,
 * equipos ni enfrentamientos del usuario. Tras llamarla conviene recargar.
 */
export function clearChampionsCache(): void {
  learnsetsPromise = null
  movesPromise = null
  clearCache()
}

/** Datos de un movimiento concreto (o null si no existe en el dataset). */
export async function getMove(name: string): Promise<ChampionsMove | null> {
  const index = await getMovesIndex()
  return index.get(name) ?? null
}

/**
 * Movimientos que puede usar una forma concreta en Champions, con su detalle
 * (tipo, categoría, potencia), ordenados alfabéticamente.
 */
export async function getMovesForMon(monName: string): Promise<ChampionsMove[]> {
  const [learnsets, index] = await Promise.all([getLearnsets(), getMovesIndex()])
  const entry = learnsets[monName]
  if (!entry) return []

  const result: ChampionsMove[] = []
  for (const { name } of entry.moves) {
    const move = index.get(name)
    if (move) result.push(move)
  }
  return result.sort((a, b) => a.name.localeCompare(b.name))
}

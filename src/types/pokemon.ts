/**
 * Tipos de dominio de la calculadora.
 * La fuente de datos es el dataset de Pokémon Champions
 * (otterlyclueless/pokemon-champions-data); la capa `services/championsData`
 * transforma sus JSON a estos tipos.
 */

/** Los 18 tipos elementales de Pokémon (en minúscula, para UI y tabla de tipos). */
export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy'

/** Claves de las 6 estadísticas base. */
export type StatKey = 'hp' | 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed'

/** Conjunto de estadísticas (base, o Stat Points). */
export type StatSpread = Record<StatKey, number>

/** Stats que admiten cambios de combate (todas menos PS). */
export type BoostKey = Exclude<StatKey, 'hp'>

/** Cambios de estadística en combate (−6 a +6 por stat). */
export type BoostSpread = Record<BoostKey, number>

/** Categoría del movimiento: determina qué stats de ataque/defensa usar. */
export type DamageClass = 'physical' | 'special' | 'status'

/** Forma del Pokémon dentro de Champions. */
export type ChampionsForm = 'Base' | 'Mega' | 'Regional'

/**
 * Un Pokémon del roster de Champions. `name` es único e identifica la forma
 * (p. ej. "Charizard", "Mega Charizard X", "Tauros-Paldea-Combat").
 */
export interface ChampionsMon {
  name: string
  dexNumber: number
  form: ChampionsForm
  types: PokemonType[]
  /** Habilidades disponibles (la primera es la predeterminada). */
  abilities: string[]
  baseStats: StatSpread
  /** Sprite principal (forma específica cuando aplica). */
  sprite: string
  /** Sprite de respaldo (por número de Pokédex) si el principal falla. */
  spriteBase: string
}

/** Un movimiento de Champions con lo necesario para calcular daño. */
export interface ChampionsMove {
  name: string
  type: PokemonType
  category: DamageClass
  /** Potencia base; null para movimientos de estado. */
  power: number | null
  accuracy: number | null
  pp: number
  /** Prioridad del movimiento (para el orden de turno). */
  priority: number
}

/** Un objeto equipable. */
export interface ChampionsItem {
  name: string
  description: string
}

/**
 * Configuración de un combatiente en el sistema de Pokémon Champions:
 * reparto de Stat Points (0..32 por stat, 66 en total) y naturaleza.
 * El nivel es siempre 50 y los IVs siempre 31 (implícitos en Champions).
 */
export interface ChampionsBuild {
  statPoints: StatSpread
  /** Nombre de la naturaleza tal y como lo espera @smogon/calc (p. ej. "Modest"). */
  nature: string
}

/** Estado alterado (códigos de @smogon/calc); '' = sin estado. */
export type StatusCondition = '' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz'

/** Clima activo; '' = ninguno. */
export type Weather = '' | 'Sun' | 'Rain' | 'Sand' | 'Snow'

/** Terreno activo; '' = ninguno. */
export type Terrain = '' | 'Electric' | 'Grassy' | 'Psychic' | 'Misty'

/** Condiciones de campo que afectan al cálculo. */
export interface FieldState {
  weather: Weather
  terrain: Terrain
  /** Pantallas del lado del defensor. */
  reflect: boolean
  lightScreen: boolean
  auroraVeil: boolean
  /** Apoyo del aliado del atacante (dobles). */
  helpingHand?: boolean
  battery?: boolean
  powerSpot?: boolean
  steelySpirit?: boolean
  /** Prevención (Friend Guard) del aliado del defensor: reduce el daño recibido ×0.75. */
  friendGuard?: boolean
}

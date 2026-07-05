import type {
  BoostSpread,
  ChampionsBuild,
  ChampionsMon,
  ChampionsMove,
  FieldState,
  StatusCondition,
} from './pokemon'

/** Estado completo de un combatiente (Pokémon + configuración). */
export interface CombatantSnapshot {
  mon: ChampionsMon
  build: ChampionsBuild
  item: string | null
  status: StatusCondition
  /** Habilidad elegida (las builds antiguas pueden no tenerla). */
  ability?: string
  /** Moveset (hasta 4 movimientos). Puede faltar en builds antiguas. */
  moves?: ChampionsMove[]
  /** Cambios de estadística en combate (puede faltar en builds antiguas). */
  boosts?: BoostSpread
}

/** Nº máximo de movimientos por Pokémon. */
export const MOVESET_SIZE = 4

/** Configuración completa de un Pokémon guardada por el usuario. */
export interface SavedBuild extends CombatantSnapshot {
  id: string
  /** Nombre que le pone el usuario (p. ej. "Charizard ofensivo"). */
  name: string
}

/** Un equipo: colección de builds (hasta 6 en Champions). */
export interface SavedTeam {
  id: string
  name: string
  members: SavedBuild[]
}

/** Nº máximo de miembros por equipo. */
export const TEAM_SIZE = 6

/** Un enfrentamiento completo (recargable) con su resultado resumido. */
export interface Matchup {
  id: string
  /** Momento de registro (timestamp). */
  savedAt: number
  /** Nombre legible, p. ej. "Charizard vs Venusaur". */
  name: string
  attacker: CombatantSnapshot
  defender: CombatantSnapshot
  move: ChampionsMove
  field: FieldState
  summary: { minPercent: number; maxPercent: number; koText: string }
}

/** Nº máximo de enfrentamientos en el historial automático. */
export const MAX_HISTORY = 20

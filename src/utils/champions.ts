import type { BoostSpread, StatKey, StatSpread } from '@/types/pokemon'
import type { StatID } from '@smogon/calc'

/**
 * Reglas del sistema de estadísticas de Pokémon Champions.
 *
 * En Champions no hay IVs (son siempre 31) y los EVs se sustituyen por
 * "Stat Points" (SP): un presupuesto de 66 puntos, con un máximo de 32 por
 * estadística. A nivel 50, cada SP suma 1 al valor final de esa stat, lo que
 * equivale exactamente a 8 EVs del sistema clásico.
 */
export const CHAMPIONS_LEVEL = 50
export const SP_TOTAL = 66
export const SP_PER_STAT_MAX = 32
export const EV_PER_SP = 8

/** Nuestro `StatKey` -> `StatID` de @smogon/calc. */
export const STAT_ID: Record<StatKey, StatID> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  spAttack: 'spa',
  spDefense: 'spd',
  speed: 'spe',
}

/** Orden y etiqueta en español de las 6 stats para la UI. */
export const STAT_ORDER: { key: StatKey; label: string; short: string }[] = [
  { key: 'hp', label: 'PS', short: 'PS' },
  { key: 'attack', label: 'Ataque', short: 'Atq' },
  { key: 'defense', label: 'Defensa', short: 'Def' },
  { key: 'spAttack', label: 'Ataque Esp.', short: 'AtqE' },
  { key: 'spDefense', label: 'Defensa Esp.', short: 'DefE' },
  { key: 'speed', label: 'Velocidad', short: 'Vel' },
]

/** Spread de Stat Points a cero. */
export function zeroStatPoints(): StatSpread {
  return { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
}

/**
 * Repartos rápidos por rol (cada uno suma exactamente {@link SP_TOTAL} y respeta
 * el tope por stat). Atajo para no repartir a mano al armar builds.
 */
export const STAT_PRESETS: { label: string; sp: StatSpread }[] = [
  { label: 'Ofensivo físico', sp: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 } },
  { label: 'Ofensivo especial', sp: { hp: 2, attack: 0, defense: 0, spAttack: 32, spDefense: 0, speed: 32 } },
  { label: 'Muro físico', sp: { hp: 32, attack: 0, defense: 32, spAttack: 0, spDefense: 2, speed: 0 } },
  { label: 'Muro especial', sp: { hp: 32, attack: 0, defense: 2, spAttack: 0, spDefense: 32, speed: 0 } },
  { label: 'Bulk equilibrado', sp: { hp: 32, attack: 0, defense: 17, spAttack: 0, spDefense: 17, speed: 0 } },
]

/** Stats que admiten cambios de combate (todas menos PS), en orden de UI. */
export const BOOST_ORDER = STAT_ORDER.filter((s) => s.key !== 'hp')

/** Límite de cambios de estadística por stat. */
export const BOOST_MAX = 6

/** Cambios de estadística a cero. */
export function zeroBoosts(): BoostSpread {
  return { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
}

/** Suma total de SP asignados. */
export function totalStatPoints(sp: StatSpread): number {
  return STAT_ORDER.reduce((sum, s) => sum + sp[s.key], 0)
}

/** SP disponibles sin asignar. */
export function remainingStatPoints(sp: StatSpread): number {
  return SP_TOTAL - totalStatPoints(sp)
}

/** Convierte los Stat Points de Champions a EVs para @smogon/calc (1 SP = 8 EV). */
export function statPointsToEvs(sp: StatSpread): Record<StatID, number> {
  return {
    hp: sp.hp * EV_PER_SP,
    atk: sp.attack * EV_PER_SP,
    def: sp.defense * EV_PER_SP,
    spa: sp.spAttack * EV_PER_SP,
    spd: sp.spDefense * EV_PER_SP,
    spe: sp.speed * EV_PER_SP,
  }
}

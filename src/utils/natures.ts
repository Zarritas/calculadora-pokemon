import { NATURES } from '@smogon/calc'
import type { StatID } from '@smogon/calc'

/** Naturaleza neutra por defecto (no modifica ninguna stat). */
export const DEFAULT_NATURE = 'Serious'

/** Etiquetas en español de las stats afectadas por una naturaleza. */
const STAT_LABEL: Record<StatID, string> = {
  hp: 'PS',
  atk: 'Ataque',
  def: 'Defensa',
  spa: 'At. Esp.',
  spd: 'Def. Esp.',
  spe: 'Velocidad',
}

export interface NatureOption {
  name: string
  /** Stat que sube (+10%) o null si es neutra. */
  plus: StatID | null
  /** Stat que baja (-10%) o null si es neutra. */
  minus: StatID | null
  /** Texto descriptivo para la UI, p. ej. "+At. Esp. / −Ataque". */
  label: string
}

/**
 * Lista de las 25 naturalezas tomada directamente de @smogon/calc, para
 * garantizar que los nombres coinciden con los que espera el motor de cálculo.
 */
export const NATURE_OPTIONS: NatureOption[] = Object.entries(NATURES)
  .map(([name, effect]) => {
    const [plus, minus] = effect as [StatID, StatID]
    const neutral = plus === minus
    return {
      name,
      plus: neutral ? null : plus,
      minus: neutral ? null : minus,
      label: neutral
        ? 'Neutra'
        : `+${STAT_LABEL[plus]} / −${STAT_LABEL[minus]}`,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

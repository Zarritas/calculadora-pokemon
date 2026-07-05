import { calculate, Field as CalcField, Move as CalcMove, Pokemon as CalcPokemon } from '@smogon/calc'
import type {
  BoostSpread,
  ChampionsBuild,
  ChampionsMon,
  ChampionsMove,
  FieldState,
  StatusCondition,
} from '@/types/pokemon'
import { CHAMPIONS_LEVEL, statPointsToEvs } from '@/utils/champions'
import { smogonNameCandidates } from '@/utils/championsNames'

/**
 * Motor de cálculo de daño basado en @smogon/calc.
 *
 * Para ser fiel a Champions, cada Pokémon se construye con `overrides` de
 * tipos, stats base y habilidad tomados del dataset de Champions; así el
 * resultado no depende de que la base de datos interna de la librería
 * coincida (importante para megas nuevas y variantes regionales).
 * Los Stat Points se traducen a EVs (SP × 8), con IVs 31 y nivel 50.
 */

const GEN = 9

/** Tipo de las opciones del constructor de Pokemon de @smogon/calc. */
type CalcPokemonOptions = ConstructorParameters<typeof CalcPokemon>[2]

export interface Combatant {
  mon: ChampionsMon
  build: ChampionsBuild
  /** Objeto equipado (ignorado en formas Mega, que llevan su piedra). */
  item?: string | null
  /** Estado alterado ('' = ninguno). */
  status?: StatusCondition
  /** Habilidad elegida; si se omite se usa la predeterminada del Pokémon. */
  ability?: string
  /** Cambios de estadística en combate (−6 a +6). */
  boosts?: BoostSpread
  /** PS actuales (para habilidades dependientes de HP como Multiescama). */
  curHP?: number
}

export interface EngineInput {
  attacker: Combatant
  defender: Combatant
  move: ChampionsMove
  field?: FieldState
  /** Combate doble (aplica el gameType de @smogon/calc). */
  doubles?: boolean
  /** Fuerza golpe crítico en el cálculo. */
  isCrit?: boolean
}

export interface EngineResult {
  minDamage: number
  maxDamage: number
  minPercent: number
  maxPercent: number
  description: string
  koText: string
  koChance: number
  defenderHp: number
}

/** "fire" -> "Fire" (los tipos de @smogon/calc van capitalizados). */
function capType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function buildCalcPokemon(c: Combatant): CalcPokemon {
  const { mon, build } = c
  const overrides = {
    types: mon.types.map(capType) as [string] | [string, string],
    baseStats: {
      hp: mon.baseStats.hp,
      atk: mon.baseStats.attack,
      def: mon.baseStats.defense,
      spa: mon.baseStats.spAttack,
      spd: mon.baseStats.spDefense,
      spe: mon.baseStats.speed,
    },
  }

  // Los tipos internos de @smogon/calc usan uniones de literales (TypeName);
  // casteamos porque nuestros tipos vienen como string del dataset.
  const options = {
    level: CHAMPIONS_LEVEL,
    nature: build.nature,
    evs: statPointsToEvs(build.statPoints),
    ability: c.ability || mon.abilities[0],
    // En Mega el objeto es la piedra (implícita); no se pasa item de daño.
    item: mon.form === 'Mega' ? undefined : (c.item ?? undefined),
    status: c.status || undefined,
    curHP: c.curHP,
    boosts: c.boosts
      ? {
          atk: c.boosts.attack,
          def: c.boosts.defense,
          spa: c.boosts.spAttack,
          spd: c.boosts.spDefense,
          spe: c.boosts.speed,
        }
      : undefined,
    overrides,
  } as unknown as CalcPokemonOptions

  // Probar los nombres candidatos hasta dar con una especie válida.
  for (const name of smogonNameCandidates(mon.name, mon.form)) {
    try {
      return new CalcPokemon(GEN, name, options)
    } catch {
      /* probar siguiente candidato */
    }
  }
  // Último recurso: cualquier especie válida; los overrides mandan en el daño.
  return new CalcPokemon(GEN, 'Mew', options)
}

/**
 * Ejecuta el cálculo. Lanza si el movimiento no existe en la base de datos de
 * la librería (el llamante debe capturar y mostrar el error).
 */
export function runCalc(input: EngineInput): EngineResult {
  const attacker = buildCalcPokemon(input.attacker)
  const defender = buildCalcPokemon(input.defender)
  const move = new CalcMove(GEN, input.move.name, {
    isCrit: input.isCrit,
  } as unknown as ConstructorParameters<typeof CalcMove>[2])
  const field = buildField(input.field, input.doubles)

  const result = calculate(GEN, attacker, defender, move, field)

  const [minDamage, maxDamage] = result.range()
  const defenderHp = defender.stats.hp

  let koText = ''
  let koChance = 0
  try {
    const ko = result.kochance()
    koText = ko.text ?? ''
    koChance = ko.chance ?? 0
  } catch {
    /* movimientos de estado no dan un kochance válido */
  }

  return {
    minDamage,
    maxDamage,
    minPercent: defenderHp > 0 ? (minDamage / defenderHp) * 100 : 0,
    maxPercent: defenderHp > 0 ? (maxDamage / defenderHp) * 100 : 0,
    description: safeDesc(result),
    koText,
    koChance,
    defenderHp,
  }
}

/** Construye el `Field` de @smogon/calc; las pantallas van del lado del defensor. */
function buildField(field?: FieldState, doubles?: boolean): CalcField {
  const gameType = doubles ? 'Doubles' : 'Singles'
  if (!field) {
    return new CalcField({ gameType } as unknown as ConstructorParameters<typeof CalcField>[0])
  }
  return new CalcField({
    gameType,
    weather: field.weather || undefined,
    terrain: field.terrain || undefined,
    attackerSide: {
      isHelpingHand: field.helpingHand,
      isBattery: field.battery,
      isPowerSpot: field.powerSpot,
      isSteelySpirit: field.steelySpirit,
    },
    defenderSide: {
      isReflect: field.reflect,
      isLightScreen: field.lightScreen,
      isAuroraVeil: field.auroraVeil,
      isFriendGuard: field.friendGuard,
    },
  } as unknown as ConstructorParameters<typeof CalcField>[0])
}

/** Claves de stats de @smogon/calc. */
export interface RealStats {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

/**
 * Stats reales de un combatiente (sin cambios de combate), usando las mismas
 * reglas de Champions. Útil para el HP máximo y la velocidad base en el
 * simulador; los boosts se aplican aparte.
 */
export function combatantStats(c: Combatant): RealStats {
  const p = buildCalcPokemon({ ...c, boosts: undefined })
  return {
    hp: p.stats.hp,
    atk: p.stats.atk,
    def: p.stats.def,
    spa: p.stats.spa,
    spd: p.stats.spd,
    spe: p.stats.spe,
  }
}

function safeDesc(result: ReturnType<typeof calculate>): string {
  try {
    return result.desc()
  } catch {
    return ''
  }
}

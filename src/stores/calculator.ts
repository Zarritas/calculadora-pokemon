import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type {
  BoostSpread,
  ChampionsBuild,
  ChampionsMon,
  ChampionsMove,
  FieldState,
  StatusCondition,
} from '@/types/pokemon'
import type { CombatantSnapshot, Matchup } from '@/types/library'
import { runCalc, type EngineResult } from '@/services/damageEngine'
import { newId } from '@/services/storage'
import { CHAMPIONS_LEVEL, zeroBoosts, zeroStatPoints } from '@/utils/champions'
import { defaultField } from '@/utils/field'
import { DEFAULT_NATURE } from '@/utils/natures'
import { typeEffectiveness } from '@/utils/typeChart'

/** Resultado enriquecido que consume la UI. */
export interface CalcResult extends EngineResult {
  typeMultiplier: number
  stab: boolean
}

function emptyBuild(): ChampionsBuild {
  return { statPoints: zeroStatPoints(), nature: DEFAULT_NATURE }
}

/**
 * Estado central de la calculadora en formato Pokémon Champions: atacante y
 * defensor (con Stat Points, naturaleza y objeto), movimiento seleccionado y
 * nivel fijo a 50. El cálculo se delega en `@smogon/calc`.
 */
export const useCalculatorStore = defineStore('calculator', () => {
  const attacker = ref<ChampionsMon | null>(null)
  const defender = ref<ChampionsMon | null>(null)
  const move = ref<ChampionsMove | null>(null)

  const attackerBuild = reactive<ChampionsBuild>(emptyBuild())
  const defenderBuild = reactive<ChampionsBuild>(emptyBuild())

  const attackerItem = ref<string | null>(null)
  const defenderItem = ref<string | null>(null)

  const attackerStatus = ref<StatusCondition>('')
  const defenderStatus = ref<StatusCondition>('')

  const attackerAbility = ref<string>('')
  const defenderAbility = ref<string>('')

  /** Movesets guardados (hasta 4) de cada combatiente. */
  const attackerMoves = ref<ChampionsMove[]>([])
  const defenderMoves = ref<ChampionsMove[]>([])

  /** Cambios de estadística en combate (−6 a +6). */
  const attackerBoosts = reactive<BoostSpread>(zeroBoosts())
  const defenderBoosts = reactive<BoostSpread>(zeroBoosts())

  const field = reactive<FieldState>(defaultField())

  /** El nivel en Champions es siempre 50. */
  const level = CHAMPIONS_LEVEL

  const error = ref<string | null>(null)

  const result = computed<CalcResult | null>(() => {
    if (!attacker.value || !defender.value || !move.value) return null

    try {
      const engine = runCalc({
        attacker: {
          mon: attacker.value,
          build: attackerBuild,
          item: attackerItem.value,
          status: attackerStatus.value,
          ability: attackerAbility.value,
          boosts: attackerBoosts,
        },
        defender: {
          mon: defender.value,
          build: defenderBuild,
          item: defenderItem.value,
          status: defenderStatus.value,
          ability: defenderAbility.value,
          boosts: defenderBoosts,
        },
        move: move.value,
        field,
      })
      error.value = null

      return {
        ...engine,
        typeMultiplier: typeEffectiveness(move.value.type, defender.value.types),
        stab: attacker.value.types.includes(move.value.type),
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo calcular el daño'
      return null
    }
  })

  function selectAttacker(mon: ChampionsMon) {
    attacker.value = mon
    // El movimiento y el moveset pertenecen al atacante (learnset propio).
    move.value = null
    attackerMoves.value = []
    attackerAbility.value = mon.abilities[0] ?? ''
    Object.assign(attackerBoosts, zeroBoosts())
    if (mon.form === 'Mega') attackerItem.value = null
  }

  function selectDefender(mon: ChampionsMon) {
    defender.value = mon
    defenderMoves.value = []
    defenderAbility.value = mon.abilities[0] ?? ''
    Object.assign(defenderBoosts, zeroBoosts())
    if (mon.form === 'Mega') defenderItem.value = null
  }

  /** Activa el movimiento del atacante que se usará en el cálculo. */
  function selectMove(m: ChampionsMove) {
    move.value = m
  }

  /** Actualiza el moveset del atacante y reconcilia el movimiento activo. */
  function setAttackerMoves(list: ChampionsMove[]) {
    attackerMoves.value = list
    if (move.value && !list.some((m) => m.name === move.value!.name)) {
      move.value = list[0] ?? null
    } else if (!move.value && list.length) {
      move.value = list[0]
    }
  }

  function setDefenderMoves(list: ChampionsMove[]) {
    defenderMoves.value = list
  }

  type Target = 'attacker' | 'defender'

  /** Datos de la build actual de un combatiente (sin id ni nombre). */
  function currentBuildData(target: Target): CombatantSnapshot | null {
    const mon = target === 'attacker' ? attacker.value : defender.value
    if (!mon) return null
    const b = target === 'attacker' ? attackerBuild : defenderBuild
    return {
      mon,
      build: { statPoints: { ...b.statPoints }, nature: b.nature },
      item: target === 'attacker' ? attackerItem.value : defenderItem.value,
      status: target === 'attacker' ? attackerStatus.value : defenderStatus.value,
      ability: target === 'attacker' ? attackerAbility.value : defenderAbility.value,
      moves: [...(target === 'attacker' ? attackerMoves.value : defenderMoves.value)],
      boosts: { ...(target === 'attacker' ? attackerBoosts : defenderBoosts) },
    }
  }

  /** Aplica una build guardada a un combatiente. */
  function applyBuild(target: Target, saved: CombatantSnapshot) {
    const statPoints = { ...saved.build.statPoints }
    // Repara datos antiguos: `abilities` guardada como objeto ({0:'x'}) por un
    // bug previo. Sin esto, el selector de habilidad ve `length` undefined y
    // muestra la primera en vez de la real.
    if (saved.mon && !Array.isArray(saved.mon.abilities)) {
      saved.mon.abilities = Object.values((saved.mon.abilities ?? {}) as Record<string, string>)
    }
    // Builds antiguas pueden no tener habilidad: se usa la predeterminada.
    const ability = saved.ability || saved.mon.abilities[0] || ''
    const moves = saved.moves ? [...saved.moves] : []
    const boosts = { ...zeroBoosts(), ...(saved.boosts ?? {}) }
    if (target === 'attacker') {
      attacker.value = saved.mon
      attackerBuild.statPoints = statPoints
      attackerBuild.nature = saved.build.nature
      attackerItem.value = saved.item
      attackerStatus.value = saved.status
      attackerAbility.value = ability
      attackerMoves.value = moves
      move.value = moves[0] ?? null
      Object.assign(attackerBoosts, boosts)
    } else {
      defender.value = saved.mon
      defenderBuild.statPoints = statPoints
      defenderBuild.nature = saved.build.nature
      defenderItem.value = saved.item
      defenderStatus.value = saved.status
      defenderAbility.value = ability
      defenderMoves.value = moves
      Object.assign(defenderBoosts, boosts)
    }
  }

  /** Construye un snapshot completo del enfrentamiento actual (o null). */
  function currentMatchup(): Matchup | null {
    const a = currentBuildData('attacker')
    const d = currentBuildData('defender')
    const r = result.value
    if (!a || !d || !move.value || !r) return null
    return {
      id: newId(),
      savedAt: Date.now(),
      name: `${a.mon.name} vs ${d.mon.name}`,
      attacker: a,
      defender: d,
      move: move.value,
      field: { ...field },
      summary: { minPercent: r.minPercent, maxPercent: r.maxPercent, koText: r.koText },
    }
  }

  /** Recarga un enfrentamiento completo en la calculadora. */
  function applyMatchup(m: Matchup) {
    applyBuild('attacker', m.attacker)
    applyBuild('defender', m.defender)
    move.value = m.move
    Object.assign(field, m.field)
  }

  return {
    attacker,
    defender,
    move,
    attackerBuild,
    defenderBuild,
    attackerItem,
    defenderItem,
    attackerStatus,
    defenderStatus,
    attackerAbility,
    defenderAbility,
    attackerMoves,
    defenderMoves,
    attackerBoosts,
    defenderBoosts,
    field,
    level,
    error,
    result,
    selectAttacker,
    selectDefender,
    selectMove,
    setAttackerMoves,
    setDefenderMoves,
    currentBuildData,
    applyBuild,
    currentMatchup,
    applyMatchup,
  }
})

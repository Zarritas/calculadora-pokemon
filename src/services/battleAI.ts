import type { ChampionsMove, FieldState } from '@/types/pokemon'
import type { Action, Fighter, FullState, MoveTarget, SideId, SlotAction } from '@/stores/simulator'
import { runCalc, type Combatant } from '@/services/damageEngine'
import { getMoveEffect } from '@/services/moveEffects'

/**
 * IA de combate por expectiminimax.
 *
 * El combate Pokémon es un juego de suma cero con jugadas SIMULTÁNEAS y azar
 * (daño, críticos, precisión, efectos secundarios). Por eso no se resuelve con
 * un minimax alternado, sino construyendo por turno una matriz de pagos:
 *
 *                         RIVAL (aliado)
 *                    acc. A   acc. B   cambio …
 *      IA  acc. X  [  v   ] [  v   ] [  v   ]
 *          acc. Y  [  v   ] [  v   ] [  v   ]
 *          cambio  [  v   ] [  v   ] [  v   ]
 *
 * Cada celda (mi acción × su acción) se evalúa simulando el turno sobre el
 * MOTOR REAL del store (así la IA "entiende" gratis megas, pantallas, hazards,
 * habilidades de contacto, clima, etc.). Como el turno tiene azar, cada celda
 * se estima por Monte Carlo (varias muestras promediadas): ese es el nodo de
 * azar del expectiminimax. La IA elige por maximin: la acción cuyo peor caso
 * (rival respondiendo lo mejor posible) es el mejor.
 *
 * La profundidad se controla con la lista de "plies": un ply = un turno mirado
 * hacia adelante. Profundidad 1 (Normal) mira solo el turno actual; profundidad
 * 2 (Difícil) mira además la respuesta del turno siguiente.
 */

/** La IA siempre juega el bando rival ('enemy'). */
const AI_SIDE: SideId = 'enemy'

/** Puente al motor de simulación del store (inyectado desde el simulador). */
export interface AiBridge {
  /** Ejecuta un turno en un sandbox y devuelve el estado resultante (sin efectos). */
  simulate: (state: FullState, allyActions: SlotAction[], enemyActions: SlotAction[]) => FullState
  /** Combate doble (afecta al cálculo de daño). */
  doubles: boolean
}

export type AiDifficulty = 'normal' | 'hard'

/** Configuración de un turno mirado hacia adelante. */
interface Ply {
  /** Movimientos de daño candidatos por slot (los de mayor daño). */
  moveWidth: number
  /** Cambios candidatos por slot. */
  switchCap: number
  /** Muestras Monte Carlo por celda de la matriz. */
  samples: number
  /** Tope duro de acciones por slot (acota la anchura pase lo que pase). */
  maxPerSlot: number
  /**
   * Ordenar los movimientos de daño por daño real (llamando a @smogon/calc).
   * Es caro; se desactiva en los plies profundos, donde basta el orden natural.
   */
  rank: boolean
}

/** Normal: un solo turno, matriz amplia y buen muestreo. */
const NORMAL_PLIES: Ply[] = [{ moveWidth: 4, switchCap: 2, samples: 4, maxPerSlot: 7, rank: true }]
/**
 * Difícil: dos turnos. El segundo ply se poda fuerte (menos anchura, sin
 * cambios, una sola muestra y sin rankeo de daño) para no explotar el coste,
 * ya que cada celda del primer ply recursa a una matriz entera del segundo.
 */
const HARD_PLIES: Ply[] = [
  { moveWidth: 3, switchCap: 1, samples: 2, maxPerSlot: 5, rank: true },
  { moveWidth: 2, switchCap: 0, samples: 1, maxPerSlot: 2, rank: false },
]

/** Tope de combinaciones de acciones por bando en un turno (relevante en dobles). */
const MAX_COMBOS = 12

/* ---------- Pesos de la función de evaluación ---------- */
const WIN = 1000
const ALIVE_BONUS = 3
const BOOST_WEIGHT = 0.15
const HAZARD_WEIGHT = 0.5
const STATUS_PENALTY: Record<string, number> = {
  '': 0,
  brn: 0.5,
  par: 0.4,
  psn: 0.35,
  tox: 0.6,
  slp: 0.7,
  frz: 0.9,
}

/* ---------- Lectura pura de un FullState ---------- */

function teamOf(state: FullState, side: SideId): Fighter[] {
  return side === 'ally' ? state.allies : state.enemies
}
function activesOf(state: FullState, side: SideId): (number | null)[] {
  return side === 'ally' ? state.allyActives : state.enemyActives
}
/** Slots activos vivos de un bando (con su combatiente). */
function aliveActive(state: FullState, side: SideId): { slot: number; f: Fighter }[] {
  const acts = activesOf(state, side)
  const team = teamOf(state, side)
  const out: { slot: number; f: Fighter }[] = []
  acts.forEach((idx, slot) => {
    if (idx != null && !team[idx].fainted) out.push({ slot, f: team[idx] })
  })
  return out
}
/** Índices del banquillo vivos (no debilitados y no activos). */
function benchAlive(state: FullState, side: SideId): number[] {
  const acts = activesOf(state, side)
  const team = teamOf(state, side)
  return team.map((_, i) => i).filter((i) => !team[i].fainted && !acts.includes(i))
}

function combatantFrom(f: Fighter): Combatant {
  return {
    mon: f.mon,
    build: f.build.build,
    item: f.itemActive ? f.build.item : null,
    status: f.status,
    ability: f.ability,
    boosts: f.boosts,
    curHP: f.hp,
  }
}

/** Campo visto por el defensor: clima/terreno + sus pantallas activas. */
function fieldForState(state: FullState, defSide: SideId): FieldState {
  const s = state.screens[defSide]
  return {
    weather: state.weather,
    terrain: state.terrain,
    reflect: s.reflect > 0,
    lightScreen: s.lightScreen > 0,
    auroraVeil: s.auroraVeil > 0,
  }
}

/** Daño medio estimado de un movimiento (0 si el cálculo falla). */
function avgDamage(
  state: FullState,
  attacker: Fighter,
  defender: Fighter,
  move: ChampionsMove,
  defSide: SideId,
  doubles: boolean,
): number {
  try {
    const r = runCalc({
      attacker: combatantFrom(attacker),
      defender: combatantFrom(defender),
      move,
      field: fieldForState(state, defSide),
      doubles,
    })
    return (r.minDamage + r.maxDamage) / 2
  } catch {
    return 0
  }
}

/* ---------- Generación de acciones candidatas ---------- */

/** ¿El movimiento está restringido por un volátil (Mofa/Anulación/Bis/Tormento)? */
function isRestricted(f: Fighter, move: ChampionsMove): boolean {
  const isStatus = move.category === 'status' || move.power == null
  if (f.taunt > 0 && isStatus) return true
  if (f.disableMove === move.name) return true
  if (f.encoreMove && f.encoreMove !== move.name) return true
  if (f.torment && f.lastMove === move.name) return true
  return false
}

/** Acciones candidatas de un único combatiente activo. */
function slotActions(
  state: FullState,
  side: SideId,
  slot: number,
  f: Fighter,
  ply: Ply,
  doubles: boolean,
): Action[] {
  const foe: SideId = side === 'ally' ? 'enemy' : 'ally'
  const foeActives = aliveActive(state, foe)
  const canMega = !!f.megaForm && !f.megaEvolved && !state.megaUsed[side]
  const megaFlag = canMega ? { mega: true } : {}

  const all = f.build.moves ?? []
  const usable = (f.lockedMove ? all.filter((m) => m.name === f.lockedMove) : all).filter(
    (m) => !isRestricted(f, m),
  )

  const damaging: { action: Action; dmg: number }[] = []
  const statusMoves: Action[] = []
  for (const move of usable) {
    const eff = getMoveEffect(move.name)
    const isStatus = move.category === 'status' || move.power == null
    if (isStatus) {
      const target: MoveTarget =
        eff?.target === 'self' ? { side, slot } : { side: foe, slot: foeActives[0]?.slot ?? 0 }
      statusMoves.push({ kind: 'move', move, target, ...megaFlag })
    } else {
      for (const ft of foeActives) {
        // El rankeo de daño (caro) solo en plies superficiales; si no, orden natural.
        const dmg = ply.rank ? avgDamage(state, f, ft.f, move, foe, doubles) : 0
        damaging.push({ action: { kind: 'move', move, target: { side: foe, slot: ft.slot }, ...megaFlag }, dmg })
      }
    }
  }
  if (ply.rank) damaging.sort((a, b) => b.dmg - a.dmg)

  // Prioridad al acotar: ataques fuertes → cambios → estados.
  const out: Action[] = []
  for (const d of damaging.slice(0, ply.moveWidth)) out.push(d.action)
  for (const b of benchAlive(state, side).slice(0, ply.switchCap)) out.push({ kind: 'switch', index: b })
  out.push(...statusMoves)

  // Salvaguarda: si no hubo nada usable, ataca con lo primero que tenga.
  if (!out.length && usable.length) {
    out.push({ kind: 'move', move: usable[0], target: { side: foe, slot: foeActives[0]?.slot ?? 0 }, ...megaFlag })
  }
  return out.slice(0, ply.maxPerSlot)
}

/**
 * Conjuntos de acciones de turno candidatos para un bando (producto de las
 * acciones por slot, acotado). Omite los slots con acción forzada (recarga o
 * carga en curso): el motor las inyecta al simular.
 */
function turnCandidates(state: FullState, side: SideId, ply: Ply, doubles: boolean): SlotAction[][] {
  const actives = aliveActive(state, side).filter(({ f }) => !f.mustRecharge && !f.chargingMove)
  if (!actives.length) return [[]]

  const perSlot = actives.map(({ slot, f }) =>
    slotActions(state, side, slot, f, ply, doubles).map((action) => ({ slot, action })),
  )

  let combos: SlotAction[][] = [[]]
  for (const list of perSlot) {
    const next: SlotAction[][] = []
    for (const combo of combos) {
      for (const item of list) {
        next.push([...combo, item])
        if (next.length >= MAX_COMBOS) break
      }
      if (next.length >= MAX_COMBOS) break
    }
    combos = next
  }
  return combos.length ? combos : [[]]
}

/* ---------- Evaluación de un estado (perspectiva de la IA = 'enemy') ---------- */

function teamScore(fighters: Fighter[]): number {
  let s = 0
  for (const f of fighters) {
    if (f.fainted) continue
    s += ALIVE_BONUS + f.hp / f.maxHp - (STATUS_PENALTY[f.status] ?? 0)
  }
  return s
}

function activeBoostScore(fighters: Fighter[], actives: (number | null)[]): number {
  let s = 0
  for (const idx of actives) {
    if (idx == null) continue
    const f = fighters[idx]
    if (f.fainted) continue
    const b = f.boosts
    s += BOOST_WEIGHT * (b.attack + b.defense + b.spAttack + b.spDefense + b.speed)
  }
  return s
}

function hazardLevel(h: { stealthRock: boolean; spikes: number; toxicSpikes: number }): number {
  return (h.stealthRock ? 1 : 0) + h.spikes + h.toxicSpikes
}

/** Valor terminal si el combate ha acabado (o está decidido), o null. */
function terminalValue(state: FullState): number | null {
  if (state.winner === 'enemy') return WIN
  if (state.winner === 'ally') return -WIN
  if (state.enemies.every((f) => f.fainted)) return -WIN
  if (state.allies.every((f) => f.fainted)) return WIN
  return null
}

/** Puntuación heurística del estado desde la perspectiva de la IA (mayor = mejor). */
function evaluate(state: FullState): number {
  let s = teamScore(state.enemies) - teamScore(state.allies)
  s += activeBoostScore(state.enemies, state.enemyActives)
  s -= activeBoostScore(state.allies, state.allyActives)
  // Los peligros de un bando dañan a ese bando: los del rival (ally) benefician a la IA.
  s += HAZARD_WEIGHT * hazardLevel(state.hazards.ally)
  s -= HAZARD_WEIGHT * hazardLevel(state.hazards.enemy)
  return s
}

/* ---------- Búsqueda expectiminimax ---------- */

/** Valor maximin del estado mirando `plies.length - ply` turnos hacia adelante. */
function searchValue(state: FullState, bridge: AiBridge, plies: Ply[], ply: number): number {
  const terminal = terminalValue(state)
  if (terminal !== null) return terminal
  if (ply >= plies.length) return evaluate(state)

  const p = plies[ply]
  const mine = turnCandidates(state, AI_SIDE, p, bridge.doubles)
  const opp = turnCandidates(state, 'ally', p, bridge.doubles)
  const oppOptions = opp.length ? opp : [[]]

  let best = -Infinity
  for (const my of mine) {
    // El rival responde con la acción que minimiza mi valor (maximin).
    let worst = Infinity
    for (const op of oppOptions) {
      let sum = 0
      for (let k = 0; k < p.samples; k++) {
        const next = bridge.simulate(state, op, my)
        sum += searchValue(next, bridge, plies, ply + 1)
      }
      const v = sum / p.samples
      if (v < worst) worst = v
    }
    if (worst > best) best = worst
  }
  return best
}

/** Cede el control al bucle de eventos (mantiene la UI reactiva durante el cálculo). */
const yieldControl = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/**
 * Elige las acciones de la IA (bando rival) para el turno actual.
 * `state` es el estado del combate en este momento (capturado por el store).
 *
 * Es asíncrona y cede el control tras evaluar cada acción candidata propia,
 * de modo que puede calcularse en segundo plano (mientras el jugador elige)
 * sin congelar la interfaz. El primer ply no recursa dentro de este bucle: la
 * profundidad la maneja `searchValue`, que sí es síncrono (una celda entera).
 */
export async function chooseAiActions(
  state: FullState,
  bridge: AiBridge,
  difficulty: AiDifficulty,
): Promise<SlotAction[]> {
  const plies = difficulty === 'hard' ? HARD_PLIES : NORMAL_PLIES
  const p = plies[0]
  const mine = turnCandidates(state, AI_SIDE, p, bridge.doubles)
  const opp = turnCandidates(state, 'ally', p, bridge.doubles)
  const oppOptions = opp.length ? opp : [[]]

  let best: SlotAction[] | null = null
  let bestVal = -Infinity
  for (const my of mine) {
    let worst = Infinity
    for (const op of oppOptions) {
      let sum = 0
      for (let k = 0; k < p.samples; k++) {
        const next = bridge.simulate(state, op, my)
        sum += searchValue(next, bridge, plies, 1)
      }
      const v = sum / p.samples
      if (v < worst) worst = v
    }
    if (worst > bestVal) {
      bestVal = worst
      best = my
    }
    await yieldControl()
  }
  return best ?? mine[0] ?? []
}

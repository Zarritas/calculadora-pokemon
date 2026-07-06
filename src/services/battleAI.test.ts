import { describe, expect, it } from 'vitest'
import { chooseAiActions, type AiBridge } from '@/services/battleAI'
import type { Fighter, FullState, SlotAction } from '@/stores/simulator'
import type { ChampionsMon, ChampionsMove } from '@/types/pokemon'

/* Fixtures mínimas: solo los campos que la IA lee. */

const MON: ChampionsMon = {
  name: 'Testmon',
  types: ['normal'],
  baseStats: { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
  abilities: ['Pressure'],
  sprite: '',
} as unknown as ChampionsMon

function move(name: string, power: number | null, category: 'physical' | 'special' | 'status'): ChampionsMove {
  return { name, type: 'normal', category, power, accuracy: 100, priority: 0 } as unknown as ChampionsMove
}

function fighter(hp: number, moves: ChampionsMove[], fainted = false): Fighter {
  return {
    build: { build: { nature: 'Hardy', statPoints: {} }, item: null, moves, mon: MON },
    mon: MON,
    ability: 'Pressure',
    megaForm: null,
    megaEvolved: false,
    maxHp: 100,
    hp,
    status: '',
    boosts: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
    toxicCounter: 0,
    fainted,
    itemActive: false,
    accStage: 0,
    evaStage: 0,
    protecting: false,
    protectKind: null,
    protectStreak: 0,
    lockedMove: null,
    chargingMove: null,
    mustRecharge: false,
    turnsActive: 1,
    enteredThisTurn: false,
    flinched: false,
  } as unknown as Fighter
}

function makeState(allyHp: number, enemyHp: number): FullState {
  return {
    label: 'test',
    allies: [fighter(allyHp, [move('Tackle', 40, 'physical')])],
    enemies: [fighter(enemyHp, [move('Slam', 80, 'physical'), move('Growl', null, 'status')])],
    allyActives: [0],
    enemyActives: [0],
    weather: '',
    terrain: '',
    hazards: {
      ally: { stealthRock: false, spikes: 0, toxicSpikes: 0 },
      enemy: { stealthRock: false, spikes: 0, toxicSpikes: 0 },
    },
    screens: {
      ally: { reflect: 0, lightScreen: 0, auroraVeil: 0 },
      enemy: { reflect: 0, lightScreen: 0, auroraVeil: 0 },
    },
    megaUsed: { ally: false, enemy: false },
    winner: null,
  } as unknown as FullState
}

/**
 * `simulate` determinista: el ataque del bando rival (IA) reduce 60 PS al aliado.
 * Basta para que la evaluación distinga acciones y la búsqueda tenga algo que
 * maximizar; ejercita generación de candidatos, matriz, recursión y evaluación.
 */
function makeBridge(): AiBridge {
  return {
    doubles: false,
    simulate: (state: FullState, _ally: SlotAction[], enemy: SlotAction[]): FullState => {
      const next = JSON.parse(JSON.stringify(state)) as FullState
      for (const sa of enemy) {
        if (sa.action.kind === 'move' && sa.action.move.power) {
          const t = next.allies[next.allyActives[sa.action.target.slot] ?? 0]
          if (t) {
            t.hp = Math.max(0, t.hp - 60)
            if (t.hp === 0) t.fainted = true
          }
        }
      }
      return next
    },
  }
}

describe('chooseAiActions', () => {
  it('devuelve una acción válida en profundidad 1 (normal)', async () => {
    const actions = await chooseAiActions(makeState(100, 100), makeBridge(), 'normal')
    expect(actions.length).toBe(1)
    expect(actions[0].slot).toBe(0)
    expect(actions[0].action.kind).toBe('move')
  })

  it('devuelve una acción válida en profundidad 2 (difícil)', async () => {
    const actions = await chooseAiActions(makeState(100, 100), makeBridge(), 'hard')
    expect(actions.length).toBe(1)
    expect(actions[0].action.kind).toBe('move')
  })

  it('prefiere el ataque de daño frente al movimiento de estado cuando puede acercar el KO', async () => {
    // Con el aliado a 60 PS, atacar (−60 → KO) debe ganar a bajar el ataque (Growl).
    const actions = await chooseAiActions(makeState(60, 100), makeBridge(), 'normal')
    expect(actions[0].action.kind).toBe('move')
    if (actions[0].action.kind === 'move') {
      expect(actions[0].action.move.name).toBe('Slam')
    }
  })
})

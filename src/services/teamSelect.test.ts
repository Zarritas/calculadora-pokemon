import { describe, expect, it } from 'vitest'
import { chooseAiTeam } from './teamSelect'
import { zeroStatPoints } from '@/utils/champions'
import type { ChampionsMon, ChampionsMove } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'

let id = 0
function build(name: string, types: ChampionsMon['types'], bs: ChampionsMon['baseStats'], moves: ChampionsMove[]): SavedBuild {
  return {
    id: `b${id++}`,
    name,
    mon: { name, dexNumber: 1, form: 'Base', types, abilities: ['Pressure'], baseStats: bs, sprite: '', spriteBase: '' },
    build: { statPoints: zeroStatPoints(), nature: 'Serious' },
    item: null,
    status: '',
    ability: 'Pressure',
    moves,
  }
}
const M = (name: string, type: ChampionsMove['type'], category: 'physical' | 'special', power: number): ChampionsMove =>
  ({ name, type, category, power, accuracy: 100, pp: 15, priority: 0 })

const BULK = { hp: 100, attack: 80, defense: 100, spAttack: 80, spDefense: 100, speed: 80 }

describe('chooseAiTeam', () => {
  const pool = [
    build('Uno', ['normal'], BULK, [M('Body Slam', 'normal', 'physical', 85)]),
    build('Dos', ['water'], BULK, [M('Surf', 'water', 'special', 90)]),
    build('Tres', ['fire'], BULK, [M('Flamethrower', 'fire', 'special', 90)]),
    build('Cuatro', ['grass'], BULK, [M('Energy Ball', 'grass', 'special', 90)]),
    build('Cinco', ['electric'], BULK, [M('Thunderbolt', 'electric', 'special', 90)]),
  ]
  const opponents = [build('Rival', ['water', 'ground'], BULK, [M('Earthquake', 'ground', 'physical', 100)])]

  it('easy: trae los 4 primeros en orden, sin estrategia', () => {
    const team = chooseAiTeam(pool, opponents, { difficulty: 'easy', doubles: false })
    expect(team.map((b) => b.name)).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro'])
  })

  it('siempre devuelve exactamente 4', () => {
    expect(chooseAiTeam(pool, opponents, { difficulty: 'hard', doubles: false })).toHaveLength(4)
    expect(chooseAiTeam(pool, opponents, { difficulty: 'easy', doubles: false })).toHaveLength(4)
  })

  it('normal/hard: prioriza el mejor emparejamiento (Hierba lidera vs Agua/Tierra)', () => {
    // El rival es Agua/Tierra: Hierba ("Cuatro") pega x4 y debería liderar;
    // el Eléctrico ("Cinco") no le hace nada (Tierra es inmune) y queda fuera.
    const team = chooseAiTeam(pool, opponents, { difficulty: 'normal', doubles: false })
    expect(team).toHaveLength(4)
    expect(team[0].name).toBe('Cuatro')
    expect(team.map((b) => b.name)).not.toContain('Cinco')
  })
})

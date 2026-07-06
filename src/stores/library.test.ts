import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild, SavedTeam } from '@/types/library'
import { zeroStatPoints } from '@/utils/champions'
import { useLibraryStore } from '@/stores/library'
import { useBattleStore } from '@/stores/battle'

function mon(): ChampionsMon {
  return {
    name: 'Pikachu',
    dexNumber: 25,
    form: 'Base',
    types: ['electric'],
    abilities: ['Static', 'Lightning Rod'],
    baseStats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
    sprite: '',
    spriteBase: '',
  }
}

function build(): SavedBuild {
  return {
    id: 'b1',
    name: 'Pikachu',
    mon: mon(),
    build: { statPoints: zeroStatPoints(), nature: 'Serious' },
    item: null,
    status: '',
    ability: 'Static',
    moves: [],
  }
}

describe('clonado de builds: abilities siempre como array', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('createTeamFrom mantiene abilities como array (no lo convierte en objeto)', () => {
    const lib = useLibraryStore()
    const team = lib.createTeamFrom('Equipo importado', [build()])
    const abilities = team.members[0].mon.abilities
    expect(Array.isArray(abilities)).toBe(true)
    expect(abilities).toEqual(['Static', 'Lightning Rod'])
  })

  it('cargar en batalla un equipo con abilities corruptas (objeto) no lanza y se auto-repara', () => {
    const battle = useBattleStore()
    // Simula un equipo importado con el bug antiguo: abilities guardadas como
    // objeto {0:'Static', 1:'Lightning Rod'} en vez de array.
    const corrupt = build()
    ;(corrupt.mon as unknown as { abilities: unknown }).abilities = {
      0: 'Static',
      1: 'Lightning Rod',
    }
    const team = { id: 't1', name: 'Roto', members: [corrupt] } as SavedTeam

    expect(() => battle.loadTeam('ally', team)).not.toThrow()
    const loaded = battle.ally[0].mon.abilities
    expect(Array.isArray(loaded)).toBe(true)
    expect(loaded).toEqual(['Static', 'Lightning Rod'])
  })
})

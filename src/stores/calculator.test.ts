import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ChampionsMon } from '@/types/pokemon'
import type { CombatantSnapshot } from '@/types/library'
import { zeroStatPoints } from '@/utils/champions'
import { useCalculatorStore } from '@/stores/calculator'

function venusaur(): ChampionsMon {
  return {
    name: 'Venusaur',
    dexNumber: 3,
    form: 'Base',
    types: ['grass', 'poison'],
    abilities: ['Overgrow', 'Chlorophyll'],
    baseStats: { hp: 80, attack: 82, defense: 83, spAttack: 100, spDefense: 100, speed: 80 },
    sprite: '',
    spriteBase: '',
  }
}

describe('calculator applyBuild — habilidad', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('preserva la habilidad guardada aunque abilities esté corrupta como objeto', () => {
    const store = useCalculatorStore()
    const mon = venusaur()
    // Datos antiguos: abilities guardada como objeto {0:'Overgrow',1:'Chlorophyll'}.
    ;(mon as unknown as { abilities: unknown }).abilities = { 0: 'Overgrow', 1: 'Chlorophyll' }
    const saved: CombatantSnapshot = {
      mon,
      build: { statPoints: zeroStatPoints(), nature: 'Serious' },
      item: null,
      status: '',
      ability: 'Chlorophyll',
      moves: [],
    }

    store.applyBuild('attacker', saved)

    // Se repara a array y se conserva la habilidad guardada (no la primera).
    expect(Array.isArray(store.attacker?.abilities)).toBe(true)
    expect(store.attacker?.abilities).toEqual(['Overgrow', 'Chlorophyll'])
    expect(store.attackerAbility).toBe('Chlorophyll')
  })
})

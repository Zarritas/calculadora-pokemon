import { describe, expect, it, vi } from 'vitest'
import type { ChampionsMon } from '@/types/pokemon'
import type { Matchup } from '@/types/library'
import { zeroBoosts, zeroStatPoints } from '@/utils/champions'
import { defaultField } from '@/utils/field'

function mon(name: string): ChampionsMon {
  return {
    name,
    dexNumber: 445,
    form: 'Base',
    types: ['dragon', 'ground'],
    abilities: ['Rough Skin'],
    baseStats: { hp: 108, attack: 130, defense: 95, spAttack: 80, spDefense: 85, speed: 102 },
    sprite: 'https://example.com/very/long/sprite/url.png',
    spriteBase: 'https://example.com/very/long/sprite/base.png',
  }
}

vi.mock('@/services/championsData', () => ({
  getRoster: async () => [mon('Garchomp'), mon('Rotom')],
  getMove: async (name: string) => ({ name, type: 'ground', category: 'physical', power: 100, accuracy: 100, pp: 10, priority: 0 }),
}))

import { encodeMatchup, decodeMatchup } from './calcShare'

const move = { name: 'Earthquake', type: 'ground' as const, category: 'physical' as const, power: 100, accuracy: 100, pp: 10, priority: 0 }

const matchup: Matchup = {
  id: 'm1',
  savedAt: 0,
  name: 'Garchomp vs Rotom',
  attacker: {
    mon: mon('Garchomp'),
    build: { statPoints: { ...zeroStatPoints(), attack: 32, speed: 32 }, nature: 'Jolly' },
    item: 'Rocky Helmet',
    status: '',
    ability: 'Rough Skin',
    moves: [move],
    boosts: zeroBoosts(),
  },
  defender: {
    mon: mon('Rotom'),
    build: { statPoints: zeroStatPoints(), nature: 'Bold' },
    item: null,
    status: '',
    ability: 'Rough Skin',
    moves: [],
    boosts: zeroBoosts(),
  },
  move,
  field: defaultField(),
  summary: { minPercent: 0, maxPercent: 0, koText: '' },
}

describe('calcShare (URL compacta)', () => {
  it('el JSON compacto no incluye datos pesados del Pokémon (stats base, sprites)', () => {
    const text = encodeMatchup(matchup)
    expect(text).not.toContain('baseStats')
    expect(text).not.toContain('sprite')
    expect(text).toContain('Garchomp')
    expect(text.length).toBeLessThan(400) // mucho más corto que el JSON completo
  })

  it('round-trip: codificar y rehidratar conserva el enfrentamiento', async () => {
    const restored = await decodeMatchup(encodeMatchup(matchup))
    expect(restored).not.toBeNull()
    expect(restored!.attacker.mon.name).toBe('Garchomp')
    expect(restored!.attacker.mon.baseStats.attack).toBe(130) // rehidratado del roster
    expect(restored!.attacker.item).toBe('Rocky Helmet')
    expect(restored!.attacker.build.nature).toBe('Jolly')
    expect(restored!.attacker.build.statPoints.attack).toBe(32)
    expect(restored!.defender.mon.name).toBe('Rotom')
    expect(restored!.move.name).toBe('Earthquake')
  })

  it('devuelve null si el Pokémon no está en el roster', async () => {
    const bad = encodeMatchup({ ...matchup, attacker: { ...matchup.attacker, mon: mon('Inexistente') } })
    expect(await decodeMatchup(bad)).toBeNull()
  })
})

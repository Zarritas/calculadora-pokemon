import { describe, expect, it, vi } from 'vitest'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'

function mon(name: string, types: ChampionsMon['types'], abilities: string[]): ChampionsMon {
  return {
    name,
    dexNumber: 445,
    form: 'Base',
    types,
    abilities,
    baseStats: { hp: 108, attack: 130, defense: 95, spAttack: 80, spDefense: 85, speed: 102 },
    sprite: '',
    spriteBase: '',
  }
}

// Roster y movimientos simulados (evita la descarga real del dataset).
vi.mock('@/services/championsData', () => ({
  getRoster: async () => [mon('Garchomp', ['dragon', 'ground'], ['Rough Skin', 'Sand Veil'])],
  getMove: async (name: string) => ({
    name,
    type: 'ground',
    category: 'physical',
    power: 100,
    accuracy: 100,
    pp: 10,
    priority: 0,
  }),
}))

import { exportShowdown, parseShowdown } from './showdown'

const build: SavedBuild = {
  id: '1',
  name: 'Garchomp',
  mon: mon('Garchomp', ['dragon', 'ground'], ['Rough Skin']),
  build: {
    statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 },
    nature: 'Jolly',
  },
  item: 'Rocky Helmet',
  status: '',
  ability: 'Rough Skin',
  moves: [{ name: 'Earthquake', type: 'ground', category: 'physical', power: 100, accuracy: 100, pp: 10, priority: 0 }],
}

describe('exportShowdown', () => {
  it('serializa una build al formato de texto de Showdown', () => {
    const text = exportShowdown([build])
    expect(text).toContain('Garchomp @ Rocky Helmet')
    expect(text).toContain('Ability: Rough Skin')
    expect(text).toContain('Level: 50')
    expect(text).toContain('32 Atk') // Stat Points tal cual (sin convertir a EVs)
    expect(text).toContain('32 Spe')
    expect(text).toContain('2 HP')
    expect(text).toContain('Jolly Nature')
    expect(text).toContain('- Earthquake')
  })
})

describe('parseShowdown', () => {
  it('parsea texto Showdown a una build (EVs→SP, movimientos hidratados)', async () => {
    const text = [
      'Garchomp @ Rocky Helmet',
      'Ability: Rough Skin',
      'EVs: 32 Atk / 32 Spe / 2 HP',
      'Jolly Nature',
      '- Earthquake',
      '- Dragon Claw',
    ].join('\n')
    const { builds } = await parseShowdown(text)
    expect(builds).toHaveLength(1)
    const b = builds[0]
    expect(b.mon.name).toBe('Garchomp')
    expect(b.item).toBe('Rocky Helmet')
    expect(b.ability).toBe('Rough Skin')
    expect(b.build.nature).toBe('Jolly')
    expect(b.build.statPoints.attack).toBe(32) // Stat Points directos
    expect(b.build.statPoints.speed).toBe(32)
    expect(b.build.statPoints.hp).toBe(2)
    expect((b.moves ?? []).map((m) => m.name)).toEqual(['Earthquake', 'Dragon Claw'])
  })

  it('recoge un aviso si el Pokémon no se reconoce (y no aborta si hay otros)', async () => {
    const { errors } = await parseShowdown('Mewthree @ Item\n- Splash\n\nGarchomp\n- Earthquake')
    expect(errors.some((e) => e.includes('Mewthree'))).toBe(true)
  })

  it('lanza si no hay nada que importar', async () => {
    await expect(parseShowdown('   ')).rejects.toThrow()
  })
})

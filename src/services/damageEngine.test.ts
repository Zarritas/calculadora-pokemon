import { describe, it, expect } from 'vitest'
import { runCalc, type Combatant } from './damageEngine'
import { zeroStatPoints } from '@/utils/champions'
import { defaultField as defaultFieldState } from '@/utils/field'
import type { ChampionsMon, ChampionsMove, StatSpread } from '@/types/pokemon'

function mon(overrides: Partial<ChampionsMon> = {}): ChampionsMon {
  return {
    name: 'Venusaur',
    dexNumber: 3,
    form: 'Base',
    types: ['grass', 'poison'],
    abilities: ['Overgrow'],
    baseStats: { hp: 80, attack: 82, defense: 83, spAttack: 100, spDefense: 100, speed: 80 },
    sprite: '',
    spriteBase: '',
    ...overrides,
  }
}

function combatant(m: ChampionsMon, sp: Partial<StatSpread> = {}, nature = 'Serious'): Combatant {
  return { mon: m, build: { statPoints: { ...zeroStatPoints(), ...sp }, nature } }
}

const move = (o: Partial<ChampionsMove> = {}): ChampionsMove => ({
  name: 'Flamethrower',
  type: 'fire',
  category: 'special',
  power: 90,
  accuracy: 100,
  pp: 15,
  priority: 0,
  ...o,
})

describe('runCalc (motor @smogon/calc + dataset Champions)', () => {
  it('calcula un rango válido (mín <= máx > 0)', () => {
    const r = runCalc({
      attacker: combatant(mon({ name: 'Charizard', types: ['fire', 'flying'] }), { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move(),
    })
    expect(r.minDamage).toBeGreaterThan(0)
    expect(r.minDamage).toBeLessThanOrEqual(r.maxDamage)
    expect(r.koText).toContain('KO')
  })

  it('calcula una megaevolución con sus tipos y stats override', () => {
    const megaCharX = mon({
      name: 'Mega Charizard X',
      form: 'Mega',
      types: ['fire', 'dragon'],
      abilities: ['Tough Claws'],
      baseStats: { hp: 78, attack: 130, defense: 111, spAttack: 130, spDefense: 85, speed: 100 },
    })
    const r = runCalc({
      attacker: combatant(megaCharX, { attack: 32 }, 'Adamant'),
      defender: combatant(mon()),
      move: move({ name: 'Flare Blitz', type: 'fire', category: 'physical', power: 120 }),
    })
    expect(r.maxDamage).toBeGreaterThan(0)
    expect(r.koText).toContain('OHKO')
  })

  it('calcula una forma regional (Alolan Ninetales)', () => {
    const alolan = mon({
      name: 'Alolan Ninetales',
      form: 'Regional',
      types: ['ice', 'fairy'],
      abilities: ['Snow Warning'],
      baseStats: { hp: 73, attack: 67, defense: 75, spAttack: 81, spDefense: 100, speed: 109 },
    })
    const r = runCalc({
      attacker: combatant(alolan, { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move({ name: 'Blizzard', type: 'ice', category: 'special', power: 110 }),
    })
    expect(r.maxDamage).toBeGreaterThan(0)
  })

  it('un golpe crítico hace más daño', () => {
    const base = {
      attacker: combatant(mon({ name: 'Charizard', types: ['fire', 'flying'] }), { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move(),
    }
    const normal = runCalc(base)
    const crit = runCalc({ ...base, isCrit: true })
    expect(crit.maxDamage).toBeGreaterThan(normal.maxDamage)
  })

  it('aplica el efecto de un objeto (Life Orb sube el daño)', () => {
    const attacker = mon({ name: 'Venusaur', types: ['grass', 'poison'] })
    const base = {
      defender: combatant(mon()),
      move: move({ name: 'Sludge Bomb', type: 'poison', category: 'special', power: 90 }),
    }
    const noItem = runCalc({ attacker: combatant(attacker, { spAttack: 32 }, 'Modest'), ...base })
    const withOrb = runCalc({
      attacker: { ...combatant(attacker, { spAttack: 32 }, 'Modest'), item: 'Life Orb' },
      ...base,
    })
    expect(withOrb.maxDamage).toBeGreaterThan(noItem.maxDamage)
  })

  it('el clima Sol potencia los movimientos de Fuego', () => {
    const charizard = mon({ name: 'Charizard', types: ['fire', 'flying'] })
    const base = {
      attacker: combatant(charizard, { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move(),
    }
    const noWeather = runCalc(base)
    const sun = runCalc({ ...base, field: { ...defaultFieldState(), weather: 'Sun' } })
    expect(sun.maxDamage).toBeGreaterThan(noWeather.maxDamage)
  })

  it('el quemado reduce el daño físico a la mitad', () => {
    const attacker = mon({ name: 'Tauros', types: ['normal'], baseStats: { hp: 75, attack: 100, defense: 95, spAttack: 40, spDefense: 70, speed: 110 } })
    const base = {
      defender: combatant(mon()),
      move: move({ name: 'Body Slam', type: 'normal', category: 'physical', power: 85 }),
    }
    const healthy = runCalc({ attacker: combatant(attacker, { attack: 32 }, 'Adamant'), ...base })
    const burned = runCalc({
      attacker: { ...combatant(attacker, { attack: 32 }, 'Adamant'), status: 'brn' },
      ...base,
    })
    expect(burned.maxDamage).toBeLessThan(healthy.maxDamage)
  })

  it('la habilidad del defensor afecta el daño (Thick Fat reduce Fuego)', () => {
    const attacker = combatant(
      mon({ name: 'Charizard', types: ['fire', 'flying'] }),
      { spAttack: 32 },
      'Modest',
    )
    const normal = runCalc({
      attacker,
      defender: { ...combatant(mon()), ability: 'Overgrow' },
      move: move(),
    })
    const thickFat = runCalc({
      attacker,
      defender: { ...combatant(mon()), ability: 'Thick Fat' },
      move: move(),
    })
    expect(thickFat.maxDamage).toBeLessThan(normal.maxDamage)
  })

  it('los boosts de ataque aumentan el daño (+2 Atq)', () => {
    const tauros = mon({
      name: 'Tauros',
      types: ['normal'],
      baseStats: { hp: 75, attack: 100, defense: 95, spAttack: 40, spDefense: 70, speed: 110 },
    })
    const base = {
      defender: combatant(mon()),
      move: move({ name: 'Body Slam', type: 'normal', category: 'physical', power: 85 }),
    }
    const neutral = runCalc({ attacker: combatant(tauros, { attack: 32 }, 'Adamant'), ...base })
    const boosted = runCalc({
      attacker: {
        ...combatant(tauros, { attack: 32 }, 'Adamant'),
        boosts: { attack: 2, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
      },
      ...base,
    })
    expect(boosted.maxDamage).toBeGreaterThan(neutral.maxDamage)
  })

  it('Mano Amiga aumenta el daño del atacante (×1.5)', () => {
    const charizard = mon({ name: 'Charizard', types: ['fire', 'flying'] })
    const base = {
      attacker: combatant(charizard, { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move(),
    }
    const normal = runCalc(base)
    const helped = runCalc({ ...base, field: { ...defaultFieldState(), helpingHand: true } })
    expect(helped.maxDamage).toBeGreaterThan(normal.maxDamage)
  })

  it('la Pantalla de Luz reduce el daño especial', () => {
    const charizard = mon({ name: 'Charizard', types: ['fire', 'flying'] })
    const base = {
      attacker: combatant(charizard, { spAttack: 32 }, 'Modest'),
      defender: combatant(mon()),
      move: move(),
    }
    const open = runCalc(base)
    const screened = runCalc({ ...base, field: { ...defaultFieldState(), lightScreen: true } })
    expect(screened.maxDamage).toBeLessThan(open.maxDamage)
  })
})

import { describe, expect, it } from 'vitest'
import { getMoveEffect } from './moveEffects'

describe('getMoveEffect: movimientos de clima', () => {
  it('mapea el clima que invoca cada movimiento', () => {
    expect(getMoveEffect('Sunny Day')?.weather).toBe('Sun')
    expect(getMoveEffect('Rain Dance')?.weather).toBe('Rain')
    expect(getMoveEffect('Sandstorm')?.weather).toBe('Sand')
    expect(getMoveEffect('Snowscape')?.weather).toBe('Snow')
  })

  it('un movimiento que no cambia el clima no tiene weather', () => {
    expect(getMoveEffect('Tackle')?.weather).toBeUndefined()
    expect(getMoveEffect('Growl')?.weather).toBeUndefined()
  })
})

describe('getMoveEffect: movimientos de terreno', () => {
  it('mapea el terreno que invoca cada movimiento', () => {
    expect(getMoveEffect('Electric Terrain')?.terrain).toBe('Electric')
    expect(getMoveEffect('Grassy Terrain')?.terrain).toBe('Grassy')
    expect(getMoveEffect('Psychic Terrain')?.terrain).toBe('Psychic')
    expect(getMoveEffect('Misty Terrain')?.terrain).toBe('Misty')
  })

  it('un movimiento que no cambia el terreno no tiene terrain', () => {
    expect(getMoveEffect('Tackle')?.terrain).toBeUndefined()
  })
})

describe('getMoveEffect: % de secundarios ajustados por Champions', () => {
  it('aplica los porcentajes de Champions (Cabeza de Hierro 20%, Fuerza Lunar 10%, Garra Dragón/Dire Claw 30%)', () => {
    expect(getMoveEffect('Iron Head')?.secondaries?.[0].chance).toBe(20)
    expect(getMoveEffect('Moonblast')?.secondaries?.[0].chance).toBe(10)
    expect(getMoveEffect('Dire Claw')?.secondaries?.[0].chance).toBe(30)
  })
})

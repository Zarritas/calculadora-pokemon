import { describe, expect, it } from 'vitest'
import { STAT_PRESETS, SP_TOTAL, SP_PER_STAT_MAX, totalStatPoints, STAT_ORDER } from './champions'

describe('STAT_PRESETS', () => {
  it('cada preset suma exactamente el presupuesto total de SP', () => {
    for (const p of STAT_PRESETS) {
      expect(totalStatPoints(p.sp)).toBe(SP_TOTAL)
    }
  })

  it('ningún preset supera el tope por estadística', () => {
    for (const p of STAT_PRESETS) {
      for (const s of STAT_ORDER) {
        expect(p.sp[s.key]).toBeLessThanOrEqual(SP_PER_STAT_MAX)
        expect(p.sp[s.key]).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

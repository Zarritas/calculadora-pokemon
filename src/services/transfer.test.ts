import { describe, expect, it } from 'vitest'
import { encodeShare, decodeShare } from './transfer'

describe('transfer: compartir por URL', () => {
  it('codifica y decodifica texto (URL-safe, con unicode)', () => {
    const text = 'Garchomp @ Vidasfera\n- Terremoto\ncon acentos: ñ á é'
    const code = encodeShare(text)
    expect(code).not.toMatch(/[+/=]/) // base64 URL-safe
    expect(decodeShare(code)).toBe(text)
  })
})

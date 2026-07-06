import { describe, expect, it, vi, beforeEach } from 'vitest'
import { setLocale } from '@/i18n'
import { localizeMove } from './nameLocale'

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      names: [
        { language: { name: 'es' }, name: 'Terremoto' },
        { language: { name: 'en' }, name: 'Earthquake' },
      ],
    }),
  })) as unknown as typeof fetch
})

describe('nameLocale', () => {
  it('en inglés devuelve el nombre original (sin pedir nada)', () => {
    setLocale('en')
    expect(localizeMove('Earthquake')).toBe('Earthquake')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('en español devuelve el original y, tras cargar, el nombre ES', async () => {
    setLocale('es')
    expect(localizeMove('Earthquake')).toBe('Earthquake') // aún no cacheado → lanza la petición
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(localizeMove('Earthquake')).toBe('Terremoto') // ya cacheado
  })
})

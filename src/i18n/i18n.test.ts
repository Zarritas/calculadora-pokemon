import { describe, expect, it } from 'vitest'
import { t, setLocale } from './index'

describe('i18n', () => {
  it('traduce según el idioma activo', () => {
    setLocale('es')
    expect(t('nav.calculator')).toBe('Calculadora')
    setLocale('en')
    expect(t('nav.calculator')).toBe('Calculator')
  })

  it('hace fallback a la clave si no existe', () => {
    expect(t('esto.no.existe')).toBe('esto.no.existe')
  })

  it('interpola parámetros', () => {
    setLocale('es')
    expect(t('calc.badge', { level: 50 })).toBe('Champions · Nv. 50')
    setLocale('en')
    expect(t('calc.badge', { level: 50 })).toBe('Champions · Lv. 50')
  })
})

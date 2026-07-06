import { ref } from 'vue'
import { messages, type Locale } from './messages'

/**
 * i18n mínimo y sin dependencias. `t()` lee el `locale` reactivo, así que los
 * textos usados en plantillas se re-renderizan al cambiar de idioma. El idioma
 * se persiste en localStorage y, si no hay preferencia, se detecta del navegador.
 */

const STORAGE_KEY = 'pkmn-lib:locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* sin localStorage */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')
    ? 'en'
    : 'es'
}

export const locale = ref<Locale>(initialLocale())

export function setLocale(l: Locale): void {
  locale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    /* sin localStorage */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l
}

if (typeof document !== 'undefined') document.documentElement.lang = locale.value

/** Traduce una clave con puntos (`nav.calculator`), interpolando `{param}`. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[locale.value] ?? messages.es
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict)
  let str = typeof raw === 'string' ? raw : key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

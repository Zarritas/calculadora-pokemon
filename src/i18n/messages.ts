/**
 * Textos de la interfaz en español e inglés. Migración progresiva: se van
 * moviendo aquí los textos de cada vista. Interpolación con `{param}`.
 */
export type Locale = 'es' | 'en'

export const messages: Record<Locale, Record<string, unknown>> = {
  es: {
    nav: {
      calculator: 'Calculadora',
      battle: 'Batalla',
      simulator: 'Simulador',
      builds: 'Builds',
      teams: 'Equipos',
      matchups: 'Enfrentamientos',
      about: 'Acerca de',
    },
    app: {
      brand: 'Calculadora',
      footer:
        'Datos del dataset abierto de Pokémon Champions y motor @smogon/calc. Proyecto no oficial, sin ánimo de lucro.',
      language: 'Idioma',
      support: '💜 Apóyame en Patreon',
    },
    calc: {
      title: 'Calculadora de daño',
      badge: 'Champions · Nv. {level}',
      hint: 'Solo Pokémon, movimientos, megas y objetos disponibles en Pokémon Champions. Reparte los 66 Stat Points (máx. 32 por stat) y la naturaleza. Cálculo con @smogon/calc.',
      save: 'Guardar enfrentamiento',
      saved: '✓ Guardado',
      share: 'Compartir cálculo',
      shared: '✓ Enlace copiado',
      viewMatchups: 'Ver enfrentamientos',
      placeholder: 'Completa atacante, movimiento y defensor para ver el daño.',
      clear: 'Limpiar',
      swap: '⇄ Invertir',
    },
  },
  en: {
    nav: {
      calculator: 'Calculator',
      battle: 'Battle',
      simulator: 'Simulator',
      builds: 'Builds',
      teams: 'Teams',
      matchups: 'Matchups',
      about: 'About',
    },
    app: {
      brand: 'Calculator',
      footer:
        'Data from the open Pokémon Champions dataset and the @smogon/calc engine. Unofficial, non-profit project.',
      language: 'Language',
      support: '💜 Support me on Patreon',
    },
    calc: {
      title: 'Damage calculator',
      badge: 'Champions · Lv. {level}',
      hint: 'Only Pokémon, moves, megas and items available in Pokémon Champions. Spend the 66 Stat Points (max 32 per stat) and pick the nature. Powered by @smogon/calc.',
      save: 'Save matchup',
      saved: '✓ Saved',
      share: 'Share calc',
      shared: '✓ Link copied',
      viewMatchups: 'View matchups',
      placeholder: 'Pick attacker, move and defender to see the damage.',
      clear: 'Clear',
      swap: '⇄ Swap',
    },
  },
}

import type { PokemonType } from '@/types/pokemon'

/** Color representativo de cada tipo, para chips y acentos en la UI. */
export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#a8a77a',
  fire: '#ee8130',
  water: '#6390f0',
  electric: '#f7d02c',
  grass: '#7ac74c',
  ice: '#96d9d6',
  fighting: '#c22e28',
  poison: '#a33ea1',
  ground: '#e2bf65',
  flying: '#a98ff3',
  psychic: '#f95587',
  bug: '#a6b91a',
  rock: '#b6a136',
  ghost: '#735797',
  dragon: '#6f35fc',
  dark: '#705746',
  steel: '#b7b7ce',
  fairy: '#d685ad',
}

/**
 * Color de texto legible (negro o blanco) sobre el color del tipo, según la
 * luminancia relativa (WCAG). Los tipos claros (Eléctrico, Hielo, Acero…) usan
 * texto oscuro para superar el ratio de contraste 4.5:1.
 */
export function typeTextColor(type: PokemonType): string {
  const hex = TYPE_COLORS[type].replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // Contraste con blanco vs. con negro: elige el que más contraste dé.
  const contrastWhite = 1.05 / (luminance + 0.05)
  const contrastBlack = (luminance + 0.05) / 0.05
  return contrastBlack >= contrastWhite ? '#1a1a1a' : '#ffffff'
}

/** Nombre del tipo en español para mostrar. */
export const TYPE_LABELS: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
}

import { Sprites } from '@pkmn/img'
import type { ChampionsForm, DamageClass, PokemonType } from '@/types/pokemon'

/**
 * Traducción entre los nombres del dataset de Champions y los que espera
 * @smogon/calc, además de normalizaciones de tipos y categorías.
 */

/** "Grass" -> "grass". */
export function normalizeType(t: string): PokemonType {
  return t.toLowerCase() as PokemonType
}

/** "Special" -> "special". */
export function normalizeCategory(c: string): DamageClass {
  return c.toLowerCase() as DamageClass
}

const REGIONAL_PREFIX: Record<string, string> = {
  Alolan: 'Alola',
  Galarian: 'Galar',
  Hisuian: 'Hisui',
  Paldean: 'Paldea',
}

/**
 * Nombre de especie para @smogon/calc. Devuelve el candidato principal y una
 * lista de alternativas de reserva (el motor prueba en orden hasta que una
 * exista en la base de datos de la librería).
 */
export function smogonNameCandidates(name: string, form: ChampionsForm): string[] {
  if (form === 'Mega') {
    const rest = name.replace(/^Mega\s+/, '').trim()
    const xy = rest.match(/^(.*)\s+([XY])$/)
    if (xy) return [`${xy[1].trim()}-Mega-${xy[2]}`, xy[1].trim()]
    return [`${rest}-Mega`, rest]
  }

  if (form === 'Regional') {
    const parts = name.split(' ')
    const prefix = REGIONAL_PREFIX[parts[0]]
    const base = parts.slice(1).join(' ')
    if (prefix && base) {
      // Paldean Tauros por defecto es la variante Combat en @smogon/calc.
      if (base === 'Tauros' && prefix === 'Paldea') {
        return ['Tauros-Paldea-Combat', 'Tauros']
      }
      return [`${base}-${prefix}`, base]
    }
    return [name]
  }

  return [name]
}

/** Sprite por número de Pokédex (repo oficial de sprites de PokéAPI). */
export function spriteUrl(dexNumber: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber}.png`
}

/** Sprite específico de forma (Pokémon Showdown) a partir del nombre @smogon. */
export function showdownSprite(smogonName: string): string {
  try {
    return (Sprites.getPokemon(smogonName, { gen: 'gen5' }).url as string) ?? ''
  } catch {
    return ''
  }
}

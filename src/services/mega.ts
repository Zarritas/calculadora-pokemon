import { Dex } from '@pkmn/dex'
import type { ChampionsMon, PokemonType } from '@/types/pokemon'
import { showdownSprite, smogonNameCandidates } from '@/utils/championsNames'

/** Normaliza un nombre para comparar (minúsculas, sin separadores). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Construye una megaforma a partir de los datos de @pkmn/dex (respaldo si no está en el roster). */
function buildFromDex(megaForme: string, base: ChampionsMon): ChampionsMon | null {
  const sp = Dex.species.get(megaForme)
  if (!sp || !sp.exists) return null
  const ab = sp.abilities as { 0: string; 1?: string; H?: string; S?: string }
  const abilities = [ab['0'], ab['1'], ab.H, ab.S].filter((x): x is string => Boolean(x))
  const bs = sp.baseStats as { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  const suffix = megaForme.match(/-Mega-([A-Z])$/)?.[1]
  return {
    name: `Mega ${base.name}${suffix ? ` ${suffix}` : ''}`,
    dexNumber: base.dexNumber,
    form: 'Mega',
    types: (sp.types as readonly string[]).map((t) => t.toLowerCase() as PokemonType),
    abilities: abilities.length ? abilities : base.abilities,
    baseStats: {
      hp: bs.hp,
      attack: bs.atk,
      defense: bs.def,
      spAttack: bs.spa,
      spDefense: bs.spd,
      speed: bs.spe,
    },
    sprite: showdownSprite(megaForme) || base.spriteBase,
    spriteBase: base.spriteBase,
  }
}

/**
 * Dada una forma base, su objeto equipado y el roster de Champions, devuelve la
 * megaforma correspondiente si el objeto es la mega piedra adecuada; si no, null.
 */
export function findMegaForm(
  base: ChampionsMon,
  itemName: string | null,
  roster: ChampionsMon[],
): ChampionsMon | null {
  if (!itemName || base.form !== 'Base') return null

  const item = Dex.items.get(itemName)
  const megaStone = (item as { exists?: boolean; megaStone?: Record<string, string> }).megaStone
  if (!item.exists || !megaStone) return null

  for (const [baseSpecies, megaForme] of Object.entries(megaStone)) {
    if (norm(base.name) !== norm(baseSpecies)) continue
    // 1) Preferir la entrada del roster de Champions si existe.
    const found = roster.find(
      (m) => m.form === 'Mega' && smogonNameCandidates(m.name, 'Mega')[0] === megaForme,
    )
    if (found) return found
    // 2) Si no está en el roster, construirla desde @pkmn/dex.
    const built = buildFromDex(megaForme, base)
    if (built) return built
  }
  return null
}

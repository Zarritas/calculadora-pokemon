import type { ChampionsMove, StatKey, StatSpread } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { getMove, getRoster } from '@/services/championsData'
import { smogonNameCandidates } from '@/utils/championsNames'
import { SP_PER_STAT_MAX, SP_TOTAL, zeroBoosts, zeroStatPoints } from '@/utils/champions'
import { DEFAULT_NATURE, NATURE_OPTIONS } from '@/utils/natures'
import { newId } from '@/services/storage'

/**
 * Importar/exportar builds y equipos en el formato de texto de Pokémon
 * Showdown/Smogon (el estándar para compartir sets). Como Champions usa Stat
 * Points en vez de EVs (1 SP = 8 EV), se convierte en ambos sentidos; los
 * movimientos e info del Pokémon se rehidratan desde el dataset de Champions.
 */

/** Orden de stats en la línea EVs de Showdown. */
const EV_LABELS: [StatKey, string][] = [
  ['hp', 'HP'],
  ['attack', 'Atk'],
  ['defense', 'Def'],
  ['spAttack', 'SpA'],
  ['spDefense', 'SpD'],
  ['speed', 'Spe'],
]
const EV_LABEL_TO_KEY: Record<string, StatKey> = {
  hp: 'hp',
  atk: 'attack',
  def: 'defense',
  spa: 'spAttack',
  spd: 'spDefense',
  spe: 'speed',
}

/* ---------- Exportar ---------- */

function evLine(sp: StatSpread): string {
  // Champions usa Stat Points (0–32): se exportan tal cual, sin convertir a EVs.
  const parts: string[] = []
  for (const [key, label] of EV_LABELS) {
    if (sp[key] > 0) parts.push(`${sp[key]} ${label}`)
  }
  return parts.length ? `EVs: ${parts.join(' / ')}` : ''
}

/** Un build → bloque de texto Showdown. */
function exportSet(b: SavedBuild): string {
  const species = smogonNameCandidates(b.mon.name, b.mon.form)[0]
  const lines: string[] = [b.item ? `${species} @ ${b.item}` : species]
  if (b.ability) lines.push(`Ability: ${b.ability}`)
  lines.push('Level: 50')
  const ev = evLine(b.build.statPoints)
  if (ev) lines.push(ev)
  if (b.build.nature) lines.push(`${b.build.nature} Nature`)
  for (const m of b.moves ?? []) lines.push(`- ${m.name}`)
  return lines.join('\n')
}

/** Varios builds → texto Showdown (bloques separados por línea en blanco). */
export function exportShowdown(builds: SavedBuild[]): string {
  return builds.map(exportSet).join('\n\n')
}

/* ---------- Parsear ---------- */

interface ParsedSet {
  species: string
  item: string | null
  ability: string | null
  nature: string | null
  evs: Partial<Record<StatKey, number>>
  moves: string[]
}

/** Parsea la primera línea (Nick (Species) (Género) @ Objeto). */
function parseSpeciesLine(line: string): { species: string; item: string | null } {
  let s = line.trim()
  let item: string | null = null
  const at = s.split(' @ ')
  if (at.length > 1) {
    s = at[0].trim()
    item = at.slice(1).join(' @ ').trim() || null
  }
  s = s.replace(/\s+\((?:M|F)\)\s*$/, '').trim() // quita el género
  const nick = s.match(/^.*\(([^)]+)\)\s*$/) // "Apodo (Especie)" → Especie
  if (nick) s = nick[1].trim()
  return { species: s, item }
}

function parseBlock(block: string): ParsedSet {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const set: ParsedSet = { species: '', item: null, ability: null, nature: null, evs: {}, moves: [] }
  let speciesDone = false
  for (const line of lines) {
    if (line.startsWith('-')) {
      const move = line.replace(/^-\s*/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim()
      if (move) set.moves.push(move)
      continue
    }
    if (/^Ability:/i.test(line)) {
      set.ability = line.slice(line.indexOf(':') + 1).trim()
      continue
    }
    if (/^EVs:/i.test(line)) {
      for (const part of line.slice(line.indexOf(':') + 1).split('/')) {
        const m = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i)
        if (m) set.evs[EV_LABEL_TO_KEY[m[2].toLowerCase()]] = Number(m[1])
      }
      continue
    }
    if (/ Nature$/i.test(line)) {
      set.nature = line.replace(/ Nature$/i, '').trim()
      continue
    }
    // Líneas que ignoramos (nivel fijo 50, IVs 31, Tera, Shiny, Happiness…).
    if (/^(Level|IVs|Tera Type|Shiny|Happiness|Gigantamax|Hidden Power):/i.test(line)) continue
    if (!speciesDone) {
      const parsed = parseSpeciesLine(line)
      set.species = parsed.species
      set.item = parsed.item
      speciesDone = true
    }
  }
  return set
}

/** Nombre normalizado para comparar (sin mayúsculas ni símbolos). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Lee los números de la línea EVs como Stat Points directos (sin conversión),
 * con tope por stat (32) y total (66). Si vienen valores de EV clásicos (p. ej.
 * 252), simplemente se recortan al máximo de SP.
 */
function readStatPoints(evs: Partial<Record<StatKey, number>>): StatSpread {
  const sp = zeroStatPoints()
  let total = 0
  for (const [key] of EV_LABELS) {
    let points = Math.min(SP_PER_STAT_MAX, Math.max(0, Math.round(evs[key] ?? 0)))
    if (total + points > SP_TOTAL) points = Math.max(0, SP_TOTAL - total)
    sp[key] = points
    total += points
  }
  return sp
}

export interface ShowdownParseResult {
  builds: SavedBuild[]
  errors: string[]
}

/**
 * Parsea texto en formato Showdown a builds de Champions. Asíncrono: rehidrata
 * el Pokémon (desde el roster) y los movimientos (desde el dataset). Las
 * entradas no reconocidas se recogen en `errors` sin abortar el resto.
 */
export async function parseShowdown(text: string): Promise<ShowdownParseResult> {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (!blocks.length) throw new Error('No hay ningún set que importar.')

  const roster = await getRoster()
  const builds: SavedBuild[] = []
  const errors: string[] = []

  for (const block of blocks) {
    const set = parseBlock(block)
    if (!set.species) continue
    const wanted = norm(set.species)
    // Resolución por prioridad para evitar que una forma regional/mega capture
    // el nombre base: p. ej. "Alolan Raichu" tiene como candidatos
    // ["Raichu-Alola", "Raichu"], así que "Raichu" (Kanto) debe resolverse por
    // nombre exacto ANTES de caer en el candidato base pelado de la de Alola.
    const mon =
      // 1) Nombre exacto del roster (Raichu → Raichu de Kanto).
      roster.find((m) => norm(m.name) === wanted) ??
      // 2) Candidato Smogon principal, ya cualificado con la forma
      //    (Raichu-Alola → Raichu de Alola).
      roster.find((m) => norm(smogonNameCandidates(m.name, m.form)[0]) === wanted) ??
      // 3) Último recurso: cualquier candidato (incluye el base pelado).
      roster.find((m) => smogonNameCandidates(m.name, m.form).some((c) => norm(c) === wanted))
    if (!mon) {
      errors.push(`No se reconoció el Pokémon "${set.species}".`)
      continue
    }

    const moves: ChampionsMove[] = []
    for (const name of set.moves.slice(0, 4)) {
      const cm = await getMove(name)
      if (cm) moves.push(cm)
      else errors.push(`Movimiento no encontrado: "${name}" (${mon.name}).`)
    }

    const nature = NATURE_OPTIONS.some((n) => n.name === set.nature) ? set.nature! : DEFAULT_NATURE
    const ability = mon.abilities.includes(set.ability ?? '') ? set.ability! : mon.abilities[0] ?? ''

    builds.push({
      id: newId(),
      name: mon.name,
      mon,
      build: { statPoints: readStatPoints(set.evs), nature },
      item: set.item,
      status: '',
      ability,
      moves,
      boosts: zeroBoosts(),
    })
  }

  if (!builds.length) throw new Error(errors[0] ?? 'No se pudo importar ningún set.')
  return { builds, errors }
}

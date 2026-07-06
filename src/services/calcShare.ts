import type { BoostSpread, FieldState, StatSpread, StatusCondition } from '@/types/pokemon'
import type { CombatantSnapshot, Matchup } from '@/types/library'
import { getMove, getRoster } from '@/services/championsData'
import { newId } from '@/services/storage'

/**
 * Codificación COMPACTA de un enfrentamiento para compartir por URL: en vez de
 * meter todos los datos del Pokémon (stats base, tipos, sprites…), se referencia
 * cada Pokémon y movimiento por su nombre y se rehidrata desde el dataset al
 * abrir el enlace. Reduce mucho la longitud de la URL.
 */

interface CompactSet {
  n: string // nombre del Pokémon
  i: string | null // objeto
  a: string // habilidad
  nat: string // naturaleza
  sp: number[] // Stat Points [hp, atk, def, spa, spd, spe]
  mv: string[] // nombres de movimientos
  st: StatusCondition
  b: number[] // boosts [atk, def, spa, spd, spe]
}

interface CompactMatchup {
  a: CompactSet
  d: CompactSet
  mv: string // movimiento seleccionado
  f: FieldState
}

function compactSet(s: CombatantSnapshot): CompactSet {
  const sp = s.build.statPoints
  const b = s.boosts
  return {
    n: s.mon.name,
    i: s.item,
    a: s.ability ?? '',
    nat: s.build.nature,
    sp: [sp.hp, sp.attack, sp.defense, sp.spAttack, sp.spDefense, sp.speed],
    mv: (s.moves ?? []).map((m) => m.name),
    st: s.status,
    b: b ? [b.attack, b.defense, b.spAttack, b.spDefense, b.speed] : [0, 0, 0, 0, 0],
  }
}

/** Enfrentamiento → JSON compacto (referencias por nombre). */
export function encodeMatchup(m: Matchup): string {
  const compact: CompactMatchup = {
    a: compactSet(m.attacker),
    d: compactSet(m.defender),
    mv: m.move.name,
    f: m.field,
  }
  return JSON.stringify(compact)
}

function statSpread(sp: number[]): StatSpread {
  return { hp: sp[0] ?? 0, attack: sp[1] ?? 0, defense: sp[2] ?? 0, spAttack: sp[3] ?? 0, spDefense: sp[4] ?? 0, speed: sp[5] ?? 0 }
}
function boostSpread(b: number[]): BoostSpread {
  return { attack: b[0] ?? 0, defense: b[1] ?? 0, spAttack: b[2] ?? 0, spDefense: b[3] ?? 0, speed: b[4] ?? 0 }
}

async function hydrateSet(
  c: CompactSet,
  roster: Awaited<ReturnType<typeof getRoster>>,
): Promise<CombatantSnapshot | null> {
  const mon = roster.find((m) => m.name === c.n)
  if (!mon) return null
  const moves = []
  for (const name of c.mv) {
    const cm = await getMove(name)
    if (cm) moves.push(cm)
  }
  return {
    mon,
    build: { statPoints: statSpread(c.sp), nature: c.nat },
    item: c.i,
    status: c.st,
    ability: c.a || mon.abilities[0] || '',
    moves,
    boosts: boostSpread(c.b),
  }
}

/** JSON compacto → enfrentamiento completo (rehidratado desde el dataset), o null. */
export async function decodeMatchup(text: string): Promise<Matchup | null> {
  let raw: CompactMatchup
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw?.a || !raw?.d || !raw?.mv) return null
  const roster = await getRoster()
  const attacker = await hydrateSet(raw.a, roster)
  const defender = await hydrateSet(raw.d, roster)
  const move = await getMove(raw.mv)
  if (!attacker || !defender || !move) return null
  return {
    id: newId(),
    savedAt: 0,
    name: `${attacker.mon.name} vs ${defender.mon.name}`,
    attacker,
    defender,
    move,
    field: raw.f,
    summary: { minPercent: 0, maxPercent: 0, koText: '' },
  }
}

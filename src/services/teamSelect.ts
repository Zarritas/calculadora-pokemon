import type { SavedBuild } from '@/types/library'
import { runCalc, type Combatant } from '@/services/damageEngine'
import type { Difficulty } from '@/stores/simulator'

/**
 * Selección del equipo de combate de la IA (fase de "team preview").
 *
 * Depende de la dificultad:
 * - `easy`: trae los 4 primeros de su equipo, en orden (sin estrategia).
 * - `normal`/`hard`: ve el equipo rival y elige sus 4 con mejor emparejamiento,
 *   ordenándolos para que lidere el que mejor responde al líder rival.
 *
 * El emparejamiento se puntúa con el motor de daño real: cuánto amenaza un
 * Pokémon al rival (ofensiva) menos cuánto lo amenaza el rival (defensiva).
 */

/** Nº de Pokémon que se llevan al combate. */
const BRING = 4

function combatantFromBuild(b: SavedBuild): Combatant {
  return {
    mon: b.mon,
    build: b.build,
    item: b.item,
    status: b.status,
    ability: b.ability,
    boosts: b.boosts,
  }
}

/** Mejor daño medio (%) que `attacker` puede hacer a `defender` con su moveset. */
function bestDamagePct(attacker: SavedBuild, defender: SavedBuild, doubles: boolean): number {
  let best = 0
  for (const move of attacker.moves ?? []) {
    if (move.power == null || move.category === 'status') continue
    try {
      const r = runCalc({
        attacker: combatantFromBuild(attacker),
        defender: combatantFromBuild(defender),
        move,
        doubles,
      })
      const pct = (r.minPercent + r.maxPercent) / 2
      if (pct > best) best = pct
    } catch {
      /* movimiento no reconocido: se ignora */
    }
  }
  return best
}

/** Puntuación de un Pokémon frente a un rival concreto: ofensiva − defensiva. */
function vsOne(mon: SavedBuild, foe: SavedBuild, doubles: boolean): number {
  return bestDamagePct(mon, foe, doubles) - bestDamagePct(foe, mon, doubles)
}

/** Puntuación de un Pokémon frente a todo el equipo rival (media). */
function vsTeam(mon: SavedBuild, foes: SavedBuild[], doubles: boolean): number {
  if (!foes.length) return 0
  return foes.reduce((sum, f) => sum + vsOne(mon, f, doubles), 0) / foes.length
}

/**
 * Elige (y ordena) los 4 Pokémon que la IA lleva al combate.
 * `pool` es el equipo configurado de la IA (4–6); `opponents`, los 4 del jugador.
 */
export function chooseAiTeam(
  pool: SavedBuild[],
  opponents: SavedBuild[],
  opts: { difficulty: Difficulty; doubles: boolean },
): SavedBuild[] {
  if (opts.difficulty === 'easy' || pool.length <= BRING) return pool.slice(0, BRING)

  // Mejores 4 por emparejamiento contra el equipo rival.
  const chosen = [...pool]
    .map((mon) => ({ mon, score: vsTeam(mon, opponents, opts.doubles) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, BRING)
    .map((s) => s.mon)

  // Ordena para que lidere el que mejor responde al líder rival.
  const lead = opponents[0]
  if (lead) chosen.sort((a, b) => vsOne(b, lead, opts.doubles) - vsOne(a, lead, opts.doubles))
  return chosen
}

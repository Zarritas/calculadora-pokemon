import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ChampionsMon } from '@/types/pokemon'
import type { Matchup, SavedBuild, SavedTeam } from '@/types/library'
import { MAX_HISTORY, TEAM_SIZE } from '@/types/library'
import { loadCollection, newId, saveCollection } from '@/services/storage'
import { zeroBoosts, zeroStatPoints } from '@/utils/champions'
import { DEFAULT_NATURE } from '@/utils/natures'

/** Clave que identifica un enfrentamiento (para deduplicar el historial). */
function matchupKey(m: Matchup): string {
  return `${m.attacker.mon.name}|${m.move.name}|${m.defender.mon.name}`
}

/**
 * Convierte `abilities` a array. Tolera datos antiguos corruptos guardados como
 * objeto (`{0:'Static'}`) por un bug previo de clonado, auto-reparándolos.
 */
function toAbilityArray(a: unknown): string[] {
  return Array.isArray(a) ? [...a] : Object.values((a ?? {}) as Record<string, string>)
}

/** Repara in situ las `abilities` de un Pokémon si están corruptas (objeto). */
function fixMonAbilities(mon: ChampionsMon | undefined): void {
  if (mon && !Array.isArray(mon.abilities)) mon.abilities = toAbilityArray(mon.abilities)
}
/** Repara una build cargada de disco (datos antiguos). */
function fixBuild<T extends SavedBuild>(b: T): T {
  if (b?.mon) fixMonAbilities(b.mon)
  return b
}
/** Repara los Pokémon de un enfrentamiento cargado de disco. */
function fixMatchup(m: Matchup): Matchup {
  fixMonAbilities(m?.attacker?.mon)
  fixMonAbilities(m?.defender?.mon)
  return m
}

/** Copia profunda simple de una build (rompe referencias reactivas). */
function cloneBuild(b: SavedBuild): SavedBuild {
  return {
    ...b,
    mon: { ...b.mon, types: [...b.mon.types], abilities: toAbilityArray(b.mon.abilities), baseStats: { ...b.mon.baseStats } },
    build: { statPoints: { ...b.build.statPoints }, nature: b.build.nature },
  }
}

/**
 * Biblioteca del usuario: builds guardadas y equipos. Se persiste
 * automáticamente en localStorage ante cualquier cambio.
 */
export const useLibraryStore = defineStore('library', () => {
  // Al cargar, se reparan datos antiguos con `abilities` corruptas (guardadas
  // como objeto por un bug previo). Los watchers vuelven a persistir ya sanas.
  const builds = ref<SavedBuild[]>(loadCollection<SavedBuild>('builds').map(fixBuild))
  const teams = ref<SavedTeam[]>(
    loadCollection<SavedTeam>('teams').map((t) => {
      t.members?.forEach(fixBuild)
      return t
    }),
  )
  const history = ref<Matchup[]>(loadCollection<Matchup>('history').map(fixMatchup))
  const savedMatchups = ref<Matchup[]>(loadCollection<Matchup>('matchups').map(fixMatchup))

  watch(builds, (v) => saveCollection('builds', v), { deep: true })
  watch(teams, (v) => saveCollection('teams', v), { deep: true })
  watch(history, (v) => saveCollection('history', v), { deep: true })
  watch(savedMatchups, (v) => saveCollection('matchups', v), { deep: true })

  /** Crea y guarda una build a partir de los datos actuales. */
  function addBuild(data: Omit<SavedBuild, 'id'>): SavedBuild {
    const saved: SavedBuild = { ...cloneBuild({ ...data, id: '' }), id: newId() }
    builds.value.push(saved)
    return saved
  }

  /** Borra una build y la elimina de todos los equipos. */
  function deleteBuild(id: string): void {
    builds.value = builds.value.filter((b) => b.id !== id)
    for (const t of teams.value) t.members = t.members.filter((m) => m.id !== id)
  }

  function createTeam(name: string): SavedTeam {
    const team: SavedTeam = { id: newId(), name, members: [] }
    teams.value.push(team)
    return team
  }

  /** Crea un equipo guardado a partir de una lista de builds (copias). */
  function createTeamFrom(name: string, members: SavedBuild[]): SavedTeam {
    const team: SavedTeam = {
      id: newId(),
      name,
      members: members.slice(0, TEAM_SIZE).map(cloneBuild),
    }
    teams.value.push(team)
    return team
  }

  function deleteTeam(id: string): void {
    teams.value = teams.value.filter((t) => t.id !== id)
  }

  /** Renombra un equipo (ignora nombres vacíos). */
  function renameTeam(id: string, name: string): void {
    const team = teams.value.find((t) => t.id === id)
    if (team && name.trim()) team.name = name.trim()
  }

  /** Importa builds (copias con IDs nuevos, para no colisionar). Devuelve cuántas. */
  function importBuilds(list: SavedBuild[]): number {
    for (const b of list) builds.value.push({ ...cloneBuild(b), id: newId() })
    return list.length
  }

  /** Importa equipos (equipo y miembros con IDs nuevos). Devuelve cuántos. */
  function importTeams(list: SavedTeam[]): number {
    for (const t of list) {
      teams.value.push({
        id: newId(),
        name: t.name,
        members: t.members.slice(0, TEAM_SIZE).map((m) => ({ ...cloneBuild(m), id: newId() })),
      })
    }
    return list.length
  }

  /** Añade una copia de la build al equipo (si hay hueco y no está ya). */
  function addBuildToTeam(teamId: string, build: SavedBuild): boolean {
    const team = teams.value.find((t) => t.id === teamId)
    if (!team) return false
    if (team.members.length >= TEAM_SIZE) return false
    if (team.members.some((m) => m.id === build.id)) return false
    team.members.push(cloneBuild(build))
    return true
  }

  /** Añade un Pokémon del roster al equipo con configuración por defecto. */
  function addMonToTeam(teamId: string, mon: ChampionsMon): boolean {
    const team = teams.value.find((t) => t.id === teamId)
    if (!team || team.members.length >= TEAM_SIZE) return false
    team.members.push({
      id: newId(),
      name: mon.name,
      mon,
      build: { statPoints: zeroStatPoints(), nature: DEFAULT_NATURE },
      item: null,
      status: '',
      ability: mon.abilities[0] ?? '',
      moves: [],
      boosts: zeroBoosts(),
    })
    return true
  }

  function removeMemberFromTeam(teamId: string, buildId: string): void {
    const team = teams.value.find((t) => t.id === teamId)
    if (team) team.members = team.members.filter((m) => m.id !== buildId)
  }

  /** Registra un enfrentamiento en el historial (dedup por combinación, tope MAX_HISTORY). */
  function recordHistory(matchup: Matchup): void {
    const key = matchupKey(matchup)
    history.value = [matchup, ...history.value.filter((m) => matchupKey(m) !== key)].slice(
      0,
      MAX_HISTORY,
    )
  }

  function clearHistory(): void {
    history.value = []
  }

  /** Guarda un enfrentamiento como favorito (permanente). */
  function saveMatchup(matchup: Matchup): void {
    savedMatchups.value = [matchup, ...savedMatchups.value]
  }

  function deleteMatchup(id: string): void {
    savedMatchups.value = savedMatchups.value.filter((m) => m.id !== id)
  }

  return {
    builds,
    teams,
    history,
    savedMatchups,
    addBuild,
    deleteBuild,
    createTeam,
    createTeamFrom,
    deleteTeam,
    renameTeam,
    importBuilds,
    importTeams,
    addBuildToTeam,
    addMonToTeam,
    removeMemberFromTeam,
    recordHistory,
    clearHistory,
    saveMatchup,
    deleteMatchup,
  }
})

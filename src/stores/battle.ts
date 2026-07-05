import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild, SavedTeam } from '@/types/library'
import { loadCollection, newId, saveCollection } from '@/services/storage'
import { zeroBoosts, zeroStatPoints } from '@/utils/champions'
import { DEFAULT_NATURE } from '@/utils/natures'

export type Side = 'ally' | 'enemy'

/** Crea un miembro con configuración por defecto a partir de un Pokémon. */
function memberFromMon(mon: ChampionsMon): SavedBuild {
  return {
    id: newId(),
    name: mon.name,
    mon,
    build: { statPoints: zeroStatPoints(), nature: DEFAULT_NATURE },
    item: null,
    status: '',
    ability: mon.abilities[0] ?? '',
    moves: [],
    boosts: zeroBoosts(),
  }
}

/** Copia profunda de un miembro con id nuevo (independiente de la biblioteca). */
function cloneMember(b: SavedBuild): SavedBuild {
  return {
    ...b,
    id: newId(),
    mon: { ...b.mon, types: [...b.mon.types], abilities: [...b.mon.abilities], baseStats: { ...b.mon.baseStats } },
    build: { statPoints: { ...b.build.statPoints }, nature: b.build.nature },
    moves: b.moves ? [...b.moves] : [],
    boosts: b.boosts ? { ...b.boosts } : zeroBoosts(),
  }
}

/**
 * Equipos ad-hoc del modo batalla. Se pueden armar sin guardarlos en la
 * biblioteca; se conservan en localStorage para no perderlos al recargar.
 */
export const useBattleStore = defineStore('battle', () => {
  const ally = ref<SavedBuild[]>(loadCollection<SavedBuild>('battle-ally'))
  const enemy = ref<SavedBuild[]>(loadCollection<SavedBuild>('battle-enemy'))

  watch(ally, (v) => saveCollection('battle-ally', v), { deep: true })
  watch(enemy, (v) => saveCollection('battle-enemy', v), { deep: true })

  function list(side: Side) {
    return side === 'ally' ? ally : enemy
  }

  function addMon(side: Side, mon: ChampionsMon) {
    list(side).value.push(memberFromMon(mon))
  }

  function addBuild(side: Side, build: SavedBuild) {
    list(side).value.push(cloneMember(build))
  }

  function remove(side: Side, id: string) {
    const ref_ = list(side)
    ref_.value = ref_.value.filter((m) => m.id !== id)
  }

  /** Reemplaza el bando con copias de los miembros de un equipo guardado. */
  function loadTeam(side: Side, team: SavedTeam) {
    list(side).value = team.members.map(cloneMember)
  }

  function clear(side: Side) {
    list(side).value = []
  }

  return { ally, enemy, addMon, addBuild, remove, loadTeam, clear }
})

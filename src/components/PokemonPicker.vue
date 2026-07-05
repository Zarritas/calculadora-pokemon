<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import type { PokemonType } from '@/types/pokemon'
import { getRoster } from '@/services/championsData'
import { useLibraryStore } from '@/stores/library'
import BaseModal from './BaseModal.vue'
import PokemonCard from './PokemonCard.vue'
import TypeFilter from './TypeFilter.vue'

const props = defineProps<{
  title?: string
  selectedName?: string | null
}>()

const emit = defineEmits<{
  select: [pokemon: ChampionsMon]
  selectBuild: [build: SavedBuild]
  close: []
}>()

const library = useLibraryStore()

const tab = ref<'roster' | 'builds' | 'teams'>('roster')

/* --- Roster --- */
const all = ref<ChampionsMon[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const query = ref('')
const onlyMega = ref(false)
const typeFilter = ref<PokemonType | null>(null)
const PAGE = 60
const visibleCount = ref(PAGE)

onMounted(async () => {
  try {
    all.value = await getRoster()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el roster de Champions'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return all.value.filter((p) => {
    if (onlyMega.value && p.form !== 'Mega') return false
    if (typeFilter.value && !p.types.includes(typeFilter.value)) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      String(p.dexNumber) === q ||
      p.types.some((t) => t.includes(q))
    )
  })
})

/** Hay algún filtro activo que justifique mostrar todos los resultados. */
const filtering = computed(() => !!query.value.trim() || onlyMega.value || typeFilter.value !== null)

const shown = computed(() =>
  filtering.value ? filtered.value : filtered.value.slice(0, visibleCount.value),
)
const hasMore = computed(() => !filtering.value && visibleCount.value < filtered.value.length)

function onSelect(pokemon: ChampionsMon) {
  emit('select', pokemon)
  emit('close')
}

function onSelectBuild(build: SavedBuild) {
  emit('selectBuild', build)
  emit('close')
}
</script>

<template>
  <BaseModal :title="props.title ?? 'Elegir Pokémon'" @close="$emit('close')">
    <div class="tabs">
      <button :class="{ 'tabs--on': tab === 'roster' }" @click="tab = 'roster'">Roster</button>
      <button :class="{ 'tabs--on': tab === 'builds' }" @click="tab = 'builds'">
        Mis builds ({{ library.builds.length }})
      </button>
      <button :class="{ 'tabs--on': tab === 'teams' }" @click="tab = 'teams'">
        Equipos ({{ library.teams.length }})
      </button>
    </div>

    <!-- ROSTER -->
    <template v-if="tab === 'roster'">
      <div class="picker__controls">
        <input
          v-model="query"
          class="picker__search"
          type="search"
          placeholder="Buscar por nombre, tipo o número…"
          autofocus
        />
        <label class="picker__toggle">
          <input v-model="onlyMega" type="checkbox" /> Solo megas
        </label>
      </div>

      <TypeFilter v-model="typeFilter" />

      <p v-if="loading" class="picker__status">Cargando roster de Champions…</p>

      <p v-else-if="error" class="picker__status picker__status--error">{{ error }}</p>
      <p v-else-if="!filtered.length" class="picker__status">Sin resultados.</p>
      <template v-else>
        <p class="picker__count">{{ filtered.length }} Pokémon</p>
        <div class="picker__grid">
          <PokemonCard
            v-for="p in shown"
            :key="p.name"
            :pokemon="p"
            :selected="p.name === props.selectedName"
            @select="onSelect"
          />
        </div>
        <button v-if="hasMore" class="picker__more" type="button" @click="visibleCount += PAGE">
          Ver más ({{ filtered.length - visibleCount }} restantes)
        </button>
      </template>
    </template>

    <!-- MIS BUILDS -->
    <template v-else-if="tab === 'builds'">
      <p v-if="!library.builds.length" class="picker__status">
        Aún no tienes builds guardadas. Guarda una desde un combatiente.
      </p>
      <ul v-else class="saved-list">
        <li v-for="b in library.builds" :key="b.id">
          <button class="saved" @click="onSelectBuild(b)">
            <img :src="b.mon.sprite" :alt="b.mon.name" width="48" height="48" />
            <span class="saved__info">
              <strong>{{ b.name }}</strong>
              <small>{{ b.mon.name }} · {{ b.build.nature }}</small>
            </span>
          </button>
          <button class="saved__del" title="Borrar build" @click="library.deleteBuild(b.id)">✕</button>
        </li>
      </ul>
    </template>

    <!-- EQUIPOS -->
    <template v-else>
      <p v-if="!library.teams.length" class="picker__status">
        No tienes equipos. Crea uno al guardar una build.
      </p>
      <div v-else class="teams">
        <section v-for="t in library.teams" :key="t.id" class="team">
          <header class="team__head">
            <strong>{{ t.name }}</strong>
            <span class="team__count">{{ t.members.length }}/6</span>
            <button class="saved__del" title="Borrar equipo" @click="library.deleteTeam(t.id)">✕</button>
          </header>
          <p v-if="!t.members.length" class="team__empty">Equipo vacío.</p>
          <div v-else class="team__members">
            <button v-for="m in t.members" :key="m.id" class="member" @click="onSelectBuild(m)">
              <img :src="m.mon.sprite" :alt="m.mon.name" width="44" height="44" />
              <small>{{ m.name }}</small>
            </button>
          </div>
        </section>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
}

.tabs button {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.tabs--on {
  border-color: var(--color-accent) !important;
  color: var(--color-text) !important;
}

.picker__controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.picker__search {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
}

.picker__toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}

.picker__count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
}

.picker__status {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
}

.picker__status--error {
  color: #e53935;
}

.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 0.6rem;
}

.picker__more {
  display: block;
  margin: 1rem auto 0;
  padding: 0.5rem 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

/* Builds / equipos */
.saved-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.saved-list li {
  display: flex;
  gap: 0.4rem;
  align-items: stretch;
}

.saved {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.saved:hover {
  border-color: var(--color-accent);
}

.saved img {
  image-rendering: pixelated;
}

.saved__info {
  display: flex;
  flex-direction: column;
}

.saved__info small {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.saved__del {
  padding: 0 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.saved__del:hover {
  border-color: #e53935;
  color: #e53935;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.7rem;
}

.team__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.team__count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: auto;
}

.team__empty {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.team__members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
}

.member {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.4rem 0.2rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.member:hover {
  border-color: var(--color-accent);
}

.member img {
  image-rendering: pixelated;
}

.member small {
  font-size: 0.68rem;
  text-align: center;
  line-height: 1.05;
}
</style>

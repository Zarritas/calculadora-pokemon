<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { useLibraryStore } from '@/stores/library'
import { TEAM_SIZE } from '@/types/library'
import SavedBuildCard from '@/components/SavedBuildCard.vue'
import PokemonPicker from '@/components/PokemonPicker.vue'
import BuildEditor from '@/components/BuildEditor.vue'

const library = useLibraryStore()

const newTeamName = ref('')
/** Equipo al que se está añadiendo un Pokémon (picker abierto). */
const addingToTeamId = ref<string | null>(null)
/** Miembro que se está editando (modal abierto). */
const editing = ref<SavedBuild | null>(null)

function createTeam() {
  const name = newTeamName.value.trim()
  if (!name) return
  library.createTeam(name)
  newTeamName.value = ''
}

function onPickMon(mon: ChampionsMon) {
  if (addingToTeamId.value) library.addMonToTeam(addingToTeamId.value, mon)
}

function onPickBuild(build: SavedBuild) {
  if (addingToTeamId.value) library.addBuildToTeam(addingToTeamId.value, build)
}
</script>

<template>
  <section class="teams">
    <h1>Mis equipos</h1>
    <p class="teams__hint">
      Agrupa tus builds en equipos (hasta {{ TEAM_SIZE }} Pokémon) y selecciónalos
      rápido desde la <RouterLink to="/">calculadora</RouterLink>. Añade miembros al
      guardar una build.
    </p>

    <form class="teams__new" @submit.prevent="createTeam">
      <input v-model="newTeamName" type="text" placeholder="Nombre del nuevo equipo…" />
      <button type="submit" :disabled="!newTeamName.trim()">Crear equipo</button>
    </form>

    <p v-if="!library.teams.length" class="teams__empty">
      Todavía no tienes equipos. Crea uno arriba o al guardar una build.
    </p>

    <div v-else class="teams__list">
      <section v-for="t in library.teams" :key="t.id" class="team">
        <header class="team__head">
          <h2>{{ t.name }}</h2>
          <span class="team__count">{{ t.members.length }} / {{ TEAM_SIZE }}</span>
          <button class="team__del" type="button" @click="library.deleteTeam(t.id)">
            Borrar equipo
          </button>
        </header>

        <p v-if="!t.members.length" class="team__empty">
          Equipo vacío. Añade Pokémon directamente con el botón de abajo.
        </p>

        <div v-else class="team__members">
          <SavedBuildCard
            v-for="m in t.members"
            :key="m.id"
            :build="m"
            editable
            remove-label="Quitar"
            @edit="editing = m"
            @remove="library.removeMemberFromTeam(t.id, m.id)"
          />
        </div>

        <button
          v-if="t.members.length < TEAM_SIZE"
          type="button"
          class="team__add"
          @click="addingToTeamId = t.id"
        >
          ＋ Añadir Pokémon
        </button>
      </section>
    </div>

    <PokemonPicker
      v-if="addingToTeamId"
      title="Añadir al equipo"
      @select="onPickMon"
      @select-build="onPickBuild"
      @close="addingToTeamId = null"
    />

    <BuildEditor v-if="editing" :build="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.teams__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.teams__new {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.teams__new input {
  flex: 1;
  max-width: 320px;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
}

.teams__new button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.teams__new button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.teams__empty {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

.teams__list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.team {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
}

.team__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.team__head h2 {
  margin: 0;
  font-size: 1.15rem;
}

.team__count {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-left: auto;
}

.team__del {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.team__del:hover {
  border-color: #e53935;
  color: #e53935;
}

.team__empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.team__members {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team__add {
  margin-top: 0.75rem;
  width: 100%;
  padding: 0.55rem;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.team__add:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { useLibraryStore } from '@/stores/library'
import { TEAM_SIZE, type SavedTeam } from '@/types/library'
import { encodeShare, copyToClipboard } from '@/services/transfer'
import { exportShowdown } from '@/services/showdown'
import SavedBuildCard from '@/components/SavedBuildCard.vue'
import PokemonPicker from '@/components/PokemonPicker.vue'
import BuildEditor from '@/components/BuildEditor.vue'
import ImportDialog from '@/components/ImportDialog.vue'

const library = useLibraryStore()
const router = useRouter()

const newTeamName = ref('')
/** Equipo al que se está añadiendo un Pokémon (picker abierto). */
const addingToTeamId = ref<string | null>(null)
/** Equipo cuyo nombre se está editando (inline) y borrador del nombre. */
const renamingId = ref<string | null>(null)
const nameDraft = ref('')

function startRename(team: SavedTeam) {
  renamingId.value = team.id
  nameDraft.value = team.name
}
function commitRename() {
  if (renamingId.value) library.renameTeam(renamingId.value, nameDraft.value)
  renamingId.value = null
}
/** Miembro que se está editando (modal abierto). */
const editing = ref<SavedBuild | null>(null)
/** Diálogo de importación abierto. */
const importing = ref(false)
/** ID del equipo recién exportado (para el aviso «copiado»). */
const copiedId = ref<string | null>(null)
/** Mensaje efímero para lectores de pantalla (región aria-live). */
const liveMsg = ref('')
function announce(msg: string) {
  liveMsg.value = msg
  setTimeout(() => (liveMsg.value = ''), 2000)
}

async function exportTeam(team: SavedTeam) {
  const text = exportShowdown(team.members)
  const ok = await copyToClipboard(text)
  if (ok) {
    copiedId.value = team.id
    announce(`Equipo ${team.name} copiado`)
    setTimeout(() => (copiedId.value = null), 1500)
  } else {
    window.prompt('Copia este equipo (formato Showdown):', text)
  }
}

/** URL del equipo (query param `s`) para compartir por enlace. */
const linkedId = ref<string | null>(null)
async function shareTeamLink(team: SavedTeam) {
  const code = encodeShare(exportShowdown(team.members))
  const href = router.resolve({ name: 'teams', query: { s: code } }).href
  const url = `${location.origin}${location.pathname}${href}`
  const ok = await copyToClipboard(url)
  if (ok) {
    linkedId.value = team.id
    announce(`Enlace de ${team.name} copiado`)
    setTimeout(() => (linkedId.value = null), 1500)
  } else {
    window.prompt('Copia este enlace para compartir el equipo:', url)
  }
}

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
    <p class="sr-only" aria-live="polite">{{ liveMsg }}</p>
    <h1>Mis equipos</h1>
    <p class="teams__hint">
      Agrupa tus builds en equipos (hasta {{ TEAM_SIZE }} Pokémon) y selecciónalos
      rápido desde la <RouterLink to="/">calculadora</RouterLink>. Añade miembros al
      guardar una build.
    </p>

    <form class="teams__new" @submit.prevent="createTeam">
      <input v-model="newTeamName" type="text" placeholder="Nombre del nuevo equipo…" />
      <button type="submit" :disabled="!newTeamName.trim()">Crear equipo</button>
      <button type="button" class="teams__import" @click="importing = true">Importar…</button>
    </form>

    <p v-if="!library.teams.length" class="teams__empty">
      Todavía no tienes equipos. Crea uno arriba o al guardar una build.
    </p>

    <div v-else class="teams__list">
      <details v-for="t in library.teams" :key="t.id" class="team">
        <summary class="team__head">
          <svg class="team__chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" d="M6 9l6 6 6-6" />
          </svg>
          <input
            v-if="renamingId === t.id"
            v-model="nameDraft"
            class="team__name-input"
            type="text"
            @click.stop
            @keyup.enter="commitRename"
            @keyup.esc="renamingId = null"
            @blur="commitRename"
          />
          <template v-else>
            <h2>{{ t.name }}</h2>
            <button class="team__rename" type="button" aria-label="Renombrar equipo" @click.stop="startRename(t)">
              ✎
            </button>
          </template>
          <!-- Iconos de los Pokémon del equipo (visibles aun colapsado). -->
          <span class="team__icons">
            <img
              v-for="m in t.members"
              :key="m.id"
              class="team__icon"
              :src="m.mon.sprite"
              :alt="m.mon.name"
              :title="m.mon.name"
              width="28"
              height="28"
            />
          </span>
          <span class="team__count">{{ t.members.length }} / {{ TEAM_SIZE }}</span>
          <button class="team__exp" type="button" @click.stop="exportTeam(t)">
            {{ copiedId === t.id ? '¡Copiado!' : 'Exportar' }}
          </button>
          <button class="team__exp" type="button" @click.stop="shareTeamLink(t)">
            {{ linkedId === t.id ? '¡Enlace copiado!' : 'Enlace' }}
          </button>
          <button class="team__del" type="button" @click.stop="library.deleteTeam(t.id)">
            Borrar equipo
          </button>
        </summary>

        <div class="team__body">
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
        </div>
      </details>
    </div>

    <PokemonPicker
      v-if="addingToTeamId"
      title="Añadir al equipo"
      @select="onPickMon"
      @select-build="onPickBuild"
      @close="addingToTeamId = null"
    />

    <BuildEditor v-if="editing" :build="editing" @close="editing = null" />
    <ImportDialog v-if="importing" @close="importing = false" />
  </section>
</template>

<style scoped>
.teams__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.teams__new {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.teams__new input {
  flex: 1;
  min-width: 0;
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
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.teams__new button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.teams__import {
  background: transparent !important;
  color: var(--color-text) !important;
  border: 1px solid var(--color-border) !important;
}

.team__exp {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.team__exp:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
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
}

.team__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
  list-style: none;
}

.team__head::-webkit-details-marker {
  display: none;
}

.team__chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.15s ease;
}

.team[open] .team__chevron {
  transform: rotate(180deg);
}

.team__icons {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.team__icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.team__body {
  padding: 0 1rem 1rem;
}

.team__head h2 {
  margin: 0;
  font-size: 1.15rem;
}

.team__rename {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.15rem 0.3rem;
  border-radius: 6px;
}

.team__rename:hover {
  color: var(--color-accent);
}

.team__name-input {
  font-size: 1.05rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  min-width: 0;
  flex: 1;
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

@media (max-width: 720px) {
  /* Cabecera del equipo: el nombre ocupa toda la fila y los botones bajan
     debajo repartiéndose el ancho, con más altura para el dedo. */
  .team__head h2 {
    flex: 1;
  }

  .team__count {
    flex-basis: 100%;
    margin-left: 0;
  }

  .team__exp,
  .team__del {
    flex: 1;
    padding: 0.5rem 0.7rem;
    font-size: 0.85rem;
    text-align: center;
  }

  .teams__new input {
    flex-basis: 100%;
    max-width: none;
  }

  .teams__new button {
    flex: 1;
  }
}
</style>

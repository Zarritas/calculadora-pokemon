<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { SavedBuild } from '@/types/library'
import { useLibraryStore } from '@/stores/library'
import { copyToClipboard } from '@/services/transfer'
import { exportShowdown } from '@/services/showdown'
import SavedBuildCard from '@/components/SavedBuildCard.vue'
import BuildEditor from '@/components/BuildEditor.vue'
import ImportDialog from '@/components/ImportDialog.vue'

const library = useLibraryStore()

const editing = ref<SavedBuild | null>(null)
const importing = ref(false)
const copied = ref(false)
/** ID de la build recién exportada (para el aviso «¡Copiado!»). */
const copiedId = ref<string | null>(null)
/** Mensaje efímero para lectores de pantalla (región aria-live). */
const liveMsg = ref('')
function announce(msg: string) {
  liveMsg.value = msg
  setTimeout(() => (liveMsg.value = ''), 2000)
}

async function exportAll() {
  const text = exportShowdown(library.builds)
  const ok = await copyToClipboard(text)
  if (ok) {
    copied.value = true
    announce('Builds copiadas')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    window.prompt('Copia tus builds (formato Showdown):', text)
  }
}

async function exportBuild(b: SavedBuild) {
  const text = exportShowdown([b])
  const ok = await copyToClipboard(text)
  if (ok) {
    copiedId.value = b.id
    announce(`Build ${b.name} copiada`)
    setTimeout(() => (copiedId.value = null), 1500)
  } else {
    window.prompt('Copia esta build (formato Showdown):', text)
  }
}
</script>

<template>
  <section class="builds">
    <p class="sr-only" aria-live="polite">{{ liveMsg }}</p>
    <h1>Mis builds</h1>
    <p class="builds__hint">
      Configuraciones de Pokémon que has guardado. Aplícalas desde el selector de
      atacante o defensor en la <RouterLink to="/">calculadora</RouterLink>.
    </p>

    <div class="builds__actions">
      <button v-if="library.builds.length" type="button" @click="exportAll">
        {{ copied ? '¡Copiado!' : 'Exportar todo' }}
      </button>
      <button type="button" @click="importing = true">Importar…</button>
    </div>

    <p v-if="!library.builds.length" class="builds__empty">
      Aún no tienes builds guardadas. Ve a la
      <RouterLink to="/">calculadora</RouterLink>, elige un Pokémon y pulsa
      «Guardar build».
    </p>

    <div v-else class="builds__list">
      <SavedBuildCard
        v-for="b in library.builds"
        :key="b.id"
        :build="b"
        editable
        exportable
        :copied="copiedId === b.id"
        @edit="editing = b"
        @export="exportBuild(b)"
        @remove="library.deleteBuild(b.id)"
      />
    </div>

    <BuildEditor v-if="editing" :build="editing" @close="editing = null" />
    <ImportDialog v-if="importing" @close="importing = false" />
  </section>
</template>

<style scoped>
.builds__hint {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.builds__actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.builds__actions button {
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.builds__actions button:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.builds__empty {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

.builds__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>

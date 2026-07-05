<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { SavedBuild } from '@/types/library'
import { useLibraryStore } from '@/stores/library'
import SavedBuildCard from '@/components/SavedBuildCard.vue'
import BuildEditor from '@/components/BuildEditor.vue'

const library = useLibraryStore()

const editing = ref<SavedBuild | null>(null)
</script>

<template>
  <section class="builds">
    <h1>Mis builds</h1>
    <p class="builds__hint">
      Configuraciones de Pokémon que has guardado. Aplícalas desde el selector de
      atacante o defensor en la <RouterLink to="/">calculadora</RouterLink>.
    </p>

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
        @edit="editing = b"
        @remove="library.deleteBuild(b.id)"
      />
    </div>

    <BuildEditor v-if="editing" :build="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.builds__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
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

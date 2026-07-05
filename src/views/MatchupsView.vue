<script setup lang="ts">
import { useRouter, RouterLink } from 'vue-router'
import type { Matchup } from '@/types/library'
import { useCalculatorStore } from '@/stores/calculator'
import { useLibraryStore } from '@/stores/library'
import MatchupCard from '@/components/MatchupCard.vue'

const router = useRouter()
const store = useCalculatorStore()
const library = useLibraryStore()

function load(m: Matchup) {
  store.applyMatchup(m)
  router.push('/')
}
</script>

<template>
  <section class="matchups">
    <h1>Enfrentamientos</h1>
    <p class="matchups__hint">
      Recarga cualquier enfrentamiento en la <RouterLink to="/">calculadora</RouterLink> con un
      clic. El historial se registra automáticamente; guarda los que quieras conservar.
    </p>

    <div class="matchups__section">
      <div class="matchups__head">
        <h2>Guardados</h2>
      </div>
      <p v-if="!library.savedMatchups.length" class="matchups__empty">
        No has guardado ningún enfrentamiento todavía.
      </p>
      <div v-else class="matchups__list">
        <MatchupCard
          v-for="m in library.savedMatchups"
          :key="m.id"
          :matchup="m"
          secondary="delete"
          @load="load(m)"
          @secondary-action="library.deleteMatchup(m.id)"
        />
      </div>
    </div>

    <div class="matchups__section">
      <div class="matchups__head">
        <h2>Historial reciente</h2>
        <button
          v-if="library.history.length"
          class="matchups__clear"
          type="button"
          @click="library.clearHistory()"
        >
          Limpiar
        </button>
      </div>
      <p v-if="!library.history.length" class="matchups__empty">
        Aún no hay enfrentamientos en el historial. Calcula uno en la calculadora.
      </p>
      <div v-else class="matchups__list">
        <MatchupCard
          v-for="m in library.history"
          :key="m.id"
          :matchup="m"
          secondary="save"
          @load="load(m)"
          @secondary-action="library.saveMatchup(m)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.matchups__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.matchups__section {
  margin-bottom: 2rem;
}

.matchups__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.matchups__head h2 {
  margin: 0;
  font-size: 1.15rem;
}

.matchups__clear {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.matchups__clear:hover {
  border-color: #e53935;
  color: #e53935;
}

.matchups__empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

.matchups__list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>

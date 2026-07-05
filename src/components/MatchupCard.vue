<script setup lang="ts">
import { computed } from 'vue'
import type { Matchup } from '@/types/library'
import PokeSprite from './PokeSprite.vue'

const props = defineProps<{
  matchup: Matchup
  /** Etiqueta de la acción secundaria: 'delete' (guardados) o 'save' (historial). */
  secondary?: 'delete' | 'save'
}>()

defineEmits<{ load: []; secondaryAction: [] }>()

const date = computed(() => {
  try {
    return new Date(props.matchup.savedAt).toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
})

const percent = computed(
  () => `${props.matchup.summary.minPercent.toFixed(1)}–${props.matchup.summary.maxPercent.toFixed(1)}%`,
)

const secondaryLabel = computed(() => (props.secondary === 'delete' ? 'Borrar' : 'Guardar'))
</script>

<template>
  <article class="mc">
    <div class="mc__combatants">
      <PokeSprite :src="matchup.attacker.mon.sprite" :fallback="matchup.attacker.mon.spriteBase" :alt="matchup.attacker.mon.name" :size="48" />
      <div class="mc__labels">
        <span class="mc__vs">
          {{ matchup.attacker.mon.name }}
          <em>{{ matchup.move.name }}</em>
          {{ matchup.defender.mon.name }}
        </span>
        <span class="mc__result">
          {{ percent }}<template v-if="matchup.summary.koText"> · {{ matchup.summary.koText }}</template>
        </span>
      </div>
      <PokeSprite :src="matchup.defender.mon.sprite" :fallback="matchup.defender.mon.spriteBase" :alt="matchup.defender.mon.name" :size="48" />
    </div>

    <div class="mc__side">
      <time class="mc__date">{{ date }}</time>
      <div class="mc__actions">
        <button class="mc__btn mc__btn--primary" type="button" @click="$emit('load')">Cargar</button>
        <button v-if="secondary" class="mc__btn" type="button" @click="$emit('secondaryAction')">
          {{ secondaryLabel }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.mc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.mc__combatants {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  flex: 1;
}

.mc__combatants img {
  image-rendering: pixelated;
  flex-shrink: 0;
}

.mc__labels {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.mc__vs {
  font-size: 0.85rem;
  font-weight: 600;
}

.mc__vs em {
  color: var(--color-accent);
  font-style: normal;
  margin: 0 0.3rem;
}

.mc__result {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.mc__side {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mc__date {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.mc__actions {
  display: flex;
  gap: 0.4rem;
}

.mc__btn {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.8rem;
}

.mc__btn:hover {
  border-color: var(--color-accent);
}

.mc__btn--primary {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}
</style>

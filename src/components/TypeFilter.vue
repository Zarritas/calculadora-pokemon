<script setup lang="ts">
import type { PokemonType } from '@/types/pokemon'
import { TYPE_COLORS, TYPE_LABELS, typeTextColor } from '@/utils/typeColors'

defineProps<{ modelValue: PokemonType | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: PokemonType | null] }>()

const types = Object.keys(TYPE_COLORS) as PokemonType[]

function toggle(t: PokemonType, current: PokemonType | null) {
  emit('update:modelValue', current === t ? null : t)
}
</script>

<template>
  <div class="tf">
    <button
      type="button"
      class="tf__all"
      :class="{ 'tf__all--on': modelValue === null }"
      @click="emit('update:modelValue', null)"
    >
      Todos
    </button>
    <button
      v-for="t in types"
      :key="t"
      type="button"
      class="tf__chip"
      :class="{ 'tf__chip--dim': modelValue !== null && modelValue !== t }"
      :style="{ backgroundColor: TYPE_COLORS[t], color: typeTextColor(t) }"
      :aria-pressed="modelValue === t"
      @click="toggle(t, modelValue)"
    >
      {{ TYPE_LABELS[t] }}
    </button>
  </div>
</template>

<style scoped>
.tf {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
}

.tf__all {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.tf__all--on {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.tf__chip {
  padding: 0.2rem 0.6rem;
  border: 2px solid transparent;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.12s ease,
    transform 0.08s ease;
}

.tf__chip:hover {
  transform: translateY(-1px);
}

.tf__chip--dim {
  opacity: 0.35;
}

/* En móvil, chips más altos y con más texto para pulsar mejor. */
@media (max-width: 720px) {
  .tf {
    gap: 0.4rem;
  }

  .tf__all,
  .tf__chip {
    padding: 0.4rem 0.7rem;
    font-size: 0.8rem;
  }
}
</style>

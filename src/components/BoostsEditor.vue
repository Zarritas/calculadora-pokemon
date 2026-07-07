<script setup lang="ts">
import type { BoostKey, BoostSpread } from '@/types/pokemon'
import { BOOST_MAX, BOOST_ORDER } from '@/utils/champions'
import CollapsibleCard from './CollapsibleCard.vue'

const props = withDefaults(
  defineProps<{
    /** Objeto reactivo compartido del store; se muta directamente. */
    boosts: BoostSpread
    /** Título del encabezado (para distinguir atacante/rival en Batalla). */
    title?: string
  }>(),
  { title: 'Cambios de stats' },
)

function change(key: BoostKey, delta: number) {
  const next = props.boosts[key] + delta
  props.boosts[key] = Math.max(-BOOST_MAX, Math.min(BOOST_MAX, next))
}

function reset() {
  for (const s of BOOST_ORDER) props.boosts[s.key as BoostKey] = 0
}

function format(v: number) {
  return v > 0 ? `+${v}` : String(v)
}
</script>

<template>
  <CollapsibleCard :title="props.title">
    <template #actions>
      <button type="button" class="boosts__reset" @click="reset">Reiniciar</button>
    </template>
    <div class="boosts__rows">
      <div v-for="s in BOOST_ORDER" :key="s.key" class="boost-row">
        <span class="boost-row__label">{{ s.short }}</span>
        <button
          type="button"
          class="boost-row__btn"
          :aria-label="`Bajar ${s.short}`"
          :disabled="boosts[s.key as BoostKey] <= -BOOST_MAX"
          @click="change(s.key as BoostKey, -1)"
        >
          −
        </button>
        <span
          class="boost-row__val"
          :class="{
            'boost-row__val--up': boosts[s.key as BoostKey] > 0,
            'boost-row__val--down': boosts[s.key as BoostKey] < 0,
          }"
        >
          {{ format(boosts[s.key as BoostKey]) }}
        </span>
        <button
          type="button"
          class="boost-row__btn"
          :aria-label="`Subir ${s.short}`"
          :disabled="boosts[s.key as BoostKey] >= BOOST_MAX"
          @click="change(s.key as BoostKey, 1)"
        >
          ＋
        </button>
      </div>
    </div>
  </CollapsibleCard>
</template>

<style scoped>
.boosts__reset {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.72rem;
}

.boosts__reset:hover {
  color: var(--color-accent);
}

.boosts__rows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.35rem 0.75rem;
}

.boost-row {
  display: grid;
  grid-template-columns: 42px 26px 30px 26px;
  align-items: center;
  gap: 0.25rem;
}

.boost-row__label {
  font-size: 0.8rem;
}

.boost-row__btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  line-height: 1;
}

.boost-row__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.boost-row__val {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
}

.boost-row__val--up {
  color: #43a047;
}

.boost-row__val--down {
  color: #e53935;
}

/* En móvil, +/− más grandes (36px) para pulsar con el dedo. */
@media (max-width: 720px) {
  .boost-row {
    grid-template-columns: 42px 36px 30px 36px;
  }

  .boost-row__btn {
    width: 36px;
    height: 36px;
    font-size: 1.05rem;
  }
}
</style>

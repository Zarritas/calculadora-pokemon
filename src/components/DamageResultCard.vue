<script setup lang="ts">
import { computed } from 'vue'
import type { ChampionsMon, ChampionsMove } from '@/types/pokemon'
import type { CalcResult } from '@/stores/calculator'

const props = defineProps<{
  result: CalcResult
  attacker: ChampionsMon | null
  defender: ChampionsMon | null
  move: ChampionsMove | null
}>()

const effectivenessLabel = computed(() => {
  const m = props.result.typeMultiplier
  if (m === 0) return 'Sin efecto'
  if (m >= 2) return 'Súper efectivo'
  if (m > 1) return 'Efectivo'
  if (m < 1) return 'Poco efectivo'
  return 'Neutral'
})

/** Ancho de la barra de daño (recorta al 100%). */
const barWidth = computed(() => Math.min(100, props.result.maxPercent))
</script>

<template>
  <div class="result">
    <header class="result__header">
      <span>{{ attacker?.name }}</span>
      <span class="result__move">{{ move?.name }}</span>
      <span>→ {{ defender?.name }}</span>
    </header>

    <div class="result__damage">
      {{ result.minDamage }}–{{ result.maxDamage }}
      <small>de daño</small>
    </div>

    <div class="result__percent">
      {{ result.minPercent.toFixed(1) }}% – {{ result.maxPercent.toFixed(1) }}% de
      {{ result.defenderHp }} PS
    </div>

    <div class="result__hpbar">
      <div class="result__hpbar-fill" :style="{ width: barWidth + '%' }" />
    </div>

    <p v-if="result.koText" class="result__ko">{{ result.koText }}</p>

    <ul class="result__tags">
      <li>{{ effectivenessLabel }} (×{{ result.typeMultiplier }})</li>
      <li v-if="result.stab">STAB ×1.5</li>
    </ul>

    <p v-if="result.description" class="result__desc">{{ result.description }}</p>
  </div>
</template>

<style scoped>
.result {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
  background: var(--color-surface);
}

.result__header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.result__move {
  color: var(--color-accent);
}

.result__damage {
  font-size: 2rem;
  font-weight: 700;
}

.result__damage small {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.result__percent {
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.result__hpbar {
  height: 10px;
  border-radius: 6px;
  background: var(--color-border);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.result__hpbar-fill {
  height: 100%;
  background: linear-gradient(90deg, #43a047, #fbc02d, #e53935);
  transition: width 0.15s ease;
}

.result__ko {
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.result__tags {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.result__tags li {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.result__desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  line-height: 1.4;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { calcStat } from '@smogon/calc'
import type { ChampionsBuild, StatKey, StatSpread } from '@/types/pokemon'
import {
  CHAMPIONS_LEVEL,
  EV_PER_SP,
  SP_PER_STAT_MAX,
  SP_TOTAL,
  STAT_ID,
  STAT_ORDER,
  STAT_PRESETS,
  remainingStatPoints,
  zeroStatPoints,
} from '@/utils/champions'
import { NATURE_OPTIONS } from '@/utils/natures'
import CollapsibleCard from './CollapsibleCard.vue'

const props = defineProps<{
  /** Objeto reactivo compartido del store; se muta directamente. */
  build: ChampionsBuild
  /** Stats base del Pokémon, para mostrar el valor final resultante. */
  baseStats: StatSpread
}>()

const remaining = computed(() => remainingStatPoints(props.build.statPoints))

/** Valor final de una stat con el reparto y la naturaleza actuales. */
function finalStat(key: StatKey): number {
  const ev = props.build.statPoints[key] * EV_PER_SP
  return calcStat(9, STAT_ID[key], props.baseStats[key], 31, ev, CHAMPIONS_LEVEL, props.build.nature)
}

/** Asigna SP a una stat respetando el tope por stat y el presupuesto total. */
function setPoints(key: StatKey, raw: number) {
  const current = props.build.statPoints[key]
  const maxByBudget = current + remaining.value
  const clamped = Math.max(0, Math.min(raw, SP_PER_STAT_MAX, maxByBudget))
  props.build.statPoints[key] = clamped
}

const spentPercent = computed(
  () => ((SP_TOTAL - remaining.value) / SP_TOTAL) * 100,
)

/** Aplica un reparto por rol (o lo pone a cero), mutando el spread en sitio. */
function applyPreset(sp: StatSpread) {
  for (const s of STAT_ORDER) props.build.statPoints[s.key] = sp[s.key]
}
</script>

<template>
  <CollapsibleCard title="Reparto de puntos (SP)">
    <div class="sp-editor__top">
      <label class="sp-editor__nature">
        Naturaleza
        <select v-model="build.nature">
          <option v-for="n in NATURE_OPTIONS" :key="n.name" :value="n.name">
            {{ n.name }} ({{ n.label }})
          </option>
        </select>
      </label>

      <div class="sp-editor__budget" :class="{ 'sp-editor__budget--full': remaining === 0 }">
        <span>{{ SP_TOTAL - remaining }} / {{ SP_TOTAL }} SP</span>
        <div class="sp-editor__bar">
          <div class="sp-editor__bar-fill" :style="{ width: spentPercent + '%' }" />
        </div>
      </div>
    </div>

    <div class="sp-editor__presets">
      <span class="sp-editor__presets-label">Presets:</span>
      <button
        v-for="p in STAT_PRESETS"
        :key="p.label"
        type="button"
        class="sp-editor__preset"
        @click="applyPreset(p.sp)"
      >
        {{ p.label }}
      </button>
      <button type="button" class="sp-editor__preset sp-editor__preset--clear" @click="applyPreset(zeroStatPoints())">
        Limpiar
      </button>
    </div>

    <div class="sp-editor__stats">
      <div v-for="s in STAT_ORDER" :key="s.key" class="sp-row">
        <span class="sp-row__label">{{ s.label }}</span>
        <input
          class="sp-row__range"
          type="range"
          min="0"
          :max="SP_PER_STAT_MAX"
          :value="build.statPoints[s.key]"
          :aria-label="`SP de ${s.label}`"
          @input="setPoints(s.key, Number(($event.target as HTMLInputElement).value))"
        />
        <input
          class="sp-row__num"
          type="number"
          min="0"
          :max="SP_PER_STAT_MAX"
          :value="build.statPoints[s.key]"
          :aria-label="`SP de ${s.label} (número)`"
          @input="setPoints(s.key, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="sp-row__final">{{ finalStat(s.key) }}</span>
      </div>
    </div>
  </CollapsibleCard>
</template>

<style scoped>
.sp-editor__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.sp-editor__nature {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.sp-editor__nature select {
  padding: 0.35rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
}

.sp-editor__budget {
  font-size: 0.75rem;
  font-weight: 700;
  text-align: right;
  min-width: 110px;
}

.sp-editor__budget--full {
  color: var(--color-accent);
}

.sp-editor__bar {
  margin-top: 0.25rem;
  height: 6px;
  border-radius: 4px;
  background: var(--color-border);
  overflow: hidden;
}

.sp-editor__bar-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.1s ease;
}

.sp-editor__presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.sp-editor__presets-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.sp-editor__preset {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.sp-editor__preset:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.sp-editor__preset--clear {
  color: var(--color-text-muted);
}

.sp-row {
  display: grid;
  grid-template-columns: 78px 1fr 52px 42px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.15rem 0;
}

.sp-row__label {
  font-size: 0.8rem;
}

.sp-row__range {
  width: 100%;
  accent-color: var(--color-accent);
}

.sp-row__num {
  width: 100%;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  text-align: center;
}

.sp-row__final {
  font-size: 0.85rem;
  font-weight: 700;
  text-align: right;
}
</style>

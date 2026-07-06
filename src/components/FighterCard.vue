<script setup lang="ts">
import { computed } from 'vue'
import type { SlotView } from '@/stores/simulator'
import type { BoostKey, StatusCondition } from '@/types/pokemon'
import { BOOST_ORDER } from '@/utils/champions'
import { localizeAbility, localizeItem } from '@/services/nameLocale'
import PokeSprite from './PokeSprite.vue'

const props = defineProps<{
  view: SlotView
  side: 'ally' | 'enemy'
}>()

const STATUS: Record<Exclude<StatusCondition, ''>, { label: string; color: string }> = {
  brn: { label: 'Quemado', color: '#e07850' },
  par: { label: 'Paralizado', color: '#d4b21e' },
  psn: { label: 'Envenenado', color: '#a350a3' },
  tox: { label: 'Envenenamiento grave', color: '#7d2b9e' },
  slp: { label: 'Dormido', color: '#8a8a8a' },
  frz: { label: 'Congelado', color: '#6ec6e0' },
}

const hpPct = computed(() => (props.view.maxHp > 0 ? (props.view.hp / props.view.maxHp) * 100 : 0))
const hpColor = computed(() => (hpPct.value > 50 ? '#43a047' : hpPct.value > 20 ? '#fbc02d' : '#e53935'))

const boosts = computed(() => {
  const b = props.view.boosts
  const list = b
    ? BOOST_ORDER.map((s) => ({ short: s.short, val: b[s.key as BoostKey] ?? 0 })).filter(
        (x) => x.val !== 0,
      )
    : []
  const acc = props.view.accStage ?? 0
  if (acc) list.push({ short: 'Prec', val: acc })
  const eva = props.view.evaStage ?? 0
  if (eva) list.push({ short: 'Eva', val: eva })
  return list
})

const statusInfo = computed(() => (props.view.status ? STATUS[props.view.status] : null))
</script>

<template>
  <div class="fc" :class="[`fc--${side}`, { 'fc--fainted': view.fainted }]">
    <div class="fc__top">
      <strong class="fc__name">{{ view.name }}</strong>
      <span class="fc__hp">{{ view.hp }}/{{ view.maxHp }} ({{ hpPct.toFixed(0) }}%)</span>
    </div>
    <div class="fc__hpbar">
      <div class="fc__hpbar-fill" :style="{ width: hpPct + '%', background: hpColor }" />
    </div>

    <div class="fc__body">
      <PokeSprite
        class="fc__img"
        :src="view.sprite"
        :fallback="view.spriteBase"
        :alt="view.name"
        :size="72"
        :flip="side === 'ally'"
      />
      <div class="fc__meta">
        <span v-if="statusInfo" class="fc__status" :style="{ backgroundColor: statusInfo.color }">
          {{ statusInfo.label }}
        </span>
        <span class="fc__ability">{{ localizeAbility(view.ability) }}</span>
        <span v-if="view.itemActive && view.item" class="fc__item">🎒 {{ localizeItem(view.item) }}</span>
        <div v-if="boosts.length" class="fc__boosts">
          <span
            v-for="b in boosts"
            :key="b.short"
            class="fc__boost"
            :class="b.val > 0 ? 'fc__boost--up' : 'fc__boost--down'"
          >
            {{ b.short }} {{ b.val > 0 ? '+' : '' }}{{ b.val }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fc {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.7rem;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fc--ally {
  border-top: 3px solid #4a7fc0;
}
.fc--enemy {
  border-top: 3px solid #e05a4a;
}
.fc--fainted {
  opacity: 0.5;
}

.fc__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.fc__name {
  font-size: 0.95rem;
}

.fc__hp {
  font-size: 0.76rem;
  color: var(--color-text-muted);
}

.fc__hpbar {
  height: 9px;
  border-radius: 6px;
  background: var(--color-border);
  overflow: hidden;
}

.fc__hpbar-fill {
  height: 100%;
  transition:
    width 0.35s ease,
    background 0.35s ease;
}

.fc__body {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.fc__img {
  flex-shrink: 0;
}

.fc__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.fc__status {
  align-self: flex-start;
  font-size: 0.66rem;
  font-weight: 700;
  color: #fff;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
}

.fc__ability {
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.fc__item {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.fc__boosts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: 0.1rem;
}

.fc__boost {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}

.fc__boost--up {
  background: rgba(67, 160, 71, 0.18);
  color: #2e7d32;
}

.fc__boost--down {
  background: rgba(229, 57, 53, 0.18);
  color: #c62828;
}
</style>

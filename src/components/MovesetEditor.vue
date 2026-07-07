<script setup lang="ts">
import { ref } from 'vue'
import type { ChampionsMove } from '@/types/pokemon'
import { MOVESET_SIZE } from '@/types/library'
import { localizeMove } from '@/services/nameLocale'
import { TYPE_COLORS, TYPE_LABELS, typeTextColor } from '@/utils/typeColors'
import MovePicker from './MovePicker.vue'

const props = defineProps<{
  moves: ChampionsMove[]
  /** Nombre de la forma, para cargar su learnset en el selector. */
  monName: string
  /** Movimiento activo (resaltado) cuando el moveset es seleccionable. */
  activeName?: string | null
  /** Si true, al pulsar un movimiento se activa (atacante). */
  selectable?: boolean
}>()

const emit = defineEmits<{
  'update:moves': [moves: ChampionsMove[]]
  select: [move: ChampionsMove]
}>()

const pickerOpen = ref(false)

const categoryLabel: Record<string, string> = {
  physical: 'Fís.',
  special: 'Esp.',
  status: 'Est.',
}

function addMove(m: ChampionsMove) {
  if (props.moves.some((x) => x.name === m.name)) return // ya está en el set
  if (props.moves.length >= MOVESET_SIZE) return
  // No emitimos 'select' aquí: el store auto-activa el primer movimiento si no
  // hay ninguno activo. Emitirlo, con `selectMove` como toggle, lo desactivaría.
  emit('update:moves', [...props.moves, m])
}

function removeMove(name: string) {
  emit(
    'update:moves',
    props.moves.filter((m) => m.name !== name),
  )
}

function onClickMove(m: ChampionsMove) {
  if (props.selectable) emit('select', m)
}
</script>

<template>
  <div class="mse">
    <span class="mse__label">Movimientos ({{ moves.length }}/{{ MOVESET_SIZE }})</span>

    <ul class="mse__list">
      <li v-for="m in moves" :key="m.name" class="mse__row">
        <component
          :is="selectable ? 'button' : 'div'"
          :type="selectable ? 'button' : undefined"
          class="mse__move"
          :class="{
            'mse__move--clickable': selectable,
            'mse__move--active': selectable && m.name === activeName,
          }"
          :aria-pressed="selectable ? m.name === activeName : undefined"
          @click="onClickMove(m)"
        >
          <span
            class="mse__type"
            :style="{ backgroundColor: TYPE_COLORS[m.type], color: typeTextColor(m.type) }"
          >
            {{ TYPE_LABELS[m.type] }}
          </span>
          <span class="mse__name">{{ localizeMove(m.name) }}</span>
          <span class="mse__cat">{{ categoryLabel[m.category] }}</span>
          <span class="mse__pow">{{ m.power ?? '—' }}</span>
        </component>
        <button
          class="mse__del"
          type="button"
          :aria-label="`Quitar ${localizeMove(m.name)}`"
          @click="removeMove(m.name)"
        >
          ✕
        </button>
      </li>
    </ul>

    <button
      v-if="moves.length < MOVESET_SIZE"
      type="button"
      class="mse__add"
      @click="pickerOpen = true"
    >
      ＋ Añadir movimiento
    </button>

    <MovePicker
      v-if="pickerOpen"
      :mon-name="monName"
      :selected="null"
      @select="addMove"
      @close="pickerOpen = false"
    />
  </div>
</template>

<style scoped>
.mse {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
  background: var(--color-surface);
}

.mse__label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.mse__list {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.mse__row {
  display: grid;
  grid-template-columns: 1fr 24px;
  align-items: center;
  gap: 0.3rem;
}

.mse__move {
  display: grid;
  grid-template-columns: 54px 1fr auto 30px;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  /* Reset para cuando es <button> (moveset seleccionable). */
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
}

.mse__move--clickable {
  cursor: pointer;
}

.mse__move--clickable:hover {
  border-color: var(--color-accent);
}

.mse__move--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.mse__type {
  font-size: 0.58rem;
  font-weight: 700;
  text-align: center;
  padding: 0.1rem 0;
  border-radius: 999px;
}

.mse__name {
  font-size: 0.8rem;
  font-weight: 600;
}

.mse__cat {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.mse__pow {
  font-size: 0.78rem;
  font-weight: 700;
  text-align: right;
}

.mse__del {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

.mse__del:hover {
  color: #e53935;
}

.mse__add {
  width: 100%;
  padding: 0.45rem;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.mse__add:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>

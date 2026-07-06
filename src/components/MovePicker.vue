<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ChampionsMove, PokemonType } from '@/types/pokemon'
import { getMovesForMon } from '@/services/championsData'
import { localizeMove } from '@/services/nameLocale'
import { TYPE_COLORS, TYPE_LABELS, typeTextColor } from '@/utils/typeColors'
import BaseModal from './BaseModal.vue'
import TypeFilter from './TypeFilter.vue'

const props = defineProps<{
  /** Nombre de la forma del atacante (para cargar su learnset de Champions). */
  monName: string
  selected?: string | null
}>()

const emit = defineEmits<{
  select: [move: ChampionsMove]
  close: []
}>()

const moves = ref<ChampionsMove[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const query = ref('')
/** Ocultar movimientos de estado (sin daño). */
const onlyDamaging = ref(true)
const typeFilter = ref<PokemonType | null>(null)

onMounted(async () => {
  try {
    moves.value = await getMovesForMon(props.monName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los movimientos'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return moves.value.filter((m) => {
    if (onlyDamaging.value && m.category === 'status') return false
    if (typeFilter.value && m.type !== typeFilter.value) return false
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      localizeMove(m.name).toLowerCase().includes(q) ||
      m.type.includes(q)
    )
  })
})

const categoryLabel: Record<string, string> = {
  physical: 'Físico',
  special: 'Especial',
  status: 'Estado',
}

function onSelect(move: ChampionsMove) {
  emit('select', move)
  emit('close')
}
</script>

<template>
  <BaseModal title="Elegir movimiento" @close="$emit('close')">
    <div class="mp__controls">
      <input
        v-model="query"
        class="mp__search"
        type="search"
        placeholder="Buscar movimiento o tipo…"
        aria-label="Buscar movimiento o tipo"
        autofocus
      />
      <label class="mp__toggle">
        <input v-model="onlyDamaging" type="checkbox" />
        Solo con daño
      </label>
    </div>

    <TypeFilter v-model="typeFilter" />

    <p v-if="loading" class="mp__status">Cargando movimientos…</p>

    <p v-else-if="error" class="mp__status mp__status--error">{{ error }}</p>
    <p v-else-if="!filtered.length" class="mp__status">Sin resultados.</p>

    <ul v-else class="mp__list">
      <li v-for="m in filtered" :key="m.name">
        <button
          type="button"
          class="mp__item"
          :class="{ 'mp__item--selected': m.name === props.selected }"
          @click="onSelect(m)"
        >
          <span class="mp__type" :style="{ backgroundColor: TYPE_COLORS[m.type], color: typeTextColor(m.type) }">
            {{ TYPE_LABELS[m.type] }}
          </span>
          <span class="mp__name">{{ localizeMove(m.name) }}</span>
          <span class="mp__cat">{{ categoryLabel[m.category] }}</span>
          <span class="mp__power">{{ m.power ?? '—' }}</span>
        </button>
      </li>
    </ul>
  </BaseModal>
</template>

<style scoped>
.mp__controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.mp__search {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
}

.mp__toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}

.mp__status {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
}

.mp__status--error {
  color: #e53935;
}

.mp__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mp__item {
  width: 100%;
  display: grid;
  grid-template-columns: 68px 1fr auto 34px;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.mp__item:hover {
  border-color: var(--color-accent);
}

.mp__item--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.mp__type {
  font-size: 0.65rem;
  font-weight: 700;
  text-align: center;
  padding: 0.15rem 0;
  border-radius: 999px;
}

.mp__name {
  font-size: 0.9rem;
  font-weight: 600;
}

.mp__cat {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.mp__power {
  font-size: 0.85rem;
  font-weight: 700;
  text-align: right;
}
</style>

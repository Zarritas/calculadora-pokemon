<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ChampionsItem } from '@/types/pokemon'
import { getItems } from '@/services/championsData'
import { localizeItem } from '@/services/nameLocale'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  selected?: string | null
  /** Objetos ya usados por otros miembros del equipo (cláusula de objeto: no repetibles). */
  taken?: string[]
}>()

const emit = defineEmits<{
  select: [item: string | null]
  close: []
}>()

const items = ref<ChampionsItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const query = ref('')

const takenSet = computed(() => new Set(props.taken ?? []))

onMounted(async () => {
  try {
    items.value = await getItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los objetos'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (i) => i.name.toLowerCase().includes(q) || localizeItem(i.name).toLowerCase().includes(q),
  )
})

function choose(name: string | null) {
  emit('select', name)
  emit('close')
}
</script>

<template>
  <BaseModal title="Elegir objeto" @close="$emit('close')">
    <input
      v-model="query"
      class="ip__search"
      type="search"
      placeholder="Buscar objeto…"
      aria-label="Buscar objeto"
      autofocus
    />

    <button
      type="button"
      class="ip__item ip__item--none"
      :class="{ 'ip__item--selected': !props.selected }"
      @click="choose(null)"
    >
      Sin objeto
    </button>

    <p v-if="loading" class="ip__status">Cargando objetos…</p>
    <p v-else-if="error" class="ip__status ip__status--error">{{ error }}</p>
    <p v-else-if="!filtered.length" class="ip__status">Sin resultados.</p>

    <ul v-else class="ip__list">
      <li v-for="i in filtered" :key="i.name">
        <button
          type="button"
          class="ip__item"
          :class="{
            'ip__item--selected': i.name === props.selected,
            'ip__item--taken': takenSet.has(i.name),
          }"
          :disabled="takenSet.has(i.name)"
          :title="takenSet.has(i.name) ? 'Ya lo lleva otro Pokémon del equipo' : i.description"
          @click="choose(i.name)"
        >
          <span class="ip__name">
            {{ localizeItem(i.name) }}
            <em v-if="takenSet.has(i.name)" class="ip__tag">en uso</em>
          </span>
          <span class="ip__desc">{{ i.description }}</span>
        </button>
      </li>
    </ul>
  </BaseModal>
</template>

<style scoped>
.ip__search {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.ip__status {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
}

.ip__status--error {
  color: #e53935;
}

.ip__list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ip__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.ip__item:hover {
  border-color: var(--color-accent);
}

.ip__item--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.ip__item--none {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.ip__item--taken {
  opacity: 0.45;
  cursor: not-allowed;
}

.ip__item--taken:hover {
  border-color: var(--color-border);
}

.ip__tag {
  font-style: normal;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #e0a020;
  margin-left: 0.4rem;
}

.ip__name {
  font-size: 0.9rem;
  font-weight: 600;
}

.ip__desc {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

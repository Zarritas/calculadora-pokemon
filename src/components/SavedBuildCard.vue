<script setup lang="ts">
import { computed } from 'vue'
import type { SavedBuild } from '@/types/library'
import { STAT_ORDER } from '@/utils/champions'
import { STATUS_OPTIONS } from '@/utils/field'
import TypeBadge from './TypeBadge.vue'
import PokeSprite from './PokeSprite.vue'

const props = defineProps<{
  build: SavedBuild
  /** Texto del botón de acción secundaria (borrar / quitar). */
  removeLabel?: string
  /** Muestra el botón de editar. */
  editable?: boolean
}>()

defineEmits<{ remove: []; edit: [] }>()

/** Reparto de Stat Points asignados (solo los > 0). */
const spSummary = computed(() =>
  STAT_ORDER.filter((s) => props.build.build.statPoints[s.key] > 0).map(
    (s) => `${s.short} ${props.build.build.statPoints[s.key]}`,
  ),
)

const statusLabel = computed(
  () => STATUS_OPTIONS.find((s) => s.value === props.build.status)?.label ?? 'Sin estado',
)
</script>

<template>
  <article class="bcard">
    <PokeSprite class="bcard__img" :src="build.mon.sprite" :fallback="build.mon.spriteBase" :alt="build.mon.name" :size="72" />

    <div class="bcard__body">
      <div class="bcard__head">
        <strong class="bcard__name">{{ build.name }}</strong>
        <span class="bcard__mon">
          {{ build.mon.name }}
          <span v-if="build.mon.form !== 'Base'" class="bcard__form">{{ build.mon.form }}</span>
        </span>
      </div>

      <div class="bcard__types">
        <TypeBadge v-for="t in build.mon.types" :key="t" :type="t" />
      </div>

      <ul class="bcard__meta">
        <li><b>Naturaleza:</b> {{ build.build.nature }}</li>
        <li><b>Objeto:</b> {{ build.item ?? '—' }}</li>
        <li><b>Estado:</b> {{ statusLabel }}</li>
        <li>
          <b>SP:</b>
          <span v-if="spSummary.length">{{ spSummary.join(' · ') }}</span>
          <span v-else>sin asignar</span>
        </li>
        <li v-if="build.moves && build.moves.length">
          <b>Movs:</b> {{ build.moves.map((m) => m.name).join(', ') }}
        </li>
      </ul>
    </div>

    <div class="bcard__actions">
      <button v-if="editable" class="bcard__edit" type="button" @click="$emit('edit')">
        Editar
      </button>
      <button class="bcard__remove" type="button" @click="$emit('remove')">
        {{ removeLabel ?? 'Borrar' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.bcard {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.bcard__img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.bcard__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bcard__head {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.bcard__name {
  font-size: 1.05rem;
}

.bcard__mon {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.bcard__form {
  font-weight: 700;
  color: var(--color-accent);
}

.bcard__types {
  display: flex;
  gap: 0.35rem;
}

.bcard__meta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.bcard__meta b {
  color: var(--color-text);
  font-weight: 600;
}

.bcard__actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
}

.bcard__edit,
.bcard__remove {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.bcard__edit:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.bcard__remove:hover {
  border-color: #e53935;
  color: #e53935;
}
</style>

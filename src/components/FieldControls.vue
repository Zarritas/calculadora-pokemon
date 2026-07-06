<script setup lang="ts">
import type { FieldState } from '@/types/pokemon'
import { TERRAIN_OPTIONS, WEATHER_OPTIONS } from '@/utils/field'
import CollapsibleCard from './CollapsibleCard.vue'

/** Objeto reactivo compartido del store; se muta directamente. */
defineProps<{ field: FieldState }>()
</script>

<template>
  <CollapsibleCard class="field" title="Campo de batalla">
    <div class="field__row">
      <label class="field__control">
        Clima
        <select v-model="field.weather">
          <option v-for="w in WEATHER_OPTIONS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
      </label>

      <label class="field__control">
        Terreno
        <select v-model="field.terrain">
          <option v-for="t in TERRAIN_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </label>

      <div class="field__screens">
        <span class="field__screens-label">Pantallas (defensor)</span>
        <div class="field__checks">
          <label><input v-model="field.reflect" type="checkbox" /> Reflejo</label>
          <label><input v-model="field.lightScreen" type="checkbox" /> Pantalla Luz</label>
          <label><input v-model="field.auroraVeil" type="checkbox" /> Velo Aurora</label>
        </div>
      </div>
    </div>
  </CollapsibleCard>
</template>

<style scoped>
.field {
  margin-bottom: 1.5rem;
}

.field__row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: flex-start;
}

.field__control {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.field__control select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
}

.field__screens-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.field__checks {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.field__checks label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 400;
  cursor: pointer;
}
</style>

<script setup lang="ts">
import type { PokemonType } from '@/types/pokemon'
import { TYPE_COLORS, TYPE_LABELS, typeTextColor } from '@/utils/typeColors'

defineProps<{ type: PokemonType }>()
</script>

<template>
  <span
    class="type-badge"
    :style="{ backgroundColor: TYPE_COLORS[type], color: typeTextColor(type) }"
  >
    {{ TYPE_LABELS[type] }}
  </span>
</template>

<style scoped>
.type-badge {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.4;
}
</style>

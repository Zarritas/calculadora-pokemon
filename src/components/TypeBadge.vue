<script setup lang="ts">
import type { PokemonType } from '@/types/pokemon'
import { TYPE_COLORS, TYPE_LABELS } from '@/utils/typeColors'

defineProps<{ type: PokemonType }>()
</script>

<template>
  <span class="type-badge" :style="{ backgroundColor: TYPE_COLORS[type] }">
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
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
  line-height: 1.4;
}
</style>

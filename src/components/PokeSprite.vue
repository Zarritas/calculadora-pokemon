<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string
  /** Sprite de respaldo si el principal falla al cargar. */
  fallback?: string
  alt?: string
  size?: number
  /** Voltear horizontalmente (aliado mirando a la derecha en combate). */
  flip?: boolean
}>()

const current = ref(props.src)
watch(
  () => props.src,
  (v) => {
    current.value = v
  },
)

function onError() {
  if (props.fallback && current.value !== props.fallback) current.value = props.fallback
}
</script>

<template>
  <img
    class="poke-sprite"
    :class="{ 'poke-sprite--flip': flip }"
    :src="current"
    :alt="alt ?? ''"
    :width="size ?? 72"
    :height="size ?? 72"
    loading="lazy"
    @error="onError"
  />
</template>

<style scoped>
.poke-sprite {
  object-fit: contain;
  image-rendering: pixelated;
}

.poke-sprite--flip {
  transform: scaleX(-1);
}
</style>

<script setup lang="ts">
import type { ChampionsMon } from '@/types/pokemon'
import PokeSprite from './PokeSprite.vue'

defineProps<{
  pokemon: ChampionsMon
  selected?: boolean
}>()

defineEmits<{ select: [pokemon: ChampionsMon] }>()
</script>

<template>
  <button
    type="button"
    class="pkmn-card"
    :class="{ 'pkmn-card--selected': selected }"
    @click="$emit('select', pokemon)"
  >
    <span
      v-if="pokemon.form !== 'Base'"
      class="pkmn-card__form"
      :class="`pkmn-card__form--${pokemon.form.toLowerCase()}`"
    >
      {{ pokemon.form === 'Mega' ? 'MEGA' : 'REG' }}
    </span>
    <PokeSprite
      class="pkmn-card__img"
      :src="pokemon.sprite"
      :fallback="pokemon.spriteBase"
      :alt="pokemon.name"
      :size="72"
    />
    <span class="pkmn-card__name">{{ pokemon.name }}</span>
  </button>
</template>

<style scoped>
.pkmn-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    border-color 0.08s ease,
    box-shadow 0.08s ease;
}

.pkmn-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.pkmn-card--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.pkmn-card__form {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  color: #fff;
  letter-spacing: 0.03em;
}

.pkmn-card__form--mega {
  background: #b8860b;
}

.pkmn-card__form--regional {
  background: #4a7fc0;
}

.pkmn-card__img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
}

.pkmn-card__name {
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.1;
}
</style>

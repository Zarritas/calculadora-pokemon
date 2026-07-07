<script setup lang="ts">
import type { ChampionsMon, StatusCondition } from '@/types/pokemon'
import { STATUS_OPTIONS } from '@/utils/field'
import { localizeAbility, localizeItem } from '@/services/nameLocale'
import TypeBadge from './TypeBadge.vue'
import PokeSprite from './PokeSprite.vue'

defineProps<{
  label: string
  pokemon: ChampionsMon | null
  item: string | null
  status: StatusCondition
  ability: string
}>()

defineEmits<{
  pick: []
  pickItem: []
  save: []
  clear: []
  'update:status': [value: StatusCondition]
  'update:ability': [value: string]
}>()
</script>

<template>
  <div class="slot">
    <span class="slot__label">{{ label }}</span>

    <button v-if="!pokemon" type="button" class="slot__empty" @click="$emit('pick')">
      <span class="slot__plus">＋</span>
      Elegir Pokémon
    </button>

    <template v-else>
      <div class="slot__filled">
        <PokeSprite class="slot__img" :src="pokemon.sprite" :fallback="pokemon.spriteBase" :alt="pokemon.name" :size="110" />
        <div class="slot__info">
          <strong class="slot__name">{{ pokemon.name }}</strong>
          <div class="slot__types">
            <TypeBadge v-for="t in pokemon.types" :key="t" :type="t" />
          </div>
          <label v-if="pokemon.abilities.length > 1" class="slot__ability-select">
            <span>Hab.</span>
            <select
              :value="ability"
              @change="$emit('update:ability', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="a in pokemon.abilities" :key="a" :value="a">{{ localizeAbility(a) }}</option>
            </select>
          </label>
          <span v-else class="slot__ability">Hab.: {{ localizeAbility(pokemon.abilities[0]) }}</span>
          <div class="slot__buttons">
            <button type="button" class="slot__change" @click="$emit('pick')">Cambiar</button>
            <button type="button" class="slot__change" @click="$emit('save')">Guardar build</button>
            <button type="button" class="slot__remove" @click="$emit('clear')">Quitar</button>
          </div>
        </div>
      </div>

      <button
        v-if="pokemon.form !== 'Mega'"
        type="button"
        class="slot__item"
        @click="$emit('pickItem')"
      >
        <span class="slot__item-label">Objeto</span>
        <span class="slot__item-value">{{ item ? localizeItem(item) : 'Sin objeto' }}</span>
      </button>
      <p v-else class="slot__item slot__item--mega">Mega · piedra equipada</p>

      <label class="slot__status">
        <span class="slot__item-label">Estado</span>
        <select
          :value="status"
          @change="$emit('update:status', ($event.target as HTMLSelectElement).value as StatusCondition)"
        >
          <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </label>
    </template>
  </div>
</template>

<style scoped>
.slot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slot__label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.slot__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 158px;
  border: 2px dashed var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-weight: 600;
  cursor: pointer;
}

.slot__empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.slot__plus {
  font-size: 1.8rem;
  line-height: 1;
}

.slot__filled {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.slot__img {
  width: 110px;
  height: 110px;
  object-fit: contain;
}

.slot__info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  /* Permite que el contenido se encoja en vez de desbordar junto al sprite. */
  min-width: 0;
  flex: 1;
}

.slot__name {
  font-size: 1.05rem;
  line-height: 1.15;
}

.slot__types {
  display: flex;
  gap: 0.35rem;
}

.slot__ability {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.slot__ability-select {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.slot__ability-select select {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.2rem 0.35rem;
  font-size: 0.78rem;
  max-width: 150px;
}

.slot__buttons {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.slot__change {
  align-self: flex-start;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.8rem;
}

.slot__change:hover {
  border-color: var(--color-accent);
}

.slot__remove {
  align-self: flex-start;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.slot__remove:hover {
  border-color: #e53935;
  color: #e53935;
}

.slot__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
}

.slot__item:hover {
  border-color: var(--color-accent);
}

.slot__item-label {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.slot__item-value {
  font-weight: 600;
}

.slot__item--mega {
  margin: 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  cursor: default;
}

.slot__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  font-size: 0.85rem;
}

.slot__status select {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.25rem 0.4rem;
  font-size: 0.82rem;
}

/* En móvil el sprite ocupa menos para dejar sitio al nombre/tipos/botones. */
@media (max-width: 480px) {
  .slot__filled {
    gap: 0.7rem;
    padding: 0.7rem;
  }

  .slot__img {
    width: 80px;
    height: 80px;
  }
}
</style>

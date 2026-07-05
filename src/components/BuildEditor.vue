<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChampionsMove } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { zeroBoosts } from '@/utils/champions'
import { STATUS_OPTIONS } from '@/utils/field'
import BaseModal from './BaseModal.vue'
import TypeBadge from './TypeBadge.vue'
import StatPointsEditor from './StatPointsEditor.vue'
import BoostsEditor from './BoostsEditor.vue'
import MovesetEditor from './MovesetEditor.vue'
import ItemPicker from './ItemPicker.vue'

const props = defineProps<{ build: SavedBuild }>()
defineEmits<{ close: [] }>()

// Garantiza campos que pueden faltar en builds antiguas (se mutan en sitio).
if (!props.build.boosts) props.build.boosts = zeroBoosts()
if (!props.build.moves) props.build.moves = []
if (props.build.ability == null) props.build.ability = props.build.mon.abilities[0] ?? ''

const boosts = computed(() => props.build.boosts!)
const itemPickerOpen = ref(false)

function setMoves(list: ChampionsMove[]) {
  props.build.moves = list
}
function setItem(name: string | null) {
  props.build.item = name
}
</script>

<template>
  <BaseModal title="Editar Pokémon" @close="$emit('close')">
    <div class="be">
      <header class="be__head">
        <img :src="build.mon.sprite" :alt="build.mon.name" width="72" height="72" />
        <div>
          <strong class="be__mon">{{ build.mon.name }}</strong>
          <div class="be__types">
            <TypeBadge v-for="t in build.mon.types" :key="t" :type="t" />
          </div>
        </div>
      </header>

      <label class="be__field">
        Nombre de la build
        <input v-model="build.name" type="text" />
      </label>

      <div class="be__row">
        <label v-if="build.mon.abilities.length > 1" class="be__field">
          Habilidad
          <select v-model="build.ability">
            <option v-for="a in build.mon.abilities" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>

        <label class="be__field">
          Estado
          <select v-model="build.status">
            <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>

        <div v-if="build.mon.form !== 'Mega'" class="be__field">
          Objeto
          <button type="button" class="be__item" @click="itemPickerOpen = true">
            {{ build.item ?? 'Sin objeto' }}
          </button>
        </div>
      </div>

      <StatPointsEditor :build="build.build" :base-stats="build.mon.baseStats" />
      <BoostsEditor :boosts="boosts" />
      <MovesetEditor
        :moves="build.moves ?? []"
        :mon-name="build.mon.name"
        @update:moves="setMoves"
      />

      <ItemPicker
        v-if="itemPickerOpen"
        :selected="build.item"
        @select="setItem"
        @close="itemPickerOpen = false"
      />
    </div>
  </BaseModal>
</template>

<style scoped>
.be {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.be__head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.be__head img {
  image-rendering: pixelated;
}

.be__mon {
  font-size: 1.1rem;
}

.be__types {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.3rem;
}

.be__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.be__field input,
.be__field select {
  padding: 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
}

.be__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.be__item {
  padding: 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  font-size: 0.9rem;
}

.be__item:hover {
  border-color: var(--color-accent);
}
</style>

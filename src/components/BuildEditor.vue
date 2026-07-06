<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChampionsMove } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { zeroBoosts } from '@/utils/champions'
import { STATUS_OPTIONS } from '@/utils/field'
import { exportShowdown, parseShowdown } from '@/services/showdown'
import BaseModal from './BaseModal.vue'
import TypeBadge from './TypeBadge.vue'
import StatPointsEditor from './StatPointsEditor.vue'
import BoostsEditor from './BoostsEditor.vue'
import MovesetEditor from './MovesetEditor.vue'
import ItemPicker from './ItemPicker.vue'

const props = defineProps<{
  build: SavedBuild
  /** Objetos ya usados por el resto del equipo (cláusula de objeto). */
  takenItems?: string[]
}>()
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

/* ---------- Pestañas: formulario / texto (formato Showdown) ---------- */
const mode = ref<'form' | 'text'>('form')
const text = ref('')
const textError = ref('')
const textBusy = ref(false)

/** Al pasar a la pestaña de texto, vuelca la build actual (reflejando ediciones del formulario). */
function openTextTab() {
  text.value = exportShowdown([props.build])
  textError.value = ''
  mode.value = 'text'
}

/** Aplica el texto Showdown editado sobre la build actual (conserva nombre e id). */
async function applyText() {
  textError.value = ''
  textBusy.value = true
  try {
    const { builds } = await parseShowdown(text.value)
    const p = builds[0]
    props.build.mon = p.mon
    props.build.build = p.build
    props.build.item = p.item
    props.build.ability = p.ability ?? props.build.mon.abilities[0] ?? ''
    props.build.moves = p.moves ?? []
    mode.value = 'form' // vuelve al formulario para ver el resultado aplicado
  } catch (e) {
    textError.value = e instanceof Error ? e.message : 'No se pudo aplicar el texto.'
  } finally {
    textBusy.value = false
  }
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

      <div class="be__tabs" role="tablist">
        <button
          type="button"
          class="be__tab"
          :class="{ 'be__tab--on': mode === 'form' }"
          role="tab"
          :aria-selected="mode === 'form'"
          @click="mode = 'form'"
        >
          Formulario
        </button>
        <button
          type="button"
          class="be__tab"
          :class="{ 'be__tab--on': mode === 'text' }"
          role="tab"
          :aria-selected="mode === 'text'"
          @click="openTextTab"
        >
          Texto (Showdown)
        </button>
      </div>

      <!-- Pestaña: formulario -->
      <div v-show="mode === 'form'" class="be__panel">
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
      </div>

      <!-- Pestaña: texto (formato Showdown) -->
      <div v-show="mode === 'text'" class="be__text">
        <p class="be__text-hint">
          Edita o pega en formato Pokémon Showdown. Al aplicar, se actualizan Pokémon,
          objeto, naturaleza, Stat Points y movimientos (se conserva el nombre).
        </p>
        <textarea v-model="text" class="be__text-area" rows="10" spellcheck="false" />
        <p v-if="textError" class="be__text-error" role="alert">⚠ {{ textError }}</p>
        <button type="button" class="be__text-apply" :disabled="textBusy" @click="applyText">
          {{ textBusy ? 'Aplicando…' : 'Aplicar texto' }}
        </button>
      </div>

      <ItemPicker
        v-if="itemPickerOpen"
        :selected="build.item"
        :taken="takenItems ?? []"
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

.be__tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
}

.be__panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.be__tab {
  padding: 0.45rem 0.9rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.be__tab--on {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.be__text-hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.be__text-area {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: monospace;
  font-size: 0.8rem;
  resize: vertical;
}

.be__text-error {
  color: #e53935;
  font-size: 0.8rem;
  margin: 0.4rem 0 0;
}

.be__text-apply {
  margin-top: 0.5rem;
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.be__text-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

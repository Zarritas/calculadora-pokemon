<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { parseShowdown } from '@/services/showdown'
import { useLibraryStore } from '@/stores/library'

const props = defineProps<{ initial?: string }>()
defineEmits<{ close: [] }>()

const library = useLibraryStore()
const text = ref(props.initial ?? '')
const error = ref('')
const done = ref('')
const busy = ref(false)

async function doImport() {
  error.value = ''
  done.value = ''
  busy.value = true
  try {
    const { builds, errors } = await parseShowdown(text.value)
    let msg: string
    if (builds.length >= 2) {
      library.createTeamFrom('Equipo importado', builds)
      msg = `Importado como equipo (${builds.length} Pokémon).`
    } else {
      library.importBuilds(builds)
      msg = 'Importada 1 build.'
    }
    if (errors.length) msg += ` ${errors.length} aviso(s): ${errors[0]}`
    done.value = msg
    text.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo importar.'
  } finally {
    busy.value = false
  }
}

async function onFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) text.value = await file.text()
}
</script>

<template>
  <BaseModal title="Importar (formato Showdown)" @close="$emit('close')">
    <p class="imp__hint">
      Pega un set o equipo en formato Pokémon Showdown (o carga un archivo de texto).
      Los EVs se convierten a Stat Points y los movimientos se ajustan al learnset de
      Champions.
    </p>
    <input class="imp__file" type="file" accept=".txt,text/plain" @change="onFile" />
    <textarea
      v-model="text"
      class="imp__area"
      rows="10"
      placeholder="Garchomp @ Rocky Helmet&#10;Ability: Rough Skin&#10;EVs: 252 Atk / 252 Spe / 4 HP&#10;Jolly Nature&#10;- Earthquake&#10;- Dragon Claw"
    />
    <p v-if="error" class="imp__msg imp__msg--error" role="alert">⚠ {{ error }}</p>
    <p v-if="done" class="imp__msg imp__msg--ok" role="status">✓ {{ done }}</p>
    <div class="imp__actions">
      <button class="imp__btn" :disabled="!text.trim() || busy" @click="doImport">
        {{ busy ? 'Importando…' : 'Importar' }}
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.imp__hint {
  margin: 0 0 0.6rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.imp__file {
  margin-bottom: 0.6rem;
  font-size: 0.85rem;
}
.imp__area {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: monospace;
  font-size: 0.8rem;
  resize: vertical;
}
.imp__msg {
  margin: 0.6rem 0 0;
  font-size: 0.85rem;
}
.imp__msg--error {
  color: #e53935;
}
.imp__msg--ok {
  color: var(--color-accent);
}
.imp__actions {
  margin-top: 0.8rem;
  display: flex;
  justify-content: flex-end;
}
.imp__btn {
  padding: 0.55rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.imp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

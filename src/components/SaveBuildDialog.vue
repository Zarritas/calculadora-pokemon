<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SavedTeam } from '@/types/library'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  suggestedName: string
  teams: SavedTeam[]
}>()

const emit = defineEmits<{
  save: [payload: { name: string; teamId: string | null; newTeamName: string }]
  close: []
}>()

const name = ref(props.suggestedName)
/** '' = sin equipo, '__new__' = crear equipo, o id de equipo existente. */
const teamChoice = ref<string>('')
const newTeamName = ref('')

const canSave = computed(() => {
  if (!name.value.trim()) return false
  if (teamChoice.value === '__new__' && !newTeamName.value.trim()) return false
  return true
})

function submit() {
  if (!canSave.value) return
  emit('save', {
    name: name.value.trim(),
    teamId: teamChoice.value && teamChoice.value !== '__new__' ? teamChoice.value : null,
    newTeamName: teamChoice.value === '__new__' ? newTeamName.value.trim() : '',
  })
  emit('close')
}
</script>

<template>
  <BaseModal title="Guardar build" @close="$emit('close')">
    <form class="sbd" @submit.prevent="submit">
      <label class="sbd__field">
        Nombre de la build
        <input v-model="name" type="text" placeholder="Ej: Charizard ofensivo" autofocus />
      </label>

      <label class="sbd__field">
        Equipo
        <select v-model="teamChoice">
          <option value="">Sin equipo</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">
            {{ t.name }} ({{ t.members.length }})
          </option>
          <option value="__new__">＋ Nuevo equipo…</option>
        </select>
      </label>

      <label v-if="teamChoice === '__new__'" class="sbd__field">
        Nombre del equipo
        <input v-model="newTeamName" type="text" placeholder="Ej: Equipo VGC" />
      </label>

      <div class="sbd__actions">
        <button type="button" class="sbd__btn" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="sbd__btn sbd__btn--primary" :disabled="!canSave">
          Guardar
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.sbd {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sbd__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.sbd__field input,
.sbd__field select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
}

.sbd__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.sbd__btn {
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-weight: 600;
}

.sbd__btn--primary {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.sbd__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

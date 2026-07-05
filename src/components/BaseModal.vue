<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})

// evita warning de prop sin uso; el título se pinta en el template
void props
</script>

<template>
  <div class="modal__backdrop" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal__header">
        <h2>{{ title }}</h2>
        <button class="modal__close" type="button" aria-label="Cerrar" @click="$emit('close')">
          ✕
        </button>
      </header>
      <div class="modal__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--color-border);
}

.modal__header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.modal__close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.modal__close:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.modal__body {
  padding: 1rem 1.1rem;
  overflow-y: auto;
}
</style>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'

const props = defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

/** Id para enlazar el diálogo con su título (aria-labelledby). */
const titleId = useId()
/** Referencia al panel del diálogo, para atrapar y mover el foco. */
const modalRef = ref<HTMLElement | null>(null)
/** Elemento que tenía el foco antes de abrir, para devolvérselo al cerrar. */
let previouslyFocused: HTMLElement | null = null

/** Elementos enfocables dentro del diálogo, en orden de tabulación. */
function focusables(): HTMLElement[] {
  if (!modalRef.value) return []
  return Array.from(
    modalRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  // Atrapa el foco: Tab/Shift+Tab hacen bucle dentro del diálogo.
  if (e.key === 'Tab') {
    const items = focusables()
    if (items.length === 0) {
      e.preventDefault()
      modalRef.value?.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey && (active === first || !modalRef.value?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  // Enfoca el primer control (o el panel) al abrir.
  nextTick(() => {
    const items = focusables()
    ;(items[0] ?? modalRef.value)?.focus()
  })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  // Devuelve el foco a quien abrió el diálogo.
  previouslyFocused?.focus?.()
})

// evita warning de prop sin uso; el título se pinta en el template
void props
</script>

<template>
  <div class="modal__backdrop" @click.self="$emit('close')">
    <div
      ref="modalRef"
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <header class="modal__header">
        <h2 :id="titleId">{{ title }}</h2>
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

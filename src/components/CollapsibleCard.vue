<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Texto del encabezado (actúa como botón de plegado). */
    title: string
    /** Si se pliega por defecto en móvil (≤720px). En escritorio siempre abierto. */
    collapseOnMobile?: boolean
  }>(),
  { collapseOnMobile: true },
)

// Estado inicial: abierto en escritorio; plegado en móvil si procede.
// `<details>` gestiona su propio plegado; solo fijamos el valor de arranque.
const startClosed =
  props.collapseOnMobile &&
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 720px)').matches
const open = ref(!startClosed)
</script>

<template>
  <details
    class="ccard"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary class="ccard__summary">
      <span class="ccard__title">{{ title }}</span>
      <!-- Acciones opcionales en el encabezado (p. ej. "Reiniciar"); no plegan. -->
      <span v-if="$slots.actions" class="ccard__actions" @click.stop>
        <slot name="actions" />
      </span>
      <svg class="ccard__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2" d="M6 9l6 6 6-6" />
      </svg>
    </summary>
    <div class="ccard__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.ccard {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.ccard__summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  cursor: pointer;
  list-style: none;
  user-select: none;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

/* Oculta el triángulo nativo: usamos nuestro chevron. */
.ccard__summary::-webkit-details-marker {
  display: none;
}

.ccard__title {
  flex: 1;
}

.ccard__actions {
  display: inline-flex;
  align-items: center;
}

.ccard__chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.ccard[open] .ccard__chevron {
  transform: rotate(180deg);
}

.ccard__body {
  padding: 0 0.85rem 0.85rem;
}

/* Objetivo táctil más alto en móvil. */
@media (max-width: 720px) {
  .ccard__summary {
    padding: 0.85rem;
  }
}
</style>

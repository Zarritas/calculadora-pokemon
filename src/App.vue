<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'

const links = [
  { to: '/', label: 'Calculadora' },
  { to: '/battle', label: 'Batalla' },
  { to: '/simulator', label: 'Simulador' },
  { to: '/builds', label: 'Builds' },
  { to: '/teams', label: 'Equipos' },
  { to: '/matchups', label: 'Enfrentamientos' },
  { to: '/about', label: 'Acerca de' },
]
</script>

<template>
  <div class="app">
    <header class="app__header">
      <div class="app__bar">
        <RouterLink to="/" class="app__brand">
          <span class="app__logo" aria-hidden="true" />
          <span class="app__brand-text">
            Calculadora <span class="app__brand-accent">Champions</span>
          </span>
        </RouterLink>
        <nav class="app__nav">
          <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="app__link">
            {{ l.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="app__main">
      <RouterView />
    </main>

    <footer class="app__footer">
      <p>
        Datos del dataset abierto de Pokémon Champions y motor
        <code>@smogon/calc</code>. Proyecto no oficial, sin ánimo de lucro.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app__header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border);
}

.app__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 1040px;
  margin: 0 auto;
  padding: 0.7rem 1.5rem;
}

.app__brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  color: var(--color-text);
  white-space: nowrap;
}

/* Logo estilo Poké Ball dibujado con CSS. */
.app__logo {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(#ee1515 0 calc(50% - 2px), #2a2a2a calc(50% - 2px) calc(50% + 2px), #f4f4f4 calc(50% + 2px) 100%);
  border: 2px solid #2a2a2a;
  position: relative;
  flex-shrink: 0;
}

.app__logo::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: #fff;
  border: 2px solid #2a2a2a;
  border-radius: 50%;
}

.app__brand-accent {
  color: var(--color-accent);
}

.app__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.app__link {
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.app__link:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-text);
}

/* Estado activo (coincidencia exacta de ruta). */
.app__link.router-link-exact-active {
  background: var(--color-accent);
  color: #fff;
}

.app__main {
  flex: 1;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem;
}

.app__footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.82rem;
  color: var(--color-text-muted);
  text-align: center;
}

.app__footer code {
  font-size: 0.8rem;
}

@media (max-width: 680px) {
  .app__bar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .app__nav {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.15rem;
  }

  .app__link {
    white-space: nowrap;
  }
}
</style>

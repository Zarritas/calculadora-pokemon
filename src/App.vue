<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { decodeShare } from '@/services/transfer'
import { t, locale, setLocale } from '@/i18n'

// Diferido: solo se carga al abrir un enlace compartido, para no arrastrar el
// dataset/motor (@smogon/calc, @pkmn/img) al bundle inicial.
const ImportDialog = defineAsyncComponent(() => import('@/components/ImportDialog.vue'))

const route = useRoute()
const router = useRouter()
/** Texto del bundle a importar cuando se abre un enlace compartido (`?s=`). */
const sharedText = ref<string | null>(null)

watch(
  () => route.query.s,
  (s) => {
    if (typeof s !== 'string' || !s) return
    try {
      sharedText.value = decodeShare(s)
    } catch {
      sharedText.value = null
    }
    // Limpia el parámetro para no reimportar al refrescar.
    const query = { ...route.query }
    delete query.s
    router.replace({ query })
  },
  { immediate: true },
)

/** Salta al contenido principal sin tocar el hash (el router usa hash history). */
function skipToContent() {
  const el = document.getElementById('contenido')
  el?.focus()
  el?.scrollIntoView()
}

/** Menú móvil (hamburguesa): abierto/cerrado. En escritorio la nav va inline. */
const menuOpen = ref(false)
// Cierra el menú al cambiar de ruta (tras pulsar un enlace).
watch(() => route.path, () => (menuOpen.value = false))

const links = [
  { to: '/', key: 'nav.calculator' },
  { to: '/battle', key: 'nav.battle' },
  { to: '/simulator', key: 'nav.simulator' },
  { to: '/builds', key: 'nav.builds' },
  { to: '/teams', key: 'nav.teams' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/about', key: 'nav.about' },
]
</script>

<template>
  <div class="app">
    <a class="app__skip" href="#contenido" @click.prevent="skipToContent">Saltar al contenido</a>
    <header class="app__header">
      <div class="app__bar">
        <RouterLink to="/" class="app__brand">
          <span class="app__logo" aria-hidden="true" />
          <span class="app__brand-text">
            {{ t('app.brand') }} <span class="app__brand-accent">Champions</span>
          </span>
        </RouterLink>
        <button
          class="app__menu-btn"
          type="button"
          :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
          :aria-expanded="menuOpen"
          aria-controls="app-nav"
          @click="menuOpen = !menuOpen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              v-if="!menuOpen"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
            <path
              v-else
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
        <nav id="app-nav" class="app__nav" :class="{ 'app__nav--open': menuOpen }" aria-label="Navegación principal">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="app__link"
            @click="menuOpen = false"
          >
            {{ t(l.key) }}
          </RouterLink>
          <div class="app__actions">
          <a
            class="app__icon-link"
            href="https://github.com/Zarritas/calculadora-pokemon"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"
              />
            </svg>
          </a>
          <a
            class="app__icon-link app__patreon-icon"
            href="https://www.patreon.com/cw/zarritas"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Patreon"
            title="Patreon"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="15" cy="9.2" r="7" fill="currentColor" />
              <rect x="2" y="2" width="3.6" height="20" fill="currentColor" />
            </svg>
          </a>
          <button
            class="app__lang"
            type="button"
            :aria-label="t('app.language')"
            :title="locale === 'es' ? 'English' : 'Español'"
            @click="setLocale(locale === 'es' ? 'en' : 'es')"
          >
            <!-- Muestra la bandera del idioma al que se cambia (SVG: se ve igual en todo SO). -->
            <svg v-if="locale === 'es'" class="app__flag" viewBox="0 0 60 30" aria-hidden="true">
              <rect width="60" height="30" fill="#012169" />
              <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" stroke-width="6" />
              <path d="M0 0 L60 30 M60 0 L0 30" stroke="#c8102e" stroke-width="3" />
              <path d="M30 0 V30 M0 15 H60" stroke="#fff" stroke-width="10" />
              <path d="M30 0 V30 M0 15 H60" stroke="#c8102e" stroke-width="6" />
            </svg>
            <svg v-else class="app__flag" viewBox="0 0 3 2" aria-hidden="true">
              <rect width="3" height="2" fill="#c60b1e" />
              <rect y="0.5" width="3" height="1" fill="#ffc400" />
            </svg>
          </button>
          </div>
        </nav>
      </div>
    </header>

    <main id="contenido" class="app__main" tabindex="-1">
      <RouterView />
    </main>

    <footer class="app__footer">
      <a
        class="app__patreon"
        href="https://www.patreon.com/16367542/join"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('app.support') }}
      </a>
      <p>{{ t('app.footer') }}</p>
    </footer>

    <!-- Enlace compartido: abre el diálogo de importación con el equipo/builds del enlace. -->
    <ImportDialog v-if="sharedText !== null" :initial="sharedText" @close="sharedText = null" />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Enlace de salto al contenido: oculto hasta recibir foco por teclado. */
.app__skip {
  position: absolute;
  left: 0.5rem;
  top: -3rem;
  z-index: 200;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
  transition: top 0.15s ease;
}

.app__skip:focus {
  top: 0.5rem;
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
  gap: 0.15rem;
  /* Una sola fila: si no cabe (p. ej. en español), la barra se desliza en
     horizontal en vez de envolver y crecer (la cabecera no cambia de altura). */
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.app__nav::-webkit-scrollbar {
  height: 4px;
}

.app__link {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-text-muted);
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.app__link:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-text);
}

/* Estado activo (coincidencia exacta de ruta). Usa el acento oscurecido para
   que el texto blanco cumpla el contraste WCAG AA (4.5:1). */
.app__link.router-link-exact-active {
  background: var(--color-accent-strong);
  color: #fff;
}

.app__lang {
  margin-left: 0.35rem;
  padding: 0.25rem 0.45rem;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.app__lang:hover {
  border-color: var(--color-accent);
}

.app__flag {
  width: 24px;
  height: 16px;
  border-radius: 2px;
  display: block;
}

.app__icon-link {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-muted);
  padding: 0.2rem;
}

.app__icon-link svg {
  width: 20px;
  height: 20px;
  display: block;
}

.app__icon-link:hover {
  color: var(--color-text);
}

.app__patreon-icon {
  color: #f96854;
}

.app__patreon-icon:hover {
  color: #e14b38;
}

/* En escritorio los iconos e idioma van inline dentro de la nav (sin caja). */
.app__actions {
  display: contents;
}

/* Botón hamburguesa: oculto en escritorio, visible en móvil. */
.app__menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.app__menu-btn svg {
  width: 24px;
  height: 24px;
  display: block;
}

.app__menu-btn:hover {
  border-color: var(--color-accent);
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

.app__patreon {
  display: inline-block;
  margin-bottom: 0.6rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  background: #f96854;
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  text-decoration: none;
}

.app__patreon:hover {
  background: #e14b38;
}

/* Móvil/tablet estrecha: la nav se convierte en un menú desplegable
   (hamburguesa). La cabecera mantiene la marca a la izquierda y el botón a la
   derecha; los enlaces se despliegan a lo ancho debajo. */
@media (max-width: 860px) {
  .app__menu-btn {
    display: inline-flex;
  }

  .app__nav {
    display: none;
    flex-basis: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    overflow-x: visible;
    margin-top: 0.5rem;
  }

  .app__nav--open {
    display: flex;
  }

  /* Enlaces como filas grandes, cómodas para el dedo. */
  .app__link {
    padding: 0.7rem 0.8rem;
    font-size: 0.95rem;
    border-radius: 8px;
    white-space: nowrap;
  }

  /* Iconos e idioma en una fila centrada al pie del menú. */
  .app__actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--color-border);
  }

  .app__icon-link {
    padding: 0.5rem;
  }

  .app__lang {
    margin-left: 0;
    padding: 0.45rem 0.5rem;
  }

  /* Menos margen en pantallas estrechas: aprovecha el ancho. */
  .app__main {
    padding: 1rem;
  }
}
</style>

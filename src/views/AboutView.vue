<script setup lang="ts">
import { ref } from 'vue'
import { clearChampionsCache } from '@/services/championsData'
import { t } from '@/i18n'

const refreshing = ref(false)

function refreshData() {
  refreshing.value = true
  clearChampionsCache()
  // Recarga la página para volver a descargar los datos frescos.
  location.reload()
}
</script>

<template>
  <section class="about">
    <h1>Acerca de</h1>
    <p>
      Calculadora de daño no oficial para <strong>Pokémon Champions</strong>.
      Utiliza el motor <code>@smogon/calc</code> y datos del dataset abierto de
      Champions
      <a
        href="https://github.com/otterlyclueless/pokemon-champions-data"
        target="_blank"
        rel="noopener"
        >pokemon-champions-data</a
      >.
    </p>
    <p>
      Este proyecto no está afiliado a Nintendo, Game Freak ni The Pokémon
      Company. Todas las marcas pertenecen a sus respectivos propietarios.
    </p>

    <div class="about__support">
      <p>Si el proyecto te resulta útil y quieres apoyar su desarrollo:</p>
      <a
        class="about__patreon"
        href="https://www.patreon.com/16367542/join"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('app.support') }}
      </a>
    </div>

    <div class="about__cache">
      <h2>Datos y caché</h2>
      <p>
        El roster, los movimientos y los objetos se descargan una vez y se
        guardan en caché para ir más rápido. Si el dataset se ha actualizado y
        quieres traer la última versión, actualiza la caché.
      </p>
      <p class="about__note">
        No afecta a tus <strong>builds, equipos ni enfrentamientos guardados</strong>.
      </p>
      <button type="button" class="about__btn" :disabled="refreshing" @click="refreshData">
        {{ refreshing ? 'Actualizando…' : 'Actualizar datos' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.about p {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.about__patreon {
  display: inline-block;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  background: #f96854;
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.about__patreon:hover {
  background: #e14b38;
}

.about__cache {
  margin-top: 2rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.about__cache h2 {
  margin-top: 0;
  font-size: 1.15rem;
}

.about__note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.about__btn {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.about__btn:hover {
  opacity: 0.9;
}

.about__btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>

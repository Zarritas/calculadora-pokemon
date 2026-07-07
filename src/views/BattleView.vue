<script setup lang="ts">
import { ref } from 'vue'
import type { ChampionsMon, ChampionsMove } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { useCalculatorStore } from '@/stores/calculator'
import { useLibraryStore } from '@/stores/library'
import { useBattleStore, type Side } from '@/stores/battle'
import { getMovesForMon } from '@/services/championsData'
import type { PokemonType } from '@/types/pokemon'
import { TYPE_COLORS, TYPE_LABELS, typeTextColor } from '@/utils/typeColors'
import PokemonPicker from '@/components/PokemonPicker.vue'
import DamageResultCard from '@/components/DamageResultCard.vue'
import FieldControls from '@/components/FieldControls.vue'
import TypeFilter from '@/components/TypeFilter.vue'
import BoostsEditor from '@/components/BoostsEditor.vue'

const store = useCalculatorStore()
const library = useLibraryStore()
const battle = useBattleStore()

/** Lado para el que se está añadiendo un Pokémon (picker abierto). */
const pickerFor = ref<Side | null>(null)

const activeAllyId = ref<string | null>(null)
const activeEnemyId = ref<string | null>(null)

const moves = ref<ChampionsMove[]>([])
const loadingMoves = ref(false)
const moveQuery = ref('')
const onlyDamaging = ref(true)
const typeFilter = ref<PokemonType | null>(null)

const categoryLabel: Record<string, string> = {
  physical: 'Fís.',
  special: 'Esp.',
  status: 'Est.',
}

function filteredMoves() {
  const q = moveQuery.value.trim().toLowerCase()
  return moves.value.filter((m) => {
    if (onlyDamaging.value && m.category === 'status') return false
    if (typeFilter.value && m.type !== typeFilter.value) return false
    if (!q) return true
    return m.name.toLowerCase().includes(q) || m.type.includes(q)
  })
}

async function selectAlly(member: SavedBuild) {
  store.applyBuild('attacker', member)
  activeAllyId.value = member.id
  moveQuery.value = ''
  loadingMoves.value = true
  try {
    moves.value = await getMovesForMon(member.mon.name)
  } finally {
    loadingMoves.value = false
  }
}

function selectEnemy(member: SavedBuild) {
  store.applyBuild('defender', member)
  activeEnemyId.value = member.id
}

function selectMove(m: ChampionsMove) {
  store.selectMove(m)
}

function removeMember(side: Side, id: string) {
  battle.remove(side, id)
  if (side === 'ally' && activeAllyId.value === id) activeAllyId.value = null
  if (side === 'enemy' && activeEnemyId.value === id) activeEnemyId.value = null
}

/* --- Añadir miembros vía picker --- */
function onPickMon(mon: ChampionsMon) {
  if (pickerFor.value) battle.addMon(pickerFor.value, mon)
}
function onPickBuild(build: SavedBuild) {
  if (pickerFor.value) battle.addBuild(pickerFor.value, build)
}

/* --- Cargar un equipo guardado en un bando --- */
function loadTeam(side: Side, teamId: string) {
  const team = library.teams.find((t) => t.id === teamId)
  if (team) battle.loadTeam(side, team)
}

/* --- Guardar el bando actual como equipo de la biblioteca --- */
function saveTeam(side: Side) {
  const members = side === 'ally' ? battle.ally : battle.enemy
  if (!members.length) return
  const suggested = side === 'ally' ? 'Mi equipo' : 'Equipo rival'
  const name = window.prompt('Nombre del equipo:', suggested)
  if (name && name.trim()) library.createTeamFrom(name.trim(), members)
}
</script>

<template>
  <section class="battle">
    <h1>Equipo vs Equipo</h1>
    <p class="battle__hint">
      Añade Pokémon a cada bando (desde el roster, tus builds o un equipo
      guardado) sin necesidad de guardar nada. Pulsa un aliado, un movimiento y
      un rival: el daño se calcula al instante.
    </p>

    <div class="battle__grid">
      <!-- ALIADO -->
      <div class="battle__col">
        <div class="team-col team-col--ally">
        <div class="team-col__head">
          <span class="team-col__title">Tu equipo ({{ battle.ally.length }})</span>
          <div class="team-col__actions">
            <select
              class="team-col__load"
              aria-label="Cargar equipo guardado en tu bando"
              :disabled="!library.teams.length"
              @change="loadTeam('ally', ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">
                {{ library.teams.length ? 'Cargar equipo guardado…' : 'Sin equipos guardados' }}
              </option>
              <option v-for="t in library.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <button v-if="battle.ally.length" class="team-col__save" @click="saveTeam('ally')">
              Guardar
            </button>
            <button v-if="battle.ally.length" class="team-col__clear" @click="battle.clear('ally')">
              Vaciar
            </button>
          </div>
        </div>

        <div class="team-col__members">
          <div v-for="m in battle.ally" :key="m.id" class="chip-wrap">
            <button
              class="chip"
              :class="{ 'chip--active chip--ally': m.id === activeAllyId }"
              @click="selectAlly(m)"
            >
              <img :src="m.mon.sprite" :alt="m.mon.name" width="48" height="48" />
              <span>{{ m.mon.name }}</span>
            </button>
            <button class="chip__del" type="button" :aria-label="`Quitar ${m.mon.name}`" @click="removeMember('ally', m.id)">✕</button>
          </div>
          <button class="add-btn" @click="pickerFor = 'ally'">＋ Añadir Pokémon</button>
        </div>
        </div>

        <!-- Cambios de stats del atacante activo, en un recuadro bajo su equipo. -->
        <BoostsEditor
          v-if="store.attacker"
          class="team-col__boosts"
          :boosts="store.attackerBoosts"
          title="Cambios de stats · Atacante"
        />
      </div>

      <!-- CENTRO -->
      <div class="center">
        <div class="center__matchup">
          <span :class="{ 'center__slot--set': store.attacker }">
            {{ store.attacker?.name ?? 'Atacante' }}
          </span>
          <em>vs</em>
          <span :class="{ 'center__slot--set': store.defender }">
            {{ store.defender?.name ?? 'Defensor' }}
          </span>
        </div>

        <!-- Resultado del cálculo, arriba del todo (antes del moveset). -->
        <div aria-live="polite">
          <DamageResultCard
            v-if="store.result"
            :result="store.result"
            :attacker="store.attacker"
            :defender="store.defender"
            :move="store.move"
          />
        </div>

        <div v-if="store.attacker && store.attackerMoves.length" class="quickmoves">
          <span class="quickmoves__label">Moveset guardado</span>
          <div class="quickmoves__list">
            <button
              v-for="m in store.attackerMoves"
              :key="m.name"
              class="move move--quick"
              :class="{ 'move--active': store.move?.name === m.name }"
              @click="selectMove(m)"
            >
              <span class="move__type" :style="{ backgroundColor: TYPE_COLORS[m.type], color: typeTextColor(m.type) }">
                {{ TYPE_LABELS[m.type] }}
              </span>
              <span class="move__name">{{ m.name }}</span>
              <span class="move__pow">{{ m.power ?? '—' }}</span>
            </button>
          </div>
        </div>

        <div v-if="store.attacker" class="moves">
          <div class="moves__controls">
            <input v-model="moveQuery" type="search" placeholder="Buscar movimiento…" aria-label="Buscar movimiento" />
            <label><input v-model="onlyDamaging" type="checkbox" /> Solo daño</label>
          </div>
          <TypeFilter v-model="typeFilter" />
          <p v-if="loadingMoves" class="moves__status">Cargando movimientos…</p>
          <div v-else class="moves__list">
            <button
              v-for="m in filteredMoves()"
              :key="m.name"
              class="move"
              :class="{ 'move--active': store.move?.name === m.name }"
              @click="selectMove(m)"
            >
              <span class="move__type" :style="{ backgroundColor: TYPE_COLORS[m.type], color: typeTextColor(m.type) }">
                {{ TYPE_LABELS[m.type] }}
              </span>
              <span class="move__name">{{ m.name }}</span>
              <span class="move__cat">{{ categoryLabel[m.category] }}</span>
              <span class="move__pow">{{ m.power ?? '—' }}</span>
            </button>
          </div>
        </div>
        <p v-else class="moves__status">Selecciona un Pokémon aliado para ver sus movimientos.</p>
      </div>

      <!-- RIVAL -->
      <div class="battle__col">
        <div class="team-col team-col--enemy">
        <div class="team-col__head">
          <span class="team-col__title">Rival ({{ battle.enemy.length }})</span>
          <div class="team-col__actions">
            <select
              class="team-col__load"
              aria-label="Cargar equipo guardado en el rival"
              :disabled="!library.teams.length"
              @change="loadTeam('enemy', ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">
                {{ library.teams.length ? 'Cargar equipo guardado…' : 'Sin equipos guardados' }}
              </option>
              <option v-for="t in library.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <button v-if="battle.enemy.length" class="team-col__save" @click="saveTeam('enemy')">
              Guardar
            </button>
            <button v-if="battle.enemy.length" class="team-col__clear" @click="battle.clear('enemy')">
              Vaciar
            </button>
          </div>
        </div>

        <div class="team-col__members">
          <div v-for="m in battle.enemy" :key="m.id" class="chip-wrap">
            <button
              class="chip"
              :class="{ 'chip--active chip--enemy': m.id === activeEnemyId }"
              @click="selectEnemy(m)"
            >
              <img :src="m.mon.sprite" :alt="m.mon.name" width="48" height="48" />
              <span>{{ m.mon.name }}</span>
            </button>
            <button class="chip__del" type="button" :aria-label="`Quitar ${m.mon.name}`" @click="removeMember('enemy', m.id)">✕</button>
          </div>
          <button class="add-btn" @click="pickerFor = 'enemy'">＋ Añadir Pokémon</button>
        </div>
        </div>

        <!-- Cambios de stats del rival activo, en un recuadro bajo su equipo. -->
        <BoostsEditor
          v-if="store.defender"
          class="team-col__boosts"
          :boosts="store.defenderBoosts"
          title="Cambios de stats · Rival"
        />
      </div>
    </div>

    <FieldControls :field="store.field" />

    <PokemonPicker
      v-if="pickerFor"
      :title="pickerFor === 'ally' ? 'Añadir a tu equipo' : 'Añadir al rival'"
      @select="onPickMon"
      @select-build="onPickBuild"
      @close="pickerFor = null"
    />
  </section>
</template>

<style scoped>
.battle__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.battle__grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1.5rem;
}

/* Cada celda de la rejilla apila su equipo y, debajo, su recuadro de boosts. */
.battle__col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-col {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.8rem;
  background: var(--color-surface);
}

.team-col--ally {
  border-top: 3px solid #4a7fc0;
}
.team-col--enemy {
  border-top: 3px solid #e05a4a;
}

.team-col__head {
  margin-bottom: 0.6rem;
}

.team-col__title {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.team-col__actions {
  display: flex;
  gap: 0.4rem;
}

.team-col__load {
  flex: 1;
  padding: 0.3rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.78rem;
}

.team-col__save,
.team-col__clear {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
}

.team-col__save:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.team-col__clear:hover {
  border-color: #e53935;
  color: #e53935;
}

.team-col__members {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chip-wrap {
  display: flex;
  gap: 0.3rem;
}

.chip {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  min-width: 0;
}

.chip:hover {
  border-color: var(--color-accent);
}

.chip img {
  image-rendering: pixelated;
  flex-shrink: 0;
}

.chip span {
  font-size: 0.82rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip--active {
  box-shadow: 0 0 0 2px currentColor;
}
.chip--ally {
  border-color: #4a7fc0;
  color: #4a7fc0;
}
.chip--enemy {
  border-color: #e05a4a;
  color: #e05a4a;
}
.chip--active span {
  color: var(--color-text);
}

.chip__del {
  padding: 0 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.chip__del:hover {
  border-color: #e53935;
  color: #e53935;
}

.add-btn {
  padding: 0.45rem;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.add-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.center {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.center__matchup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-weight: 700;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.center__matchup em {
  color: var(--color-text-muted);
  font-style: normal;
}

.center__matchup span {
  color: var(--color-text-muted);
}

.center__slot--set {
  color: var(--color-text) !important;
}

.quickmoves__label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.quickmoves__list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.move--quick {
  grid-template-columns: 50px 1fr 30px;
}

.moves__controls {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.moves__controls input[type='search'] {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
}

.moves__controls label {
  font-size: 0.8rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.moves__status {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
  padding: 0.5rem 0;
}

.moves__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  /* ~5 movimientos visibles; el resto con scroll. */
  max-height: 190px;
  overflow-y: auto;
}

.move {
  display: grid;
  grid-template-columns: 58px 1fr auto 32px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.move:hover {
  border-color: var(--color-accent);
}

.move--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.move__type {
  font-size: 0.6rem;
  font-weight: 700;
  text-align: center;
  padding: 0.12rem 0;
  border-radius: 999px;
}

.move__name {
  font-size: 0.82rem;
  font-weight: 600;
}

.move__cat {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.move__pow {
  font-size: 0.8rem;
  font-weight: 700;
  text-align: right;
}

@media (max-width: 860px) {
  .battle__grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { useCalculatorStore } from '@/stores/calculator'
import { useLibraryStore } from '@/stores/library'
import { CHAMPIONS_LEVEL } from '@/utils/champions'
import CombatantSlot from '@/components/CombatantSlot.vue'
import StatPointsEditor from '@/components/StatPointsEditor.vue'
import BoostsEditor from '@/components/BoostsEditor.vue'
import MovesetEditor from '@/components/MovesetEditor.vue'
import FieldControls from '@/components/FieldControls.vue'
import PokemonPicker from '@/components/PokemonPicker.vue'
import ItemPicker from '@/components/ItemPicker.vue'
import SaveBuildDialog from '@/components/SaveBuildDialog.vue'
import DamageResultCard from '@/components/DamageResultCard.vue'

const store = useCalculatorStore()
const library = useLibraryStore()

type Side = 'attacker' | 'defender'

const pickerFor = ref<Side | null>(null)
const itemPickerFor = ref<Side | null>(null)
const saveDialogFor = ref<Side | null>(null)

function onPickPokemon(mon: ChampionsMon) {
  if (pickerFor.value === 'attacker') store.selectAttacker(mon)
  else if (pickerFor.value === 'defender') store.selectDefender(mon)
}

function onPickBuild(build: SavedBuild) {
  if (pickerFor.value) store.applyBuild(pickerFor.value, build)
}

function onPickItem(name: string | null) {
  if (itemPickerFor.value === 'attacker') store.attackerItem = name
  else if (itemPickerFor.value === 'defender') store.defenderItem = name
}

const suggestedName = ref('')

function openSaveDialog(side: Side) {
  const mon = side === 'attacker' ? store.attacker : store.defender
  suggestedName.value = mon ? mon.name : ''
  saveDialogFor.value = side
}

function onSaveBuild(payload: { name: string; teamId: string | null; newTeamName: string }) {
  if (!saveDialogFor.value) return
  const data = store.currentBuildData(saveDialogFor.value)
  if (!data) return
  const saved = library.addBuild({ name: payload.name, ...data })

  const teamId = payload.newTeamName ? library.createTeam(payload.newTeamName).id : payload.teamId
  if (teamId) library.addBuildToTeam(teamId, saved)
}

/* --- Historial automático de enfrentamientos --- */
const matchupKey = computed(() =>
  store.attacker && store.move && store.defender
    ? `${store.attacker.name}|${store.move.name}|${store.defender.name}`
    : null,
)

let historyTimer: ReturnType<typeof setTimeout> | undefined
watch(matchupKey, (key) => {
  clearTimeout(historyTimer)
  if (!key) return
  // Pequeño retardo para registrar el estado ya estable (SP, objeto, etc.).
  historyTimer = setTimeout(() => {
    const m = store.currentMatchup()
    if (m) library.recordHistory(m)
  }, 900)
})

const justSaved = ref(false)
function saveCurrentMatchup() {
  const m = store.currentMatchup()
  if (!m) return
  library.saveMatchup(m)
  justSaved.value = true
  setTimeout(() => (justSaved.value = false), 2000)
}
</script>

<template>
  <section class="calculator">
    <div class="calculator__title">
      <h1>Calculadora de daño</h1>
      <span class="calculator__badge">Champions · Nv. {{ CHAMPIONS_LEVEL }}</span>
    </div>
    <p class="calculator__hint">
      Solo Pokémon, movimientos, megas y objetos disponibles en Pokémon Champions.
      Reparte los 66 Stat Points (máx. 32 por stat) y la naturaleza. Cálculo con
      <code>@smogon/calc</code>.
    </p>

    <div class="calculator__combatants">
      <div class="calculator__side">
        <CombatantSlot
          label="Atacante"
          :pokemon="store.attacker"
          :item="store.attackerItem"
          :status="store.attackerStatus"
          :ability="store.attackerAbility"
          @pick="pickerFor = 'attacker'"
          @pick-item="itemPickerFor = 'attacker'"
          @save="openSaveDialog('attacker')"
          @update:status="store.attackerStatus = $event"
          @update:ability="store.attackerAbility = $event"
        />
        <MovesetEditor
          v-if="store.attacker"
          :moves="store.attackerMoves"
          :mon-name="store.attacker.name"
          :active-name="store.move?.name ?? null"
          selectable
          @update:moves="store.setAttackerMoves($event)"
          @select="store.selectMove($event)"
        />
        <StatPointsEditor
          v-if="store.attacker"
          :build="store.attackerBuild"
          :base-stats="store.attacker.baseStats"
        />
        <BoostsEditor v-if="store.attacker" :boosts="store.attackerBoosts" />
      </div>

      <div class="calculator__side">
        <CombatantSlot
          label="Defensor"
          :pokemon="store.defender"
          :item="store.defenderItem"
          :status="store.defenderStatus"
          :ability="store.defenderAbility"
          @pick="pickerFor = 'defender'"
          @pick-item="itemPickerFor = 'defender'"
          @save="openSaveDialog('defender')"
          @update:status="store.defenderStatus = $event"
          @update:ability="store.defenderAbility = $event"
        />
        <MovesetEditor
          v-if="store.defender"
          :moves="store.defenderMoves"
          :mon-name="store.defender.name"
          @update:moves="store.setDefenderMoves($event)"
        />
        <StatPointsEditor
          v-if="store.defender"
          :build="store.defenderBuild"
          :base-stats="store.defender.baseStats"
        />
        <BoostsEditor v-if="store.defender" :boosts="store.defenderBoosts" />
      </div>
    </div>

    <FieldControls :field="store.field" />

    <p v-if="store.error" class="calculator__status calculator__status--error">
      {{ store.error }}
    </p>

    <template v-if="store.result">
      <DamageResultCard
        :result="store.result"
        :attacker="store.attacker"
        :defender="store.defender"
        :move="store.move"
      />
      <div class="calculator__save">
        <button type="button" class="calculator__save-btn" @click="saveCurrentMatchup">
          {{ justSaved ? '✓ Guardado' : 'Guardar enfrentamiento' }}
        </button>
        <RouterLink to="/matchups" class="calculator__save-link">Ver enfrentamientos</RouterLink>
      </div>
    </template>
    <p v-else class="calculator__placeholder">
      Completa atacante, movimiento y defensor para ver el daño.
    </p>

    <PokemonPicker
      v-if="pickerFor"
      :title="pickerFor === 'attacker' ? 'Elegir atacante' : 'Elegir defensor'"
      :selected-name="pickerFor === 'attacker' ? store.attacker?.name : store.defender?.name"
      @select="onPickPokemon"
      @select-build="onPickBuild"
      @close="pickerFor = null"
    />

    <ItemPicker
      v-if="itemPickerFor"
      :selected="itemPickerFor === 'attacker' ? store.attackerItem : store.defenderItem"
      @select="onPickItem"
      @close="itemPickerFor = null"
    />

    <SaveBuildDialog
      v-if="saveDialogFor"
      :suggested-name="suggestedName"
      :teams="library.teams"
      @save="onSaveBuild"
      @close="saveDialogFor = null"
    />
  </section>
</template>

<style scoped>
.calculator__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.calculator__badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: #fff;
}

.calculator__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.calculator__combatants {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  align-items: start;
  margin-bottom: 1.5rem;
}

.calculator__side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.calculator__status {
  margin-bottom: 1rem;
}

.calculator__status--error {
  color: #e53935;
}

.calculator__placeholder {
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

.calculator__save {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.85rem;
}

.calculator__save-btn {
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: transparent;
  color: var(--color-accent);
  font-weight: 600;
  cursor: pointer;
}

.calculator__save-btn:hover {
  background: var(--color-accent);
  color: #fff;
}

.calculator__save-link {
  font-size: 0.85rem;
}

@media (max-width: 720px) {
  .calculator__combatants {
    grid-template-columns: 1fr;
  }
}
</style>

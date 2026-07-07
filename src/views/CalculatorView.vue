<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ChampionsMon } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { useCalculatorStore } from '@/stores/calculator'
import { useLibraryStore } from '@/stores/library'
import { encodeShare, decodeShare, copyToClipboard } from '@/services/transfer'
import { encodeMatchup, decodeMatchup } from '@/services/calcShare'
import { t } from '@/i18n'
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

/** Mensaje efímero para lectores de pantalla (región aria-live). */
const liveMsg = ref('')
function announce(msg: string) {
  liveMsg.value = msg
  setTimeout(() => (liveMsg.value = ''), 2000)
}

const justSaved = ref(false)
function saveCurrentMatchup() {
  const m = store.currentMatchup()
  if (!m) return
  library.saveMatchup(m)
  justSaved.value = true
  announce(t('calc.saved'))
  setTimeout(() => (justSaved.value = false), 2000)
}

/* --- Compartir el cálculo por URL --- */
const route = useRoute()
const router = useRouter()
const justShared = ref(false)

async function shareCalc() {
  const m = store.currentMatchup()
  if (!m) return
  const code = encodeShare(encodeMatchup(m))
  const href = router.resolve({ name: 'calculator', query: { calc: code } }).href
  const url = `${location.origin}${location.pathname}${href}`
  const ok = await copyToClipboard(url)
  if (ok) {
    justShared.value = true
    announce(t('calc.shared'))
    setTimeout(() => (justShared.value = false), 1500)
  } else {
    window.prompt('Copia este enlace del cálculo:', url)
  }
}

// Al abrir un enlace de cálculo (?calc=), reconstruye el enfrentamiento.
onMounted(async () => {
  const c = route.query.calc
  if (typeof c !== 'string' || !c) return
  const query = { ...route.query }
  delete query.calc
  router.replace({ query })
  try {
    const m = await decodeMatchup(decodeShare(c))
    if (m) store.applyMatchup(m)
  } catch {
    /* enlace inválido: se ignora */
  }
})
</script>

<template>
  <section class="calculator">
    <p class="sr-only" aria-live="polite">{{ liveMsg }}</p>
    <div class="calculator__title">
      <h1>{{ t('calc.title') }}</h1>
      <span class="calculator__badge">{{ t('calc.badge', { level: CHAMPIONS_LEVEL }) }}</span>
      <button
        v-if="store.attacker || store.defender"
        type="button"
        class="calculator__clear"
        @click="store.reset()"
      >
        {{ t('calc.clear') }}
      </button>
    </div>
    <p class="calculator__hint">{{ t('calc.hint') }}</p>

    <!-- Resultado del cálculo arriba (antes de los combatientes), como en Batalla. -->
    <p v-if="store.error" class="calculator__status calculator__status--error" role="alert">
      {{ store.error }}
    </p>

    <div class="calculator__result" aria-live="polite">
      <template v-if="store.result">
        <DamageResultCard
          :result="store.result"
          :attacker="store.attacker"
          :defender="store.defender"
          :move="store.move"
        />
        <div class="calculator__save">
          <button type="button" class="calculator__save-btn" @click="saveCurrentMatchup">
            {{ justSaved ? t('calc.saved') : t('calc.save') }}
          </button>
          <button type="button" class="calculator__save-btn" @click="shareCalc">
            {{ justShared ? t('calc.shared') : t('calc.share') }}
          </button>
          <RouterLink to="/matchups" class="calculator__save-link">{{ t('calc.viewMatchups') }}</RouterLink>
        </div>
      </template>
      <p v-else class="calculator__placeholder">{{ t('calc.placeholder') }}</p>
    </div>

    <FieldControls :field="store.field" />

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
          @clear="store.clearSide('attacker')"
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
          @clear="store.clearSide('defender')"
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
  background: var(--color-accent-strong);
  color: #fff;
}

.calculator__clear {
  margin-left: auto;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.calculator__clear:hover {
  border-color: #e53935;
  color: #e53935;
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
  background: var(--color-accent-strong);
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

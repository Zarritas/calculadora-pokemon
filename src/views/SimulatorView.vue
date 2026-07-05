<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { BoostKey, BoostSpread, ChampionsMon, ChampionsMove, Terrain, Weather } from '@/types/pokemon'
import { BOOST_ORDER, zeroBoosts } from '@/utils/champions'
import type { SavedBuild } from '@/types/library'
import {
  useSimulatorStore,
  type Action,
  type BattleFormat,
  type DamageAssumptions,
  type SideId,
  type SlotAction,
} from '@/stores/simulator'
import { useBattleStore, type Side } from '@/stores/battle'
import { useLibraryStore } from '@/stores/library'
import { getMoveEffect } from '@/services/moveEffects'
import { TYPE_COLORS, TYPE_LABELS } from '@/utils/typeColors'
import { TERRAIN_OPTIONS, WEATHER_OPTIONS } from '@/utils/field'

/** Objetivos que no requieren que el jugador elija (uno mismo, área, aleatorio…). */
const AUTO_TARGET = new Set([
  'self',
  'allySide',
  'allyTeam',
  'all',
  'allAdjacent',
  'allAdjacentFoes',
  'foeSide',
  'randomNormal',
  'scripted',
])
function autoResolves(move: ChampionsMove): boolean {
  const e = getMoveEffect(move.name)
  return !!e && AUTO_TARGET.has(e.target)
}
import PokemonPicker from '@/components/PokemonPicker.vue'
import FieldControls from '@/components/FieldControls.vue'
import BuildEditor from '@/components/BuildEditor.vue'
import FighterCard from '@/components/FighterCard.vue'

const sim = useSimulatorStore()
const battle = useBattleStore()
const library = useLibraryStore()

/* ---------- Configuración ---------- */
const useAI = ref(true)
const fmt = ref<BattleFormat>('singles')
const pickerFor = ref<Side | null>(null)
const editing = ref<SavedBuild | null>(null)
/** Paso del setup: armar equipos o elegir orden de combate. */
const setupStep = ref<'teams' | 'order'>('teams')
const allyPicks = ref<string[]>([])
const enemyPicks = ref<string[]>([])

const minPerTeam = computed(() => (fmt.value === 'doubles' ? 2 : 1))
const canStart = computed(
  () => battle.ally.length >= minPerTeam.value && battle.enemy.length >= minPerTeam.value,
)
const missingMoves = computed(
  () => [...battle.ally, ...battle.enemy].filter((m) => !m.moves || m.moves.length === 0).length,
)

function onPickMon(mon: ChampionsMon) {
  if (pickerFor.value) battle.addMon(pickerFor.value, mon)
}
function onPickBuild(build: SavedBuild) {
  if (pickerFor.value) battle.addBuild(pickerFor.value, build)
}
function loadTeam(side: Side, teamId: string) {
  const team = library.teams.find((t) => t.id === teamId)
  if (team) battle.loadTeam(side, team)
}
function saveTeam(side: Side) {
  const members = side === 'ally' ? battle.ally : battle.enemy
  if (!members.length) return
  const name = window.prompt('Nombre del equipo:', side === 'ally' ? 'Mi equipo' : 'Equipo rival')
  if (name && name.trim()) library.createTeamFrom(name.trim(), members)
}
/** Pasa del armado de equipos a la elección de orden. */
function goToOrder() {
  if (!canStart.value) return
  allyPicks.value = []
  enemyPicks.value = []
  setupStep.value = 'order'
}

function togglePick(side: Side, id: string) {
  const picks = side === 'ally' ? allyPicks : enemyPicks
  picks.value = picks.value.includes(id)
    ? picks.value.filter((x) => x !== id)
    : [...picks.value, id]
}

function pickPosition(side: Side, id: string) {
  const idx = (side === 'ally' ? allyPicks : enemyPicks).value.indexOf(id)
  return idx === -1 ? null : idx + 1
}

/** Añade en orden los que falten del bando. */
function useAllOf(side: Side) {
  const members = side === 'ally' ? battle.ally : battle.enemy
  const picks = side === 'ally' ? allyPicks : enemyPicks
  picks.value = members.map((m) => m.id)
}

const orderCanStart = computed(
  () =>
    allyPicks.value.length >= minPerTeam.value &&
    (useAI.value || enemyPicks.value.length >= minPerTeam.value),
)

function buildOrdered(members: SavedBuild[], picks: string[]): SavedBuild[] {
  return picks.map((id) => members.find((m) => m.id === id)).filter((m): m is SavedBuild => !!m)
}

/** Inicia el combate con el orden elegido. */
async function startFromOrder() {
  if (!orderCanStart.value) return
  const allyBuilds = buildOrdered(battle.ally, allyPicks.value)
  const enemyBuilds = useAI.value ? battle.enemy : buildOrdered(battle.enemy, enemyPicks.value)
  await sim.start(allyBuilds, enemyBuilds, useAI.value, fmt.value)
  beginSelection()
  setupStep.value = 'teams'
}

/* ---------- Recogida de acciones ---------- */
const choosingSide = ref<SideId | null>(null)
/** Slots que hay que elegir en el bando actual (fijo durante el bando). */
const slotOrder = ref<number[]>([])
/** Posición actual dentro de slotOrder (permite retroceder). */
const cursor = ref(0)
/** Acción elegida por posición (null = sin acción para ese slot). */
const picked = ref<(SlotAction | null)[]>([])
const chosenAlly = ref<SlotAction[]>([])
const chosenEnemy = ref<SlotAction[]>([])
const panelMode = ref<'move' | 'switch'>('move')
const pendingMove = ref<ChampionsMove | null>(null)
/** El jugador ha marcado megaevolucionar este turno. */
const megaThisTurn = ref(false)

const currentSlot = computed(() =>
  cursor.value < slotOrder.value.length ? slotOrder.value[cursor.value] : null,
)
const canGoBack = computed(() => cursor.value > 0)
const currentActive = computed(() =>
  choosingSide.value && currentSlot.value != null
    ? sim.fighterAt(choosingSide.value, currentSlot.value)
    : null,
)
const opposingSide = computed<SideId>(() => (choosingSide.value === 'ally' ? 'enemy' : 'ally'))
const benchSlots = computed(() => (choosingSide.value ? sim.benchAlive(choosingSide.value) : []))

/** Objetivos posibles de un movimiento de objetivo único: rivales + compañero. */
const targetOptions = computed(() => {
  const side = choosingSide.value
  if (!side) return []
  const opp = opposingSide.value
  const foes = sim.aliveSlots(opp).map((slot) => ({ side: opp, slot, ally: false, fighter: sim.fighterAt(opp, slot)! }))
  const partners = sim
    .aliveSlots(side)
    .filter((s) => s !== currentSlot.value)
    .map((slot) => ({ side, slot, ally: true, fighter: sim.fighterAt(side, slot)! }))
  return [...foes, ...partners]
})

/** ¿El combatiente actual puede megaevolucionar? */
const canMega = computed(() => {
  const f = currentActive.value
  const side = choosingSide.value
  return !!f && !!f.megaForm && !f.megaEvolved && !!side && !sim.megaUsed[side]
})
/** ¿Va a megaevolucionar este turno? (afecta a la previsualización de daño). */
const megaPlanned = computed(() => canMega.value && megaThisTurn.value)
/** Pokémon del atacante a mostrar en las suposiciones (la megaforma si va a mega). */
const atkMon = computed(() =>
  megaPlanned.value && currentActive.value?.megaForm
    ? currentActive.value.megaForm
    : (currentActive.value?.mon ?? null),
)

const panelTitle = computed(() => {
  if (!currentActive.value) return ''
  const who = !sim.aiEnabled && choosingSide.value === 'enemy' ? 'Rival (manual)' : 'Tú'
  return `${who} — ${currentActive.value.mon.name}`
})

/** El slot tiene acción forzada (carga en curso o recarga): no se elige. */
function isForced(side: SideId, slot: number): boolean {
  const f = sim.fighterAt(side, slot)
  return !!f && (f.mustRecharge || !!f.chargingMove)
}

function resetPanel() {
  panelMode.value = 'move'
  pendingMove.value = null
  megaThisTurn.value = false
}

function startSide(side: SideId) {
  choosingSide.value = side
  slotOrder.value = sim.aliveSlots(side).filter((s) => !isForced(side, s))
  cursor.value = 0
  picked.value = []
  resetPanel()
  if (!slotOrder.value.length) sideComplete()
}

/** Acciones reales elegidas este bando (descarta los slots saltados). */
function collectedActions(): SlotAction[] {
  return picked.value.filter((p): p is SlotAction => p !== null)
}

function sideComplete() {
  if (choosingSide.value === 'ally') {
    chosenAlly.value = collectedActions()
    if (sim.aiEnabled) {
      sim.submitTurn(chosenAlly.value, sim.aiActions())
      afterSubmit()
    } else {
      startSide('enemy')
    }
  } else {
    chosenEnemy.value = collectedActions()
    sim.submitTurn(chosenAlly.value, chosenEnemy.value)
    afterSubmit()
  }
}

function beginSelection() {
  chosenAlly.value = []
  chosenEnemy.value = []
  startSide('ally')
}

function finalize(action: Action) {
  picked.value[cursor.value] = { slot: currentSlot.value!, action }
  goNext()
}

function skipSlot() {
  picked.value[cursor.value] = null
  goNext()
}

function goNext() {
  cursor.value += 1
  resetPanel()
  if (cursor.value >= slotOrder.value.length) sideComplete()
}

/** Retrocede al Pokémon anterior para rehacer su acción. */
function goBack() {
  if (cursor.value === 0) return
  cursor.value -= 1
  resetPanel()
}

function afterSubmit() {
  if (sim.phase === 'battle') beginSelection()
  else choosingSide.value = null
}

const FIRST_TURN_ONLY = new Set(['Fake Out', 'First Impression'])
function moveDisabled(move: ChampionsMove): boolean {
  const f = currentActive.value
  if (!f) return false
  if (f.lockedMove && f.lockedMove !== move.name) return true
  if (f.itemActive && f.build.item === 'Assault Vest' && move.category === 'status') return true
  if (FIRST_TURN_ONLY.has(move.name) && f.turnsActive > 0) return true
  return false
}

/* ---------- Suposiciones (what-if) para la previsualización de daño ---------- */
/** Panel de suposiciones abierto. */
const showAssumptions = ref(false)
/** Clima y terreno hipotéticos ('current' = el actual del combate). */
const previewWeather = ref<Weather | 'current'>('current')
const previewTerrain = ref<Terrain | 'current'>('current')
/** Cambios de stats, precisión y habilidad hipotéticos del atacante. */
const atkBoosts = reactive<BoostSpread>(zeroBoosts())
const atkAbility = ref('')
const atkAccStage = ref(0)
/** Apoyo del aliado al atacante (solo dobles). */
const atkHelpingHand = ref(false)
const atkBattery = ref(false)
const atkPowerSpot = ref(false)
const atkSteelySpirit = ref(false)
/** Suposiciones por cada rival, indexadas por su slot (cada rival por separado). */
const foeBoosts = reactive<Record<number, BoostSpread>>({})
const foeAbility = reactive<Record<number, string>>({})
const foeEvaStage = reactive<Record<number, number>>({})
const foeMega = reactive<Record<number, boolean>>({})
/** Pantallas supuestas por rival (Reflejo / Pantalla de Luz / Velo Aurora). */
const foeScreens = reactive<
  Record<number, { reflect: boolean; lightScreen: boolean; auroraVeil: boolean }>
>({})
/** Prevención (Friend Guard) del aliado de cada rival (reduce el daño recibido). */
const foeFriendGuard = reactive<Record<number, boolean>>({})
/** Viento Afín supuesto por bando (para el orden de turno). */
const atkTailwind = ref(false)
const foeTailwind = ref(false)
/** Movimiento supuesto de cada activo (por `side:slot`) para calcular el orden de turno. */
const orderMoves = reactive<Record<string, ChampionsMove | null>>({})
function movesOf(side: SideId, slot: number): ChampionsMove[] {
  return sim.fighterAt(side, slot)?.build.moves ?? []
}
function setOrderMove(side: SideId, slot: number, name: string) {
  orderMoves[`${side}:${slot}`] = name ? (movesOf(side, slot).find((m) => m.name === name) ?? null) : null
}
function clearOrderMoves() {
  for (const k of Object.keys(orderMoves)) delete orderMoves[k]
}

/** ¿Hay más de un rival activo? (para etiquetar los % con el nombre). */
const manyFoes = computed(() => sim.aliveSlots(opposingSide.value).length > 1)
/** Rivales activos con su combatiente (para los bloques de suposición por rival). */
const foeViews = computed(() =>
  sim
    .aliveSlots(opposingSide.value)
    .map((slot) => ({ slot, f: sim.fighterAt(opposingSide.value, slot) }))
    .filter((x): x is { slot: number; f: NonNullable<typeof x.f> } => !!x.f),
)
/** Firma de los rivales activos (para re-sincronizar cuando cambian). */
const foesSignature = computed(() => foeViews.value.map((v) => `${v.slot}:${v.f.mon.name}`).join('|'))
/** Rivales con el Pokémon a mostrar (su megaforma si se supone la mega) y si puede mega. */
const foeDisplay = computed(() =>
  foeViews.value.map((fv) => ({
    slot: fv.slot,
    mon: foeMega[fv.slot] && fv.f.megaForm ? fv.f.megaForm : fv.f.mon,
    canMega: !!fv.f.megaForm && !fv.f.megaEvolved,
  })),
)

/** Sincroniza las suposiciones del atacante con el estado real. */
function syncAttacker() {
  const a = currentActive.value
  if (!a) return
  Object.assign(atkBoosts, a.boosts)
  atkAccStage.value = a.accStage
  atkHelpingHand.value = false
  atkBattery.value = false
  atkPowerSpot.value = false
  atkSteelySpirit.value = false
  atkTailwind.value = sim.tailwind[choosingSide.value ?? 'ally'] > 0
  foeTailwind.value = sim.tailwind[opposingSide.value] > 0
  clearOrderMoves()
  // Si va a megaevolucionar, la habilidad por defecto es la de la megaforma.
  atkAbility.value =
    megaPlanned.value && a.megaForm ? (a.megaForm.abilities[0] ?? a.ability) : a.ability
}
/** Sincroniza las suposiciones de los rivales con el estado real. */
function syncFoes() {
  for (const { slot, f } of foeViews.value) {
    foeBoosts[slot] = { ...f.boosts }
    foeAbility[slot] = f.ability
    foeEvaStage[slot] = f.evaStage
    foeMega[slot] = false
    foeScreens[slot] = {
      reflect: sim.field.reflect,
      lightScreen: sim.field.lightScreen,
      auroraVeil: sim.field.auroraVeil,
    }
    foeFriendGuard[slot] = false
  }
  clearOrderMoves()
}
watch([showAssumptions, currentActive, () => sim.turn], () => {
  if (showAssumptions.value) {
    syncAttacker()
    syncFoes()
  }
})
watch(foesSignature, () => {
  if (showAssumptions.value) syncFoes()
})
// Al marcar/desmarcar la mega del atacante, ajusta solo su habilidad por defecto.
watch(megaPlanned, () => {
  const a = currentActive.value
  if (showAssumptions.value && a) {
    atkAbility.value =
      megaPlanned.value && a.megaForm ? (a.megaForm.abilities[0] ?? a.ability) : a.ability
  }
})

/** Alterna la megaevolución supuesta de un rival y ajusta su habilidad por defecto. */
function toggleFoeMega(slot: number) {
  const f = sim.fighterAt(opposingSide.value, slot)
  if (!f) return
  foeMega[slot] = !foeMega[slot]
  foeAbility[slot] =
    foeMega[slot] && f.megaForm ? (f.megaForm.abilities[0] ?? f.ability) : f.ability
}

/** Construye las suposiciones activas para el estimador contra un rival concreto. */
function assumptionsFor(defSlot: number): DamageAssumptions {
  const a: DamageAssumptions = {}
  if (previewWeather.value !== 'current') a.weather = previewWeather.value
  if (previewTerrain.value !== 'current') a.terrain = previewTerrain.value
  // Megaevolución planeada: la previsualización usa ya la megaforma (aunque el panel esté cerrado).
  if (megaPlanned.value) a.attMega = true
  if (showAssumptions.value) {
    a.attBoosts = { ...atkBoosts }
    a.attAccStage = atkAccStage.value
    if (atkHelpingHand.value) a.attHelpingHand = true
    if (atkBattery.value) a.attBattery = true
    if (atkPowerSpot.value) a.attPowerSpot = true
    if (atkSteelySpirit.value) a.attSteelySpirit = true
    if (atkAbility.value) a.attAbility = atkAbility.value
    if (foeMega[defSlot]) a.defMega = true
    if (foeBoosts[defSlot]) a.defBoosts = { ...foeBoosts[defSlot] }
    if (foeAbility[defSlot]) a.defAbility = foeAbility[defSlot]
    if (foeEvaStage[defSlot] != null) a.defEvaStage = foeEvaStage[defSlot]
    const sc = foeScreens[defSlot]
    if (sc) {
      a.defReflect = sc.reflect
      a.defLightScreen = sc.lightScreen
      a.defAuroraVeil = sc.auroraVeil
    }
    if (foeFriendGuard[defSlot]) a.defFriendGuard = true
  }
  return a
}

/** Orden por velocidad, reflejando las suposiciones (clima, velocidad, habilidad, mega). */
const speedOrder = computed(() => {
  const w = previewWeather.value === 'current' ? undefined : previewWeather.value
  const side = choosingSide.value
  const oppo = opposingSide.value
  return sim.speedRanking({
    weather: w,
    override: (s, slot) => {
      const move = orderMoves[`${s}:${slot}`] ?? undefined
      if (!showAssumptions.value) return move ? { move } : undefined
      const tw = s === oppo ? foeTailwind.value : atkTailwind.value
      if (s === side && slot === currentSlot.value) {
        return {
          move,
          speedStage: atkBoosts.speed,
          ability: atkAbility.value,
          mon: megaPlanned.value ? (currentActive.value?.megaForm ?? undefined) : undefined,
          tailwind: tw,
        }
      }
      if (s === oppo) {
        return {
          move,
          speedStage: foeBoosts[slot]?.speed,
          ability: foeAbility[slot],
          mon: foeMega[slot] ? (sim.fighterAt(oppo, slot)?.megaForm ?? undefined) : undefined,
          tailwind: tw,
        }
      }
      return { move, tailwind: tw } // aliado compañero: su bando comparte Viento Afín
    },
  })
})

/**
 * Previsualización de un movimiento contra cada rival activo: daño (%) y precisión (%),
 * cada rival con sus propias suposiciones.
 */
function movePreviews(move: ChampionsMove): { name: string; text: string }[] {
  const side = choosingSide.value
  if (!side || currentSlot.value == null) return []
  const oppo = opposingSide.value
  const out: { name: string; text: string }[] = []
  for (const slot of sim.aliveSlots(oppo)) {
    const assume = assumptionsFor(slot)
    const f = sim.fighterAt(oppo, slot)
    if (!f) continue
    const p = sim.estimateDamagePercent(side, currentSlot.value, move, oppo, slot, assume)
    const acc = sim.estimateAccuracy(side, currentSlot.value, move, oppo, slot, assume)
    const parts: string[] = []
    if (p) parts.push(`${p.minPct.toFixed(0)}–${p.maxPct.toFixed(0)}%`)
    if (acc != null) parts.push(`🎯${acc.toFixed(0)}%`)
    if (parts.length) out.push({ name: f.mon.name, text: parts.join(' · ') })
  }
  return out
}

function pickMove(move: ChampionsMove) {
  if (moveDisabled(move)) return
  const mega = canMega.value && megaThisTurn.value
  // Auto-objetivo (uno mismo, área…) o un solo objetivo: no se pide elegir.
  if (autoResolves(move) || targetOptions.value.length <= 1) {
    const first = targetOptions.value[0]
    const target = first ? { side: first.side, slot: first.slot } : { side: opposingSide.value, slot: 0 }
    finalize({ kind: 'move', move, target, mega })
  } else {
    pendingMove.value = move
  }
}
function pickTarget(opt: { side: SideId; slot: number }) {
  if (pendingMove.value) {
    finalize({
      kind: 'move',
      move: pendingMove.value,
      target: { side: opt.side, slot: opt.slot },
      mega: canMega.value && megaThisTurn.value,
    })
  }
}
function pickSwitch(index: number) {
  finalize({ kind: 'switch', index })
}

// Al volver a fase de combate tras un reemplazo, reanuda la selección.
watch(
  () => sim.phase,
  (now, prev) => {
    if (now === 'battle' && prev !== 'battle') beginSelection()
  },
)

/* ---------- Presentación ---------- */
function hpPercent(f: { hp: number; maxHp: number }) {
  return f.maxHp > 0 ? (f.hp / f.maxHp) * 100 : 0
}
function hpColor(pct: number) {
  if (pct > 50) return '#43a047'
  if (pct > 20) return '#fbc02d'
  return '#e53935'
}

const replaceInfo = computed(() => sim.replaceQueue[0] ?? null)

/* --- Navegación por turnos (replay) --- */
const viewIndex = ref(0)
watch(
  () => sim.snapshots.length,
  (len) => {
    viewIndex.value = Math.max(0, len - 1) // seguir al turno en vivo
  },
)
const viewSnapshot = computed(() => sim.snapshots[viewIndex.value] ?? null)
const atLive = computed(() => viewIndex.value >= sim.snapshots.length - 1)
function prevTurn() {
  if (viewIndex.value > 0) viewIndex.value -= 1
}
function nextTurn() {
  if (viewIndex.value < sim.snapshots.length - 1) viewIndex.value += 1
}
function goLive() {
  viewIndex.value = sim.snapshots.length - 1
}
function doCreateBranch() {
  sim.createBranch(viewIndex.value)
  if (sim.phase === 'battle') beginSelection()
}
function doSwitchBranch(id: string) {
  sim.switchBranch(id)
  if (sim.phase === 'battle') beginSelection()
}

const shownLog = computed(() => {
  const len = viewSnapshot.value?.logLen ?? sim.log.length
  return sim.log.slice(0, len).slice().reverse()
})

const weatherLabel = computed(
  () => WEATHER_OPTIONS.find((w) => w.value === (viewSnapshot.value?.weather ?? ''))?.label ?? '',
)
const terrainLabel = computed(
  () => TERRAIN_OPTIONS.find((t) => t.value === (viewSnapshot.value?.terrain ?? ''))?.label ?? '',
)
function hazardText(h?: { stealthRock: boolean; spikes: number; toxicSpikes: number }) {
  if (!h) return ''
  const parts: string[] = []
  if (h.stealthRock) parts.push('Rocas')
  if (h.spikes) parts.push(`Púas ×${h.spikes}`)
  if (h.toxicSpikes) parts.push(`P. Tóxicas ×${h.toxicSpikes}`)
  return parts.join(', ')
}

function newBattle() {
  sim.reset()
  choosingSide.value = null
  slotOrder.value = []
  cursor.value = 0
  picked.value = []
  setupStep.value = 'teams'
  allyPicks.value = []
  enemyPicks.value = []
}
</script>

<template>
  <section class="sim">
    <h1>Simulador de combate</h1>

    <!-- ===================== SETUP ===================== -->
    <template v-if="sim.phase === 'setup'">
      <!-- Paso 1: armar equipos -->
      <template v-if="setupStep === 'teams'">
      <p class="sim__hint">
        Combate por equipos con cambios. Arma cada bando (se comparte con Batalla),
        elige el formato y quién controla al rival. Cada Pokémon necesita
        <strong>movimientos</strong> para atacar: edítalos con «Editar».
      </p>

      <div class="setup__grid">
        <div v-for="side in (['ally', 'enemy'] as Side[])" :key="side" class="setup__col">
          <div class="setup__head">
            <span class="setup__title">{{ side === 'ally' ? 'Tu equipo' : 'Rival' }}</span>
            <div class="setup__actions">
              <select
                class="setup__load"
                :disabled="!library.teams.length"
                @change="loadTeam(side, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
              >
                <option value="">{{ library.teams.length ? 'Cargar equipo…' : 'Sin equipos' }}</option>
                <option v-for="t in library.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <button
                v-if="(side === 'ally' ? battle.ally : battle.enemy).length"
                class="setup__save"
                @click="saveTeam(side)"
              >
                Guardar
              </button>
              <button
                v-if="(side === 'ally' ? battle.ally : battle.enemy).length"
                class="setup__clear"
                @click="battle.clear(side)"
              >
                Vaciar
              </button>
            </div>
          </div>
          <div class="setup__members">
            <div v-for="m in side === 'ally' ? battle.ally : battle.enemy" :key="m.id" class="mini">
              <img :src="m.mon.sprite" :alt="m.mon.name" width="40" height="40" />
              <span>{{ m.mon.name }}</span>
              <span v-if="!m.moves || !m.moves.length" class="mini__warn" title="Sin movimientos">⚠</span>
              <button class="mini__edit" @click="editing = m">Editar</button>
              <button class="mini__del" @click="battle.remove(side, m.id)">✕</button>
            </div>
            <button class="add-btn" @click="pickerFor = side">＋ Añadir Pokémon</button>
          </div>
        </div>
      </div>

      <FieldControls :field="sim.field" />

      <div class="setup__foot">
        <div class="setup__opts">
          <span class="setup__opt-label">Formato:</span>
          <label><input v-model="fmt" type="radio" value="singles" /> Individual (1 vs 1)</label>
          <label><input v-model="fmt" type="radio" value="doubles" /> Doble (2 vs 2)</label>
        </div>
        <label class="setup__ai">
          <input v-model="useAI" type="checkbox" />
          Rival por IA {{ useAI ? '(activada)' : '(manual)' }}
        </label>
        <p v-if="fmt === 'doubles' && !canStart" class="setup__warn">
          ⚠ El combate doble necesita al menos 2 Pokémon por bando.
        </p>
        <p v-else-if="missingMoves" class="setup__warn">
          ⚠ {{ missingMoves }} Pokémon sin movimientos: no podrán atacar.
        </p>
        <button class="start-btn" :disabled="!canStart" @click="goToOrder">
          Siguiente: elegir orden ▸
        </button>
      </div>
      </template>

      <!-- Paso 2: orden de combate -->
      <template v-else>
        <p class="sim__hint">
          Elige qué Pokémon combaten y en qué orden. Los primeros
          {{ minPerTeam }} salen al campo{{ fmt === 'doubles' ? ' (los dos activos)' : '' }}.
        </p>

        <div class="order__grid">
          <div
            v-for="side in (useAI ? ['ally'] : ['ally', 'enemy']) as Side[]"
            :key="side"
            class="order__col"
            :class="side === 'ally' ? 'order__col--ally' : 'order__col--enemy'"
          >
            <div class="order__head">
              <span class="setup__title">{{ side === 'ally' ? 'Tu orden' : 'Orden del rival' }}</span>
              <button class="setup__save" @click="useAllOf(side)">Usar todos</button>
            </div>
            <div class="order__list">
              <button
                v-for="m in side === 'ally' ? battle.ally : battle.enemy"
                :key="m.id"
                class="order-mon"
                :class="{ 'order-mon--on': pickPosition(side, m.id) !== null }"
                @click="togglePick(side, m.id)"
              >
                <span class="order-mon__pos">{{ pickPosition(side, m.id) ?? '·' }}</span>
                <img :src="m.mon.sprite" :alt="m.mon.name" width="40" height="40" />
                <span class="order-mon__name">{{ m.mon.name }}</span>
                <span v-if="!m.moves || !m.moves.length" class="mini__warn" title="Sin movimientos">⚠</span>
              </button>
            </div>
          </div>
        </div>

        <div class="setup__foot">
          <button class="setup__clear" @click="setupStep = 'teams'">◂ Volver</button>
          <button class="start-btn" :disabled="!orderCanStart" @click="startFromOrder">
            Iniciar combate
          </button>
        </div>
      </template>
    </template>

    <!-- ===================== COMBATE ===================== -->
    <template v-else>
      <div v-if="viewSnapshot" class="replaybar">
        <button :disabled="viewIndex === 0" @click="prevTurn">◂</button>
        <span class="replaybar__label">{{ viewSnapshot.label }}</span>
        <button :disabled="atLive" @click="nextTurn">▸</button>
        <button v-if="!atLive" class="replaybar__live" @click="goLive">En vivo ⏭</button>
        <span v-else class="replaybar__tag">En vivo</span>
        <button v-if="!atLive && sim.phase !== 'ended'" class="replaybar__branch" @click="doCreateBranch">
          ⑂ Crear rama aquí
        </button>
        <select
          v-if="sim.branches.length > 1"
          class="replaybar__select"
          :value="sim.currentBranchId"
          @change="doSwitchBranch(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="b in sim.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>

      <div v-if="viewSnapshot" class="arena">
        <div class="arena__side arena__side--ally">
          <template v-for="(s, i) in viewSnapshot.ally" :key="'a' + i">
            <FighterCard v-if="s" :view="s" side="ally" />
          </template>
        </div>

        <div class="arena__vs">VS<br />Turno {{ sim.turn }}</div>

        <div class="arena__side arena__side--enemy">
          <template v-for="(s, i) in viewSnapshot.enemy" :key="'e' + i">
            <FighterCard v-if="s" :view="s" side="enemy" />
          </template>
        </div>
      </div>

      <!-- Estado del campo -->
      <div
        v-if="viewSnapshot && (viewSnapshot.weather || viewSnapshot.terrain || hazardText(viewSnapshot.hazards.ally) || hazardText(viewSnapshot.hazards.enemy))"
        class="fieldinfo"
      >
        <span v-if="viewSnapshot.weather" class="fieldinfo__tag">☁ {{ weatherLabel }}</span>
        <span v-if="viewSnapshot.terrain" class="fieldinfo__tag">🌿 {{ terrainLabel }}</span>
        <span v-if="hazardText(viewSnapshot.hazards.ally)" class="fieldinfo__tag fieldinfo__tag--ally">
          🔵 {{ hazardText(viewSnapshot.hazards.ally) }}
        </span>
        <span v-if="hazardText(viewSnapshot.hazards.enemy)" class="fieldinfo__tag fieldinfo__tag--enemy">
          🔴 {{ hazardText(viewSnapshot.hazards.enemy) }}
        </span>
      </div>

      <p v-if="!atLive" class="replaybar__note">
        Estás viendo un turno anterior. Pulsa «Ir a en vivo» para seguir jugando.
      </p>

      <!-- Panel de acción -->
      <div v-if="atLive && sim.phase === 'battle' && currentActive" class="panel">
        <div class="panel__head">
          <span>{{ panelTitle }}</span>
          <div v-if="!pendingMove" class="panel__tabs">
            <button v-if="canGoBack" class="panel__backbtn" @click="goBack">◂ Anterior</button>
            <label v-if="canMega" class="panel__mega">
              <input v-model="megaThisTurn" type="checkbox" /> Megaevolucionar
            </label>
            <button :class="{ on: panelMode === 'move' }" @click="panelMode = 'move'">Movimientos</button>
            <button :class="{ on: panelMode === 'switch' }" @click="panelMode = 'switch'">Cambiar</button>
          </div>
        </div>

        <!-- Elegir objetivo (dobles) -->
        <div v-if="pendingMove" class="panel__targets">
          <span class="panel__sub">¿A qué objetivo?</span>
          <button
            v-for="opt in targetOptions"
            :key="opt.side + opt.slot"
            class="switch-chip"
            :class="{ 'switch-chip--ally': opt.ally }"
            @click="pickTarget(opt)"
          >
            <img :src="opt.fighter.mon.sprite" :alt="opt.fighter.mon.name" width="36" height="36" />
            <span>{{ opt.fighter.mon.name }}</span>
            <small>{{ opt.ally ? 'aliado' : 'rival' }}</small>
          </button>
          <button class="panel__back" @click="pendingMove = null">← Volver</button>
        </div>

        <!-- Movimientos -->
        <template v-else-if="panelMode === 'move'">
          <div class="assume">
            <div class="assume__bar">
              <label class="assume__weather">
                Clima:
                <select v-model="previewWeather">
                  <option value="current">Actual</option>
                  <option v-for="w in WEATHER_OPTIONS" :key="w.value || 'none'" :value="w.value">
                    {{ w.value ? w.label : 'Sin clima' }}
                  </option>
                </select>
              </label>
              <label class="assume__weather">
                Campo:
                <select v-model="previewTerrain">
                  <option value="current">Actual</option>
                  <option v-for="t in TERRAIN_OPTIONS" :key="t.value || 'none'" :value="t.value">
                    {{ t.value ? t.label : 'Sin campo' }}
                  </option>
                </select>
              </label>
              <button
                type="button"
                class="assume__toggle"
                :class="{ 'assume__toggle--on': showAssumptions }"
                @click="showAssumptions = !showAssumptions"
              >
                Suposiciones {{ showAssumptions ? '▾' : '▸' }}
              </button>
            </div>

            <div v-if="showAssumptions" class="assume__body">
              <!-- Orden de turno (prioridad del movimiento supuesto, luego velocidad) -->
              <div class="assume__order">
                <span class="assume__label">Orden de turno:</span>
                <div class="assume__screens">
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="atkTailwind" /> Viento Afín (tú)
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="foeTailwind" /> Viento Afín (rival)
                  </label>
                </div>
                <div class="assume__turns">
                  <div v-for="(s, i) in speedOrder" :key="s.side + s.slot" class="assume__turnrow">
                    <span class="assume__turnpos">{{ i + 1 }}</span>
                    <span
                      class="assume__speed"
                      :class="s.side === choosingSide ? 'assume__speed--me' : 'assume__speed--foe'"
                    >
                      {{ s.name }}
                    </span>
                    <select
                      class="assume__turnmove"
                      :value="orderMoves[s.side + ':' + s.slot]?.name ?? ''"
                      @change="setOrderMove(s.side, s.slot, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">— sin ataque —</option>
                      <option v-for="mv in movesOf(s.side, s.slot)" :key="mv.name" :value="mv.name">
                        {{ mv.name }}
                      </option>
                    </select>
                    <span class="assume__turninfo">
                      Vel {{ s.speed
                      }}<template v-if="s.priority"> · Prio {{ s.priority > 0 ? '+' : '' }}{{ s.priority }}</template>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Atacante -->
              <div v-if="atkMon" class="assume__block">
                <div class="assume__head">
                  <strong>{{ atkMon.name }}<span v-if="megaPlanned" class="assume__mega">Mega</span></strong>
                  <label>
                    Hab.:
                    <select v-model="atkAbility">
                      <option v-for="ab in atkMon.abilities" :key="ab" :value="ab">{{ ab }}</option>
                    </select>
                  </label>
                </div>
                <div class="assume__boosts">
                  <label v-for="s in BOOST_ORDER" :key="s.key" class="assume__stat">
                    {{ s.short }}
                    <input
                      type="number"
                      min="-6"
                      max="6"
                      v-model.number="atkBoosts[s.key as BoostKey]"
                    />
                  </label>
                  <label class="assume__stat">
                    Prec
                    <input type="number" min="-6" max="6" v-model.number="atkAccStage" />
                  </label>
                </div>
                <div v-if="sim.format === 'doubles'" class="assume__screens">
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="atkHelpingHand" /> Mano Amiga
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="atkBattery" /> Batería
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="atkPowerSpot" /> Punto Poder
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="atkSteelySpirit" /> Alma Acerada
                  </label>
                </div>
              </div>

              <!-- Rival(es): cada uno con sus propias suposiciones -->
              <div
                v-for="fv in foeDisplay"
                v-show="foeBoosts[fv.slot]"
                :key="fv.slot"
                class="assume__block"
              >
                <div class="assume__head">
                  <strong>
                    {{ fv.mon.name }}
                    <span v-if="foeMega[fv.slot]" class="assume__mega">Mega</span>
                    <span v-else class="assume__foe">rival</span>
                  </strong>
                  <div class="assume__head-controls">
                    <label v-if="fv.canMega" class="assume__megachk">
                      <input
                        type="checkbox"
                        :checked="foeMega[fv.slot]"
                        @change="toggleFoeMega(fv.slot)"
                      />
                      Mega
                    </label>
                    <label>
                      Hab.:
                      <select v-model="foeAbility[fv.slot]">
                        <option v-for="ab in fv.mon.abilities" :key="ab" :value="ab">{{ ab }}</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div v-if="foeBoosts[fv.slot]" class="assume__boosts">
                  <label v-for="s in BOOST_ORDER" :key="s.key" class="assume__stat">
                    {{ s.short }}
                    <input
                      type="number"
                      min="-6"
                      max="6"
                      v-model.number="foeBoosts[fv.slot][s.key as BoostKey]"
                    />
                  </label>
                  <label class="assume__stat">
                    Eva
                    <input type="number" min="-6" max="6" v-model.number="foeEvaStage[fv.slot]" />
                  </label>
                </div>
                <div v-if="foeScreens[fv.slot]" class="assume__screens">
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="foeScreens[fv.slot].reflect" /> Reflejo
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="foeScreens[fv.slot].lightScreen" /> Pantalla Luz
                  </label>
                  <label class="assume__screenchk">
                    <input type="checkbox" v-model="foeScreens[fv.slot].auroraVeil" /> Velo Aurora
                  </label>
                  <label v-if="sim.format === 'doubles'" class="assume__screenchk">
                    <input type="checkbox" v-model="foeFriendGuard[fv.slot]" /> Prevención
                  </label>
                </div>
              </div>
              <p class="assume__note">
                Solo afecta a los porcentajes mostrados; no cambia el combate.
              </p>
            </div>
          </div>
          <div class="panel__moves">
          <template v-if="currentActive.build.moves && currentActive.build.moves.length">
            <button
              v-for="mv in currentActive.build.moves"
              :key="mv.name"
              class="mv"
              :disabled="moveDisabled(mv)"
              @click="pickMove(mv)"
            >
              <span class="mv__type" :style="{ backgroundColor: TYPE_COLORS[mv.type] }">{{ TYPE_LABELS[mv.type] }}</span>
              <span class="mv__name">
                {{ mv.name }}
                <small v-for="pv in movePreviews(mv)" :key="pv.name" class="mv__dmg">
                  <template v-if="manyFoes">{{ pv.name }}: </template>{{ pv.text }}
                </small>
              </span>
              <span class="mv__pow">{{ mv.power ?? '—' }}</span>
            </button>
          </template>
          <div v-else class="panel__empty">
            <p>Sin movimientos.</p>
            <button v-if="!benchSlots.length" class="panel__back" @click="skipSlot">Saltar turno</button>
          </div>
          </div>
        </template>

        <!-- Cambiar -->
        <div v-else class="panel__switch">
          <button v-for="bi in benchSlots" :key="bi" class="switch-chip" @click="pickSwitch(bi)">
            <img :src="(choosingSide === 'ally' ? sim.allies : sim.enemies)[bi].mon.sprite" :alt="''" width="36" height="36" />
            <span>{{ (choosingSide === 'ally' ? sim.allies : sim.enemies)[bi].mon.name }}</span>
            <small>{{ (choosingSide === 'ally' ? sim.allies : sim.enemies)[bi].hp }}/{{ (choosingSide === 'ally' ? sim.allies : sim.enemies)[bi].maxHp }}</small>
          </button>
          <p v-if="!benchSlots.length" class="panel__empty">No hay Pokémon a los que cambiar.</p>
        </div>
      </div>

      <!-- Reemplazo forzado -->
      <div v-else-if="atLive && sim.phase === 'replace' && replaceInfo" class="panel">
        <div class="panel__head">
          <span>
            {{ replaceInfo.side === 'ally' ? 'Elige tu siguiente Pokémon' : 'Elige el relevo del rival' }}
          </span>
        </div>
        <div class="panel__switch">
          <button
            v-for="bi in sim.benchAlive(replaceInfo.side)"
            :key="bi"
            class="switch-chip"
            @click="sim.resolveReplace(bi)"
          >
            <img :src="(replaceInfo.side === 'ally' ? sim.allies : sim.enemies)[bi].mon.sprite" :alt="''" width="36" height="36" />
            <span>{{ (replaceInfo.side === 'ally' ? sim.allies : sim.enemies)[bi].mon.name }}</span>
            <small>{{ (replaceInfo.side === 'ally' ? sim.allies : sim.enemies)[bi].hp }}/{{ (replaceInfo.side === 'ally' ? sim.allies : sim.enemies)[bi].maxHp }}</small>
          </button>
        </div>
      </div>

      <!-- Fin -->
      <div v-else-if="sim.phase === 'ended'" class="panel panel--end">
        <strong>{{ sim.winner === 'ally' ? '🏆 ¡Victoria!' : 'Derrota…' }}</strong>
        <button class="start-btn" @click="newBattle">Nuevo combate</button>
      </div>

      <div class="log">
        <p v-for="(line, i) in shownLog" :key="shownLog.length - i">{{ line }}</p>
      </div>

      <button v-if="sim.phase !== 'ended'" class="sim__reset" @click="newBattle">Terminar combate</button>
    </template>

    <PokemonPicker
      v-if="pickerFor"
      :title="pickerFor === 'ally' ? 'Añadir a tu equipo' : 'Añadir al rival'"
      @select="onPickMon"
      @select-build="onPickBuild"
      @close="pickerFor = null"
    />

    <BuildEditor v-if="editing" :build="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.sim__hint {
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

/* Setup */
.setup__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.setup__col {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.8rem;
  background: var(--color-surface);
}

.setup__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.setup__title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.setup__actions {
  display: flex;
  gap: 0.35rem;
}

.setup__load {
  padding: 0.3rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.75rem;
}

.setup__save,
.setup__clear {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.72rem;
}

.setup__save:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.setup__members {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mini {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
}

.mini img {
  image-rendering: pixelated;
}

.mini span {
  font-size: 0.82rem;
  font-weight: 600;
  flex: 1;
}

.mini__warn {
  color: #e0a020;
}

.mini__edit {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
}

.mini__edit:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.mini__del {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.mini__del:hover {
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

.setup__foot {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}

.setup__opts {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.setup__opt-label {
  font-weight: 700;
  font-size: 0.85rem;
}

.setup__opts label,
.setup__ai {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  cursor: pointer;
}

.setup__warn {
  color: #e0a020;
  font-size: 0.85rem;
  margin: 0;
}

.start-btn {
  padding: 0.7rem 1.6rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Orden de combate */
.order__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.order__col {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.8rem;
  background: var(--color-surface);
}

.order__col--ally {
  border-top: 3px solid #4a7fc0;
}
.order__col--enemy {
  border-top: 3px solid #e05a4a;
}

.order__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.order__list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.order-mon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.order-mon:hover {
  border-color: var(--color-accent);
}

.order-mon--on {
  border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.order-mon__pos {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 700;
}

.order-mon--on .order-mon__pos {
  background: var(--color-accent);
  color: #fff;
}

.order-mon img {
  image-rendering: pixelated;
}

.order-mon__name {
  font-size: 0.82rem;
  font-weight: 600;
  flex: 1;
}

/* Replay */
.replaybar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.replaybar button {
  min-width: 34px;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-weight: 600;
}

.replaybar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.replaybar__label {
  font-weight: 700;
  min-width: 80px;
  text-align: center;
}

.replaybar__live {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}

.replaybar__tag {
  font-size: 0.78rem;
  font-weight: 700;
  color: #43a047;
}

.replaybar__branch {
  border-color: #b8860b !important;
  color: #b8860b !important;
}

.replaybar__select {
  margin-left: auto;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.replaybar__note {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0 0 1rem;
}

.fighter--fainted {
  opacity: 0.5;
}

/* Arena */
.arena {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.arena__side {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.fighter {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.7rem;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fighter--ally {
  border-top: 3px solid #4a7fc0;
}
.fighter--enemy {
  border-top: 3px solid #e05a4a;
}

.fighter--enemy img {
  align-self: flex-end;
}

.fighter__info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.fighter__hp-text {
  font-size: 0.76rem;
  color: var(--color-text-muted);
}

.fighter img {
  image-rendering: pixelated;
}

.hpbar {
  height: 9px;
  border-radius: 6px;
  background: var(--color-border);
  overflow: hidden;
}

.hpbar__fill {
  height: 100%;
  transition:
    width 0.35s ease,
    background 0.35s ease;
}

.arena__vs {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: center;
  padding-top: 1.5rem;
}

/* Estado del campo */
.fieldinfo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.fieldinfo__tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.fieldinfo__tag--ally {
  border-color: #4a7fc0;
}
.fieldinfo__tag--enemy {
  border-color: #e05a4a;
}

/* Panel */
.panel {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.9rem;
  background: var(--color-surface);
  margin-bottom: 1rem;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
  font-weight: 600;
  flex-wrap: wrap;
}

.panel__tabs {
  display: flex;
  gap: 0.3rem;
}

.panel__tabs button {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
}

.panel__tabs button.on {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.panel__mega {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #b8860b;
  cursor: pointer;
  white-space: nowrap;
}

.panel__backbtn {
  border-color: var(--color-text-muted) !important;
}

.panel__sub {
  display: block;
  width: 100%;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.assume {
  margin-bottom: 0.6rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.assume__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.assume__bar .assume__toggle {
  margin-left: auto;
}

.assume__weather {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.assume select,
.assume input {
  padding: 0.15rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.76rem;
}

.assume__toggle {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
}

.assume__toggle--on {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.assume__body {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--color-bg);
}

.assume__order {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.assume__turns {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.assume__turnrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.assume__turnpos {
  font-weight: 700;
  min-width: 1.1rem;
  text-align: center;
}

.assume__turnmove {
  max-width: 11rem;
}

.assume__turninfo {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.assume__label {
  font-weight: 600;
}

.assume__speed {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.assume__speed--me {
  background: rgba(74, 127, 192, 0.18);
  color: #2b5f9e;
}

.assume__speed--foe {
  background: rgba(224, 90, 74, 0.18);
  color: #b03a2e;
}

.assume__block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.assume__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.assume__head label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.assume__head-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.assume__megachk {
  cursor: pointer;
  font-size: 0.74rem;
}

.assume__screens {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.assume__screenchk {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  font-size: 0.72rem;
}

.assume__mega {
  margin-left: 0.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  background: linear-gradient(135deg, #7b4fbf, #b45fd6);
  color: #fff;
  vertical-align: middle;
}

.assume__foe {
  padding: 0.02rem 0.3rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  background: rgba(224, 90, 74, 0.18);
  color: #b03a2e;
  vertical-align: middle;
}

.assume__boosts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.assume__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  font-size: 0.68rem;
}

.assume__stat input {
  width: 3rem;
  text-align: center;
}

.assume__note {
  margin: 0;
  font-size: 0.7rem;
  font-style: italic;
  opacity: 0.8;
}

.panel__moves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.mv {
  display: grid;
  grid-template-columns: 52px 1fr 32px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.mv:hover {
  border-color: var(--color-accent);
}

.mv:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mv__type {
  font-size: 0.6rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  padding: 0.12rem 0;
  border-radius: 999px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
}

.mv__name {
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
}

.mv__dmg {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-accent);
}

.mv__pow {
  font-size: 0.8rem;
  font-weight: 700;
  text-align: right;
}

.panel__switch,
.panel__targets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.5rem;
}

.switch-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.switch-chip:hover {
  border-color: var(--color-accent);
}

.switch-chip--ally {
  border-color: #4a7fc0;
}

.switch-chip img {
  image-rendering: pixelated;
}

.switch-chip span {
  font-size: 0.78rem;
  font-weight: 600;
}

.switch-chip small {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.panel__back {
  grid-column: 1 / -1;
  justify-self: start;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.panel__empty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.panel--end {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 1.2rem;
}

.log {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  background: var(--color-bg);
  margin-bottom: 1rem;
}

.log p {
  margin: 0 0 0.3rem;
  font-size: 0.83rem;
  line-height: 1.4;
}

.log p:first-child {
  font-weight: 700;
}

.sim__reset {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.sim__reset:hover {
  border-color: #e53935;
  color: #e53935;
}

@media (max-width: 720px) {
  .setup__grid,
  .arena,
  .panel__moves {
    grid-template-columns: 1fr;
  }
}
</style>

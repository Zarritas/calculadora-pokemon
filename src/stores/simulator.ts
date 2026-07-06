import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type {
  BoostKey,
  BoostSpread,
  ChampionsMon,
  ChampionsMove,
  FieldState,
  PokemonType,
  StatusCondition,
  Terrain,
  Weather,
} from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { combatantStats, runCalc, type Combatant } from '@/services/damageEngine'
import { chooseAiActions } from '@/services/battleAI'
import { getMoveEffect, type AccEvaChanges, type BoostChanges } from '@/services/moveEffects'
import { getRoster } from '@/services/championsData'
import { findMegaForm } from '@/services/mega'
import { newId } from '@/services/storage'
import { BOOST_MAX, zeroBoosts } from '@/utils/champions'
import { defaultField } from '@/utils/field'
import { typeEffectiveness } from '@/utils/typeChart'

/** Combatiente en el estado de combate (HP, estado, forma y objeto mutables). */
export interface Fighter {
  build: SavedBuild
  /** Forma actual (cambia al megaevolucionar). */
  mon: ChampionsMon
  /** Habilidad actual (cambia al megaevolucionar). */
  ability: string
  /** Megaforma disponible si lleva la piedra adecuada. */
  megaForm: ChampionsMon | null
  megaEvolved: boolean
  maxHp: number
  hp: number
  status: StatusCondition
  boosts: BoostSpread
  toxicCounter: number
  /** Turnos que lleva dormido (Champions: seguro T1, 33% T2, seguro T3). */
  sleepTurns: number
  /** Turnos que lleva congelado (Champions: 25%/turno, seguro T3). */
  freezeTurns: number
  fainted: boolean
  /** El objeto sigue disponible (no consumido). */
  itemActive: boolean
  /** Etapas de precisión y evasión (−6..+6). */
  accStage: number
  evaStage: number
  /** Se está protegiendo este turno. */
  protecting: boolean
  /** Tipo de protección activa (para el efecto sobre quien hace contacto). */
  protectKind: string | null
  /** Usos consecutivos de protección (reduce la probabilidad). */
  protectStreak: number
  /** Movimiento al que le obliga un objeto Elección (Choice). */
  lockedMove: string | null
  /** Movimiento de carga en curso (golpea el próximo turno). */
  chargingMove: ChampionsMove | null
  /** Debe recargar este turno (no puede actuar). */
  mustRecharge: boolean
  /** Turnos de acción que lleva activo (0 = su primer turno para actuar). */
  turnsActive: number
  /** Ha entrado a mitad de este turno (cambio/relevo): aún no ha tenido su turno. */
  enteredThisTurn: boolean
  /** Retroceso: no se mueve este turno si aún no actuó. */
  flinched: boolean
  /** Usó Respiro este turno: pierde el tipo Volador hasta el fin del turno. */
  roosted: boolean
  /** Tipos forzados (Anegar → Agua; Maldición Silvana → +Planta). null = los suyos. */
  typeOverride: PokemonType[] | null
  /** Aterrizado a la fuerza (Buenazo): recibe Tierra aunque sea Volador. */
  smackedDown: boolean
  /** Arraigado (Arraigo): aterrizado y se cura cada turno. */
  ingrained: boolean
  /** Turnos de Levitón restantes: inmune a Tierra mientras > 0. */
  magnetRise: number
  /** Afectado por Salazón (Salt Cure): daño residual cada turno. */
  saltCure: boolean
  /** Nº de veces que ha recibido daño (para Rage Fist). Se reinicia al cambiar. */
  timesHit: number
  /** Usó Aguante este turno: sobrevive con 1 PS a un golpe letal. */
  enduring: boolean
  /** Afectado por Drenadoras (Leech Seed): pierde PS cada turno hacia el rival. */
  leechSeed: boolean
  /* --- Volátiles de restricción de movimientos --- */
  /** Nombre del último movimiento que ejecutó (para Anulación/Bis/Tormento). */
  lastMove: string | null
  /** Turnos de Mofa restantes: no puede usar movimientos de estado. */
  taunt: number
  /** Movimiento anulado (Anulación) y turnos restantes. */
  disableMove: string | null
  disableTurns: number
  /** Movimiento forzado por Bis (Encore) y turnos restantes. */
  encoreMove: string | null
  encoreTurns: number
  /** Tormento: no puede repetir el mismo movimiento dos turnos seguidos. */
  torment: boolean
}

/** Suposiciones hipotéticas para la previsualización de daño (no afectan al combate). */
export interface DamageAssumptions {
  weather?: Weather
  terrain?: Terrain
  /** Suponer al atacante ya megaevolucionado (usa la megaforma: stats/tipos/habilidad). */
  attMega?: boolean
  attBoosts?: BoostSpread
  attAbility?: string
  /** Etapa de precisión (−6..+6) supuesta del atacante. */
  attAccStage?: number
  /** Apoyo del aliado del atacante (dobles). */
  attHelpingHand?: boolean
  attBattery?: boolean
  attPowerSpot?: boolean
  attSteelySpirit?: boolean
  /** Suponer al rival ya megaevolucionado (usa su megaforma: stats/tipos/habilidad). */
  defMega?: boolean
  defBoosts?: BoostSpread
  defAbility?: string
  /** Etapa de evasión (−6..+6) supuesta del rival. */
  defEvaStage?: number
  /** Pantallas supuestas del lado del rival (reducen el daño recibido). */
  defReflect?: boolean
  defLightScreen?: boolean
  defAuroraVeil?: boolean
  /** Prevención (Friend Guard) del aliado del rival: reduce el daño recibido ×0.75. */
  defFriendGuard?: boolean
}

/** Movimientos que solo pueden usarse el primer turno tras entrar. */
const FIRST_TURN_ONLY = new Set(['Fake Out', 'First Impression'])

/** Movimientos de daño que rompen las pantallas del rival antes de golpear. */
const BREAKS_SCREENS = new Set(['Brick Break', 'Psychic Fangs', 'Raging Bull'])

/** Movimientos con fase semiinvulnerable: mientras cargan, la mayoría de ataques fallan. */
const SEMI_INVULN: Record<string, 'fly' | 'dig' | 'dive' | 'vanish'> = {
  Fly: 'fly',
  Bounce: 'fly',
  'Sky Drop': 'fly',
  Dig: 'dig',
  Dive: 'dive',
  'Phantom Force': 'vanish',
  'Shadow Force': 'vanish',
}
/** Movimientos que SÍ golpean a un objetivo en cada fase semiinvulnerable. */
const HITS_THROUGH_INVULN: Record<string, Set<string>> = {
  fly: new Set(['Gust', 'Twister', 'Thunder', 'Hurricane', 'Sky Uppercut', 'Smack Down']),
  dig: new Set(['Earthquake', 'Magnitude', 'Fissure']),
  dive: new Set(['Surf', 'Whirlpool']),
  vanish: new Set(), // Fuerza/Golpe Fantasma: nada golpea
}
/** Movimientos que además hacen el doble a un objetivo semiinvulnerable. */
const DOUBLE_VS_INVULN: Record<string, Set<string>> = {
  fly: new Set(['Gust', 'Twister']),
  dig: new Set(['Earthquake', 'Magnitude']),
  dive: new Set(['Surf', 'Whirlpool']),
}

/** Movimientos de estado que fuerzan el cambio del rival (sacan a otro del banquillo). */
const FORCE_SWITCH_STATUS = new Set(['Roar', 'Whirlwind'])
/** Movimientos de daño que fuerzan el cambio del rival tras golpear. */
const FORCE_SWITCH_DAMAGE = new Set(['Dragon Tail', 'Circle Throw'])

/** Movimientos que ignoran las protecciones (propias y de bando) y las levantan. */
const IGNORES_PROTECT = new Set([
  'Feint',
  'Hyperspace Hole',
  'Hyperspace Fury',
  'Phantom Force',
  'Shadow Force',
])

/** Campos de peligro por bando. */
interface Hazards {
  stealthRock: boolean
  spikes: number
  toxicSpikes: number
}

/** Pantallas de un bando (turnos restantes; 0 = inactiva). */
interface Screens {
  reflect: number
  lightScreen: number
  auroraVeil: number
}

/** Vista de un combatiente activo para el replay. */
export interface SlotView {
  name: string
  sprite: string
  spriteBase: string
  hp: number
  maxHp: number
  fainted: boolean
  status: StatusCondition
  ability: string
  boosts: BoostSpread
  accStage: number
  evaStage: number
  item: string | null
  itemActive: boolean
}

/** Instantánea del estado tras un turno (para navegar el combate). */
export interface TurnSnapshot {
  label: string
  ally: (SlotView | null)[]
  enemy: (SlotView | null)[]
  weather: Weather
  terrain: Terrain
  gravity: number
  trickRoom: number
  hazards: { ally: Hazards; enemy: Hazards }
  /** Longitud del registro hasta este punto. */
  logLen: number
}

/** Estado completo del combate tras un turno (para restaurar y bifurcar). */
export interface FullState {
  label: string
  allies: Fighter[]
  enemies: Fighter[]
  allyActives: (number | null)[]
  enemyActives: (number | null)[]
  weather: Weather
  weatherTurns: number
  terrain: Terrain
  terrainTurns: number
  gravity: number
  trickRoom: number
  hazards: { ally: Hazards; enemy: Hazards }
  screens: { ally: Screens; enemy: Screens }
  tailwind: { ally: number; enemy: number }
  safeguard: { ally: number; enemy: number }
  megaUsed: { ally: boolean; enemy: boolean }
  turn: number
  log: string[]
  phase: Phase
  winner: SideId | null
  replaceQueue: { side: SideId; slot: number }[]
}

/** Una línea alternativa del combate (secuencia de estados por turno). */
export interface Branch {
  id: string
  name: string
  states: FullState[]
}

type Phase = 'setup' | 'battle' | 'replace' | 'ended'
function emptyHazards(): Hazards {
  return { stealthRock: false, spikes: 0, toxicSpikes: 0 }
}

/** Habilidades que invocan terreno al entrar. */
const TERRAIN_ABILITY: Record<string, Terrain> = {
  'Electric Surge': 'Electric',
  'Grassy Surge': 'Grassy',
  'Psychic Surge': 'Psychic',
  'Misty Surge': 'Misty',
}

export type BattleFormat = 'singles' | 'doubles'
export type SideId = 'ally' | 'enemy'

/**
 * Dificultad de la IA rival.
 * - `easy`: IA voraz de 1 turno (elige el golpe de mayor daño).
 * - `normal`: expectiminimax de profundidad 1.
 * - `hard`: expectiminimax de profundidad 2.
 */
export type Difficulty = 'easy' | 'normal' | 'hard'

/** Objetivo de un movimiento: bando y slot (permite apuntar al aliado). */
export interface MoveTarget {
  side: SideId
  slot: number
}

export type Action =
  | { kind: 'move'; move: ChampionsMove; target: MoveTarget; mega?: boolean }
  | { kind: 'switch'; index: number }
  | { kind: 'recharge' }

export interface SlotAction {
  slot: number
  action: Action
}

/** Habilidades que invocan clima al entrar. */
const WEATHER_ABILITY: Record<string, Weather> = {
  Drought: 'Sun',
  Drizzle: 'Rain',
  'Sand Stream': 'Sand',
  'Snow Warning': 'Snow',
}

/** Bayas que reducen a la mitad un golpe supereficaz del tipo indicado (el daño lo
 * amortigua @smogon/calc; aquí solo se consume la baya tras activarse). */
const RESIST_BERRY: Record<string, PokemonType> = {
  'Occa Berry': 'fire',
  'Passho Berry': 'water',
  'Wacan Berry': 'electric',
  'Rindo Berry': 'grass',
  'Yache Berry': 'ice',
  'Chople Berry': 'fighting',
  'Kebia Berry': 'poison',
  'Shuca Berry': 'ground',
  'Coba Berry': 'flying',
  'Payapa Berry': 'psychic',
  'Tanga Berry': 'bug',
  'Charti Berry': 'rock',
  'Kasib Berry': 'ghost',
  'Haban Berry': 'dragon',
  'Colbur Berry': 'dark',
  'Babiri Berry': 'steel',
  'Chilan Berry': 'normal', // amortigua cualquier golpe Normal, no solo supereficaz
  'Roseli Berry': 'fairy',
}

/** Bayas que curan el estado recién infligido (Zreza cura cualquiera). */
const STATUS_BERRY: Record<string, StatusCondition | 'any'> = {
  'Lum Berry': 'any',
  'Cheri Berry': 'par',
  'Chesto Berry': 'slp',
  'Pecha Berry': 'psn',
  'Rawst Berry': 'brn',
  'Aspear Berry': 'frz',
}

/** Objeto que prolonga cada clima a 8 turnos (si lo lleva quien lo invoca). */
const WEATHER_ROCK: Partial<Record<Weather, string>> = {
  Sun: 'Heat Rock',
  Rain: 'Damp Rock',
  Sand: 'Smooth Rock',
  Snow: 'Icy Rock',
}

const STATUS_TEXT: Record<StatusCondition, string> = {
  '': '',
  brn: 'quemadura',
  par: 'parálisis',
  psn: 'veneno',
  tox: 'veneno grave',
  slp: 'sueño',
  frz: 'congelación',
}

const STAT_TEXT: Record<BoostKey, string> = {
  attack: 'Ataque',
  defense: 'Defensa',
  spAttack: 'At. Esp.',
  spDefense: 'Def. Esp.',
  speed: 'Velocidad',
}

/**
 * Tipos "efectivos" del combatiente: parte de sus tipos (o los forzados por
 * Anegar/Maldición Silvana) y, si usó Respiro, le quita el Volador ese turno
 * (Volador puro → Normal).
 */
function effectiveTypes(f: Fighter): PokemonType[] {
  const base = f.typeOverride ?? f.mon.types
  if (!f.roosted || !base.includes('flying')) return base
  const rest = base.filter((t) => t !== 'flying')
  return rest.length ? rest : ['normal']
}

function combatantFrom(f: Fighter): Combatant {
  const et = effectiveTypes(f)
  const mon = et === f.mon.types ? f.mon : { ...f.mon, types: et }
  return {
    mon,
    build: f.build.build,
    item: f.itemActive ? f.build.item : null,
    status: f.status,
    ability: f.ability,
    boosts: f.boosts,
    curHP: f.hp,
  }
}

/** Habilidades que duplican la velocidad bajo cierto clima. */
const SPEED_WEATHER: Record<string, Weather> = {
  'Swift Swim': 'Rain',
  Chlorophyll: 'Sun',
  'Sand Rush': 'Sand',
  'Slush Rush': 'Snow',
}

/** Habilidades que absorben un tipo (curan, suben stat o solo anulan). */
const ABSORB: Record<string, { type: PokemonType; heal?: number; boost?: BoostChanges }> = {
  'Water Absorb': { type: 'water', heal: 0.25 },
  'Dry Skin': { type: 'water', heal: 0.25 },
  'Volt Absorb': { type: 'electric', heal: 0.25 },
  'Storm Drain': { type: 'water', boost: { spAttack: 1 } },
  'Lightning Rod': { type: 'electric', boost: { spAttack: 1 } },
  'Motor Drive': { type: 'electric', boost: { speed: 1 } },
  'Sap Sipper': { type: 'grass', boost: { attack: 1 } },
  'Flash Fire': { type: 'fire' },
}

/** Habilidades que atraen (redirigen) los movimientos de un tipo en dobles. */
const REDIRECT: Record<string, PokemonType> = {
  'Lightning Rod': 'electric',
  'Storm Drain': 'water',
}

function makeFighter(build: SavedBuild): Fighter {
  const stats = combatantStats({
    mon: build.mon,
    build: build.build,
    item: build.item,
    status: build.status,
    ability: build.ability,
  })
  return {
    build,
    mon: build.mon,
    ability: build.ability || build.mon.abilities[0] || '',
    megaForm: null,
    megaEvolved: false,
    maxHp: stats.hp,
    hp: stats.hp,
    status: build.status,
    boosts: build.boosts ? { ...build.boosts } : zeroBoosts(),
    toxicCounter: 0,
    sleepTurns: 0,
    freezeTurns: 0,
    fainted: false,
    itemActive: !!build.item,
    accStage: 0,
    evaStage: 0,
    protecting: false,
    protectKind: null,
    protectStreak: 0,
    lockedMove: null,
    chargingMove: null,
    mustRecharge: false,
    turnsActive: 0,
    enteredThisTurn: false,
    flinched: false,
    roosted: false,
    typeOverride: null,
    smackedDown: false,
    ingrained: false,
    magnetRise: 0,
    saltCure: false,
    timesHit: 0,
    enduring: false,
    leechSeed: false,
    lastMove: null,
    taunt: 0,
    disableMove: null,
    disableTurns: 0,
    encoreMove: null,
    encoreTurns: 0,
    torment: false,
  }
}

/** Objetos de tipo Elección (bloquean al primer movimiento usado). */
const CHOICE_ITEMS = new Set(['Choice Band', 'Choice Specs', 'Choice Scarf'])

/** Habilidades que quitan vida al atacante por contacto (fracción del máximo). */
const CONTACT_DAMAGE: Record<string, number> = {
  'Rough Skin': 8,
  'Iron Barbs': 8,
}

/** Habilidades que infligen estado al atacante por contacto (30%). */
const CONTACT_STATUS: Record<string, StatusCondition> = {
  'Flame Body': 'brn',
  Static: 'par',
  'Poison Point': 'psn',
}

function boostMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

/** Multiplicador de etapa de precisión/evasión (base 3). */
function accMult(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage)
}

/**
 * ¿El Pokémon pisa el suelo? (afecta a Tierra, púas y terreno).
 * Aterrizan: Gravedad, Buenazo (smackedDown), Arraigo (ingrained). Levitan:
 * Levitón (magnetRise), tipo Volador (salvo Respiro) y la habilidad Levitación.
 */
function isGrounded(f: Fighter, gravity = false): boolean {
  if (gravity || f.smackedDown || f.ingrained) return true
  if (f.magnetRise > 0) return false
  const flying = effectiveTypes(f).includes('flying')
  return !flying && f.ability !== 'Levitate' && f.ability !== 'Eelevate'
}

/** ¿Es inmune a un estado por su tipo? (reglas comunes de gen 6+). */
function immuneToStatus(types: PokemonType[], status: StatusCondition): boolean {
  if (status === 'brn') return types.includes('fire')
  if (status === 'frz') return types.includes('ice')
  if (status === 'par') return types.includes('electric')
  if (status === 'psn' || status === 'tox') return types.includes('poison') || types.includes('steel')
  return false
}

export const useSimulatorStore = defineStore('simulator', () => {
  const format = ref<BattleFormat>('singles')
  const activeCount = computed(() => (format.value === 'doubles' ? 2 : 1))

  const allies = ref<Fighter[]>([])
  const enemies = ref<Fighter[]>([])
  const allyActives = ref<(number | null)[]>([])
  const enemyActives = ref<(number | null)[]>([])

  const field = reactive<FieldState>(defaultField())
  const weather = ref<Weather>('')
  const weatherTurns = ref(0) // -1 = permanente
  const terrain = ref<Terrain>('')
  const terrainTurns = ref(0)
  /** Turnos de Gravedad restantes (0 = inactiva). Aterriza a todos. */
  const gravity = ref(0)
  /** Turnos de Espacio Raro restantes (0 = inactivo). Invierte el orden de velocidad. */
  const trickRoom = ref(0)
  const hazards = reactive<Record<SideId, Hazards>>({ ally: emptyHazards(), enemy: emptyHazards() })
  /** Protecciones de bando activas este turno (Vasta Guardia, Anticipo, Escudo Áureo, Escudo Tatami). */
  interface SideGuards {
    wide: boolean
    quick: boolean
    crafty: boolean
    mat: boolean
  }
  const emptyGuards = (): SideGuards => ({ wide: false, quick: false, crafty: false, mat: false })
  const sideGuard = reactive<Record<SideId, SideGuards>>({ ally: emptyGuards(), enemy: emptyGuards() })
  const emptyScreens = (): Screens => ({ reflect: 0, lightScreen: 0, auroraVeil: 0 })
  const screens = reactive<Record<SideId, Screens>>({ ally: emptyScreens(), enemy: emptyScreens() })
  /** Viento Afín por bando (turnos restantes; dobla la velocidad). */
  const tailwind = reactive<Record<SideId, number>>({ ally: 0, enemy: 0 })
  /** Refugio por bando (turnos restantes): bloquea los estados alterados. */
  const safeguard = reactive<Record<SideId, number>>({ ally: 0, enemy: 0 })
  const log = ref<string[]>([])
  const turn = ref(0)
  const phase = ref<Phase>('setup')
  const winner = ref<SideId | null>(null)
  const aiEnabled = ref(true)
  const difficulty = ref<Difficulty>('easy')
  /** La IA está calculando su jugada (para mostrar "pensando…" en la UI). */
  const aiThinking = ref(false)
  const replaceQueue = ref<{ side: SideId; slot: number }[]>([])
  /** Cada bando puede megaevolucionar una vez por combate. */
  const megaUsed = reactive<Record<SideId, boolean>>({ ally: false, enemy: false })
  /** Ramas del combate (líneas alternativas); cada una con sus estados por turno. */
  const branches = ref<Branch[]>([])
  const currentBranchId = ref('')
  const currentBranch = computed(() => branches.value.find((b) => b.id === currentBranchId.value) ?? null)

  function teamOf(side: SideId) {
    return side === 'ally' ? allies : enemies
  }
  function activesOf(side: SideId) {
    return side === 'ally' ? allyActives : enemyActives
  }
  function fighterAt(side: SideId, slot: number): Fighter | null {
    const idx = activesOf(side).value[slot]
    return idx == null ? null : teamOf(side).value[idx]
  }
  function aliveSlots(side: SideId): number[] {
    const out: number[] = []
    activesOf(side).value.forEach((idx, slot) => {
      if (idx != null && !teamOf(side).value[idx].fainted) out.push(slot)
    })
    return out
  }
  /** Bando al que pertenece un combatiente activo. */
  function sideOfFighter(f: Fighter): SideId {
    return allyActives.value.some((idx) => idx != null && allies.value[idx] === f) ? 'ally' : 'enemy'
  }
  function benchAlive(side: SideId): number[] {
    const actives = activesOf(side).value
    return teamOf(side)
      .value.map((_, i) => i)
      .filter((i) => !teamOf(side).value[i].fainted && !actives.includes(i))
  }
  /** En modo silencioso (simulaciones de la IA) no se escribe en el registro. */
  let silent = false
  function push(msg: string) {
    if (silent) return
    log.value.push(msg)
  }
  function nameOf(f: Fighter) {
    return f.mon.name
  }

  const cloneState = <T>(x: T): T => JSON.parse(JSON.stringify(x))

  function slotViewsFrom(fighters: Fighter[], actives: (number | null)[]): (SlotView | null)[] {
    return actives.map((idx) => {
      if (idx == null) return null
      const f = fighters[idx]
      return {
        name: f.mon.name,
        sprite: f.mon.sprite,
        spriteBase: f.mon.spriteBase ?? f.mon.sprite,
        hp: f.hp,
        maxHp: f.maxHp,
        fainted: f.fainted,
        status: f.status,
        ability: f.ability,
        boosts: { ...f.boosts },
        accStage: f.accStage,
        evaStage: f.evaStage,
        item: f.build.item,
        itemActive: f.itemActive,
      }
    })
  }

  /** Vista (para el replay) derivada de un estado completo. */
  function snapshotView(s: FullState): TurnSnapshot {
    return {
      label: s.label,
      ally: slotViewsFrom(s.allies, s.allyActives),
      enemy: slotViewsFrom(s.enemies, s.enemyActives),
      weather: s.weather,
      terrain: s.terrain,
      gravity: s.gravity ?? 0,
      trickRoom: s.trickRoom ?? 0,
      hazards: s.hazards,
      logLen: s.log.length,
    }
  }

  /** Vistas por turno de la rama actual (para navegar el replay). */
  const snapshots = computed<TurnSnapshot[]>(() =>
    currentBranch.value ? currentBranch.value.states.map(snapshotView) : [],
  )

  function captureFullState(label: string): FullState {
    return cloneState({
      label,
      allies: allies.value,
      enemies: enemies.value,
      allyActives: allyActives.value,
      enemyActives: enemyActives.value,
      weather: weather.value,
      weatherTurns: weatherTurns.value,
      terrain: terrain.value,
      terrainTurns: terrainTurns.value,
      gravity: gravity.value,
      trickRoom: trickRoom.value,
      hazards: { ally: hazards.ally, enemy: hazards.enemy },
      screens: { ally: screens.ally, enemy: screens.enemy },
      tailwind: { ally: tailwind.ally, enemy: tailwind.enemy },
      safeguard: { ally: safeguard.ally, enemy: safeguard.enemy },
      megaUsed: { ally: megaUsed.ally, enemy: megaUsed.enemy },
      turn: turn.value,
      log: log.value,
      phase: phase.value,
      winner: winner.value,
      replaceQueue: replaceQueue.value,
    }) as FullState
  }

  function restoreFullState(s: FullState) {
    const c = cloneState(s)
    allies.value = c.allies
    enemies.value = c.enemies
    allyActives.value = c.allyActives
    enemyActives.value = c.enemyActives
    weather.value = c.weather
    weatherTurns.value = c.weatherTurns
    terrain.value = c.terrain
    terrainTurns.value = c.terrainTurns
    gravity.value = c.gravity ?? 0
    trickRoom.value = c.trickRoom ?? 0
    hazards.ally = c.hazards.ally
    hazards.enemy = c.hazards.enemy
    screens.ally = c.screens?.ally ?? emptyScreens()
    screens.enemy = c.screens?.enemy ?? emptyScreens()
    tailwind.ally = c.tailwind?.ally ?? 0
    tailwind.enemy = c.tailwind?.enemy ?? 0
    safeguard.ally = c.safeguard?.ally ?? 0
    safeguard.enemy = c.safeguard?.enemy ?? 0
    megaUsed.ally = c.megaUsed.ally
    megaUsed.enemy = c.megaUsed.enemy
    turn.value = c.turn
    log.value = c.log
    phase.value = c.phase
    winner.value = c.winner
    replaceQueue.value = c.replaceQueue
  }

  /** Crea una rama alternativa desde el turno indicado de la rama actual. */
  function createBranch(turnIndex: number) {
    const src = currentBranch.value
    if (!src) return
    const base = src.states.slice(0, turnIndex + 1).map((st) => cloneState(st))
    if (!base.length) return
    const branch: Branch = { id: newId(), name: `Rama ${branches.value.length}`, states: base }
    branches.value.push(branch)
    currentBranchId.value = branch.id
    restoreFullState(base[base.length - 1])
    clearAiPrefetch()
  }

  /** Cambia a otra rama (restaura su último estado). */
  function switchBranch(id: string) {
    const b = branches.value.find((x) => x.id === id)
    if (!b) return
    currentBranchId.value = id
    restoreFullState(b.states[b.states.length - 1])
    clearAiPrefetch()
  }

  const allyFighters = computed(() =>
    allyActives.value.map((idx, slot) => ({ slot, fighter: idx == null ? null : allies.value[idx] })),
  )
  const enemyFighters = computed(() =>
    enemyActives.value.map((idx, slot) => ({ slot, fighter: idx == null ? null : enemies.value[idx] })),
  )

  /** Campo visto por el defensor de un bando: clima/terreno + sus pantallas activas. */
  function fieldFor(defSide: SideId): FieldState {
    const s = screens[defSide]
    return {
      weather: weather.value,
      terrain: terrain.value,
      reflect: s.reflect > 0,
      lightScreen: s.lightScreen > 0,
      auroraVeil: s.auroraVeil > 0,
    }
  }

  async function start(
    allyBuilds: SavedBuild[],
    enemyBuilds: SavedBuild[],
    ai: boolean,
    fmt: BattleFormat,
    diff: Difficulty = 'easy',
  ) {
    format.value = fmt
    allies.value = allyBuilds.map(makeFighter)
    enemies.value = enemyBuilds.map(makeFighter)
    megaUsed.ally = false
    megaUsed.enemy = false
    // Precomputar la megaforma de quien lleve su piedra.
    try {
      const roster = await getRoster()
      for (const f of [...allies.value, ...enemies.value]) {
        f.megaForm = findMegaForm(f.build.mon, f.build.item, roster)
      }
    } catch {
      /* sin roster: no habrá megaevolución dinámica */
    }
    const n = fmt === 'doubles' ? 2 : 1
    allyActives.value = Array.from({ length: n }, (_, i) => (i < allies.value.length ? i : null))
    enemyActives.value = Array.from({ length: n }, (_, i) => (i < enemies.value.length ? i : null))
    // El clima/terreno inicial dura los 5 turnos estándar (no es permanente).
    weather.value = field.weather
    weatherTurns.value = field.weather ? 5 : 0
    terrain.value = field.terrain
    terrainTurns.value = field.terrain ? 5 : 0
    gravity.value = 0
    trickRoom.value = 0
    hazards.ally = emptyHazards()
    hazards.enemy = emptyHazards()
    sideGuard.ally = emptyGuards()
    sideGuard.enemy = emptyGuards()
    // Pantallas iniciales del setup: activas en ambos bandos (5 turnos).
    const seed = (): Screens => ({
      reflect: field.reflect ? 5 : 0,
      lightScreen: field.lightScreen ? 5 : 0,
      auroraVeil: field.auroraVeil ? 5 : 0,
    })
    screens.ally = seed()
    screens.enemy = seed()
    tailwind.ally = 0
    tailwind.enemy = 0
    safeguard.ally = 0
    safeguard.enemy = 0
    log.value = []
    turn.value = 1
    winner.value = null
    aiEnabled.value = ai
    difficulty.value = diff
    clearAiPrefetch()
    replaceQueue.value = []
    phase.value = 'battle'
    push(`¡Comienza el combate ${fmt === 'doubles' ? 'doble' : 'individual'}!`)
    // Habilidades de entrada de los activos iniciales.
    for (const side of ['ally', 'enemy'] as SideId[]) {
      for (const slot of aliveSlots(side)) onEnter(side, slot)
    }
    branches.value = [{ id: newId(), name: 'Principal', states: [captureFullState('Inicio')] }]
    currentBranchId.value = branches.value[0].id
  }

  /* ---------- Utilidades de estado ---------- */

  function applyBoosts(target: Fighter, changes: BoostChanges) {
    for (const [k, v] of Object.entries(changes) as [BoostKey, number][]) {
      const before = target.boosts[k]
      target.boosts[k] = Math.max(-BOOST_MAX, Math.min(BOOST_MAX, before + v))
      const delta = target.boosts[k] - before
      if (delta !== 0) {
        push(`${STAT_TEXT[k]} de ${nameOf(target)} ${v > 0 ? 'subió' : 'bajó'}.`)
      }
    }
  }

  function applyAccEva(target: Fighter, changes: AccEvaChanges) {
    if (changes.accuracy) {
      target.accStage = Math.max(-BOOST_MAX, Math.min(BOOST_MAX, target.accStage + changes.accuracy))
      push(`Precisión de ${nameOf(target)} ${changes.accuracy > 0 ? 'subió' : 'bajó'}.`)
    }
    if (changes.evasion) {
      target.evaStage = Math.max(-BOOST_MAX, Math.min(BOOST_MAX, target.evaStage + changes.evasion))
      push(`Evasión de ${nameOf(target)} ${changes.evasion > 0 ? 'subió' : 'bajó'}.`)
    }
  }

  function applyStatus(target: Fighter, status: StatusCondition) {
    if (!status || target.status) return
    if (target.ability === 'Eelevate') return // Eelevate: inmune a los estados
    if (safeguard[sideOfFighter(target)] > 0) return // Refugio protege del estado
    if (immuneToStatus(target.mon.types, status)) return
    target.status = status
    if (status === 'tox') target.toxicCounter = 0
    if (status === 'slp') target.sleepTurns = 0
    if (status === 'frz') target.freezeTurns = 0
    push(`¡${nameOf(target)} sufre ${STATUS_TEXT[status]}!`)

    // Baya que cura el estado recién infligido (se consume).
    const berry = target.itemActive ? STATUS_BERRY[target.build.item ?? ''] : undefined
    if (berry && (berry === 'any' || berry === status || (berry === 'psn' && status === 'tox'))) {
      target.itemActive = false
      target.status = ''
      push(`${nameOf(target)} se curó con su ${target.build.item}.`)
    }
  }

  function heal(target: Fighter, amount: number) {
    if (target.fainted || amount <= 0) return
    const before = target.hp
    target.hp = Math.min(target.maxHp, target.hp + amount)
    if (target.hp > before) push(`${nameOf(target)} recupera ${target.hp - before} PS.`)
  }

  function dealDamage(target: Fighter, amount: number, note: string) {
    if (amount <= 0) return
    // Aguante: sobrevive con 1 PS a cualquier golpe letal.
    if (target.enduring && amount >= target.hp) {
      target.hp = 1
      push(`${note} ${nameOf(target)} aguantó el golpe (1 PS).`)
      return
    }
    // Banda Focus: sobrevive a un golpe letal con toda la vida.
    if (
      target.itemActive &&
      target.build.item === 'Focus Sash' &&
      target.hp === target.maxHp &&
      amount >= target.hp
    ) {
      target.hp = 1
      target.itemActive = false
      push(`${note} ${nameOf(target)} aguantó con la Banda Focus (1 PS).`)
    } else {
      target.hp = Math.max(0, target.hp - amount)
      push(note)
    }
    if (target.hp === 0) {
      target.fainted = true
      push(`¡${nameOf(target)} se debilitó!`)
      return
    }
    // Baya Zidra: se cura al bajar de la mitad.
    if (target.itemActive && target.build.item === 'Sitrus Berry' && target.hp <= target.maxHp / 2) {
      target.itemActive = false
      heal(target, Math.floor(target.maxHp / 4))
    }
  }

  /* ---------- Habilidades de entrada ---------- */

  function applyEntryHazards(side: SideId, f: Fighter) {
    const hz = hazards[side]
    if (hz.toxicSpikes > 0 && isGrounded(f, gravity.value > 0)) {
      if (f.mon.types.includes('poison')) {
        hz.toxicSpikes = 0
        push(`${nameOf(f)} absorbe las púas tóxicas.`)
      } else {
        applyStatus(f, hz.toxicSpikes >= 2 ? 'tox' : 'psn')
      }
    }
    if (hz.spikes > 0 && isGrounded(f, gravity.value > 0) && !f.fainted && !hasMagicGuard(f)) {
      const frac = [8, 6, 4][hz.spikes - 1]
      const dmg = Math.max(1, Math.floor(f.maxHp / frac))
      dealDamage(f, dmg, `${nameOf(f)} sufre ${dmg} por las púas.`)
    }
    if (hz.stealthRock && !f.fainted && !hasMagicGuard(f)) {
      const eff = typeEffectiveness('rock', f.mon.types)
      const dmg = Math.max(1, Math.floor((f.maxHp * eff) / 8))
      dealDamage(f, dmg, `${nameOf(f)} sufre ${dmg} por las rocas puntiagudas.`)
    }
  }

  function onEnter(side: SideId, slot: number, midTurn = false) {
    const f = fighterAt(side, slot)
    if (!f) return
    // Reinicia los cambios de combate al entrar.
    f.boosts = f.build.boosts ? { ...f.build.boosts } : zeroBoosts()
    f.accStage = 0
    f.evaStage = 0
    f.protecting = false
    f.protectStreak = 0
    f.lockedMove = null
    f.chargingMove = null
    f.mustRecharge = false
    f.turnsActive = 0
    f.enteredThisTurn = midTurn
    f.flinched = false
    f.roosted = false
    f.typeOverride = null
    f.smackedDown = false
    f.ingrained = false
    f.magnetRise = 0
    f.saltCure = false
    f.timesHit = 0
    f.enduring = false
    f.leechSeed = false
    f.lastMove = null
    f.taunt = 0
    f.disableMove = null
    f.disableTurns = 0
    f.encoreMove = null
    f.encoreTurns = 0
    f.torment = false

    triggerAbility(side, slot)
    applyEntryHazards(side, f)
  }

  /** Efectos de habilidad al aparecer/megaevolucionar (Intimidación, climas, terrenos). */
  function triggerAbility(side: SideId, slot: number) {
    const f = fighterAt(side, slot)
    if (!f) return
    const ability = f.ability
    if (ability === 'Intimidate') {
      const foe: SideId = side === 'ally' ? 'enemy' : 'ally'
      push(`${nameOf(f)} intimida a sus rivales.`)
      for (const s of aliveSlots(foe)) applyBoosts(fighterAt(foe, s)!, { attack: -1 })
    }
    const w = WEATHER_ABILITY[ability]
    if (w && weather.value !== w) {
      weather.value = w
      weatherTurns.value = f.itemActive ? 8 : 5
      push(`${nameOf(f)} cambió el clima.`)
    }
    const ter = TERRAIN_ABILITY[ability]
    if (ter && terrain.value !== ter) {
      terrain.value = ter
      terrainTurns.value = f.itemActive ? 8 : 5
      push(`${nameOf(f)} cambió el terreno.`)
    }
  }

  /** Megaevoluciona el combatiente del slot (si puede). */
  function megaEvolve(side: SideId, slot: number) {
    const f = fighterAt(side, slot)
    if (!f || !f.megaForm || f.megaEvolved || megaUsed[side]) return
    const baseName = f.mon.name
    f.mon = f.megaForm
    f.ability = f.megaForm.abilities[0] ?? f.ability
    f.megaEvolved = true
    megaUsed[side] = true
    const newMax = combatantStats(combatantFrom(f)).hp
    f.maxHp = newMax
    f.hp = Math.min(f.hp, f.maxHp)
    push(`¡${baseName} megaevoluciona a ${f.mon.name}!`)
    triggerAbility(side, slot)
  }

  /* ---------- Movimientos ---------- */

  function effectiveSpeed(
    f: Fighter,
    o?: { weather?: Weather; speedStage?: number; ability?: string; mon?: ChampionsMon; tailwind?: boolean },
  ): number {
    const base = combatantStats(combatantFrom(o?.mon ? { ...f, mon: o.mon } : f)).spe
    let s = base * boostMult(o?.speedStage ?? f.boosts.speed)
    const ab = o?.ability ?? f.ability ?? ''
    const w = o?.weather ?? weather.value
    if (w && SPEED_WEATHER[ab] === w) s *= 2
    const tw = o?.tailwind ?? tailwind[sideOfFighter(f)] > 0
    if (tw) s *= 2
    if (f.itemActive && f.build.item === 'Choice Scarf') s *= 1.5
    if (f.status === 'par') s *= 0.5
    return Math.floor(s)
  }

  /** Prioridad efectiva (con habilidades como Prankster/Gale Wings). */
  function effectivePriority(f: Fighter, move: ChampionsMove, abilityOverride?: string): number {
    let p = move.priority
    const ab = abilityOverride ?? f.ability ?? ''
    if (ab === 'Prankster' && (move.category === 'status' || move.power == null)) p += 1
    if (ab === 'Gale Wings' && move.type === 'flying' && f.hp === f.maxHp) p += 1
    return p
  }

  function hasMagicGuard(f: Fighter): boolean {
    return f.ability === 'Magic Guard'
  }

  /** Razón por la que un combatiente no puede usar un movimiento ahora (o null). */
  function moveRestriction(f: Fighter, move: ChampionsMove): string | null {
    const isStatus = move.category === 'status' || move.power == null
    if (f.taunt > 0 && isStatus) return 'Mofa'
    if (f.disableMove === move.name) return 'Anulación'
    if (f.encoreMove && f.encoreMove !== move.name) return 'Bis'
    if (f.torment && f.lastMove === move.name) return 'Tormento'
    return null
  }

  /** Fase semiinvulnerable del objetivo (Vuelo/Excavar/Buceo/Fuerza Fantasma) o null. */
  function invulnKindOf(f: Fighter): 'fly' | 'dig' | 'dive' | 'vanish' | null {
    return f.chargingMove ? SEMI_INVULN[f.chargingMove.name] ?? null : null
  }

  /** ¿El objetivo esquiva el movimiento por estar semiinvulnerable? */
  function evadesInvuln(target: Fighter, move: ChampionsMove, attacker: Fighter): boolean {
    const kind = invulnKindOf(target)
    if (!kind) return false
    if (attacker.ability === 'No Guard') return false
    return !HITS_THROUGH_INVULN[kind].has(move.name)
  }

  /** Sube +1 la estadística más alta (Eelevate al debilitar a un rival). */
  function boostHighestStat(f: Fighter) {
    const s = combatantStats(combatantFrom(f))
    const entries: [BoostKey, number][] = [
      ['attack', s.atk],
      ['defense', s.def],
      ['spAttack', s.spa],
      ['spDefense', s.spd],
      ['speed', s.spe],
    ]
    entries.sort((a, b) => b[1] - a[1])
    applyBoosts(f, { [entries[0][0]]: 1 })
  }

  function rollDamage(attacker: Fighter, defender: Fighter, move: ChampionsMove, crit: boolean): number {
    const grav = gravity.value > 0
    // Inmunidad a Tierra por levitar (Volador/Levitación/Levitón), salvo aterrizado.
    if (move.type === 'ground' && !isGrounded(defender, grav)) return 0
    const field = fieldFor(sideOfFighter(defender))
    // Aterrizado a la fuerza: que el motor no aplique la inmunidad de Volador a Tierra.
    if (grav || defender.smackedDown || defender.ingrained) field.isGravity = true
    // Puño Furia (Rage Fist): +50 de potencia por golpe recibido (tope 350).
    const scaledMove =
      move.name === 'Rage Fist'
        ? { ...move, power: Math.min(350, 50 * (1 + attacker.timesHit)) }
        : move
    const r = runCalc({
      attacker: combatantFrom(attacker),
      defender: combatantFrom(defender),
      move: scaledMove,
      field,
      doubles: format.value === 'doubles',
      isCrit: crit,
    })
    if (r.maxDamage <= 0) return 0
    return r.minDamage + Math.floor(Math.random() * (r.maxDamage - r.minDamage + 1))
  }

  /** Objetivos de un movimiento (uno o varios en combate doble). */
  function resolveTargets(
    attackerSide: SideId,
    attackerSlot: number,
    defSide: SideId,
    effect: ReturnType<typeof getMoveEffect>,
    target: MoveTarget,
    moveType: PokemonType,
  ): Fighter[] {
    const t = effect?.target
    if (t === 'allAdjacentFoes' || t === 'foeSide') {
      return aliveSlots(defSide).map((s) => fighterAt(defSide, s)!)
    }
    if (t === 'allAdjacent' || t === 'all') {
      const foes = aliveSlots(defSide).map((s) => fighterAt(defSide, s)!)
      const partners = aliveSlots(attackerSide)
        .filter((s) => s !== attackerSlot)
        .map((s) => fighterAt(attackerSide, s)!)
      return [...foes, ...partners]
    }
    // Objetivo único.
    const chosen = fighterAt(target.side, target.slot)
    // Redirección en dobles (Pararrayos, Colector): atrae el ataque de su tipo.
    if (format.value === 'doubles' && target.side === defSide) {
      for (const s of aliveSlots(defSide)) {
        const f = fighterAt(defSide, s)!
        if (f !== chosen && REDIRECT[f.ability ?? ''] === moveType) {
          push(`¡${nameOf(f)} atrae el ataque con ${f.ability}!`)
          return [f]
        }
      }
    }
    if (chosen && !chosen.fainted) return [chosen]
    const alt = aliveSlots(defSide)[0]
    return alt != null ? [fighterAt(defSide, alt)!] : []
  }

  /** Aplica un ataque a un único objetivo (daño, objetos y secundarios). Devuelve el daño. */
  function hitTarget(
    attacker: Fighter,
    defender: Fighter,
    move: ChampionsMove,
    effect: ReturnType<typeof getMoveEffect>,
    damageMult = 1,
  ): number {
    // Absorción por habilidad.
    const absorb = ABSORB[defender.ability ?? '']
    if (absorb && move.type === absorb.type) {
      push(`${nameOf(defender)} absorbe el ataque con ${defender.ability}.`)
      if (absorb.heal) heal(defender, Math.floor(defender.maxHp * absorb.heal))
      if (absorb.boost) applyBoosts(defender, absorb.boost)
      return 0
    }
    if (move.type === 'ground' && defender.itemActive && defender.build.item === 'Air Balloon') {
      push(`${nameOf(defender)} flota con el Globo Helio: no le afecta.`)
      return 0
    }

    let hits = 1
    if (effect?.multihit) {
      hits = Array.isArray(effect.multihit)
        ? effect.multihit[0] + Math.floor(Math.random() * (effect.multihit[1] - effect.multihit[0] + 1))
        : effect.multihit
    }
    let total = 0
    for (let i = 0; i < hits && !defender.fainted; i++) {
      const crit = Math.random() < 1 / 24
      const dmg = Math.floor(rollDamage(attacker, defender, move, crit) * damageMult)
      total += dmg
      if (crit && dmg > 0) push('¡Golpe crítico!')
      const pct = ((dmg / defender.maxHp) * 100).toFixed(0)
      dealDamage(defender, dmg, `→ ${dmg} (${pct}%) a ${nameOf(defender)}.`)
    }

    if (total > 0) {
      defender.timesHit += 1 // para Puño Furia (Rage Fist)
      // Baya reductora de tipo: se consume tras amortiguar el golpe.
      const rb = defender.itemActive ? RESIST_BERRY[defender.build.item ?? ''] : undefined
      if (rb && move.type === rb) {
        const eff = typeEffectiveness(move.type, effectiveTypes(defender))
        if (eff > 1 || defender.build.item === 'Chilan Berry') {
          defender.itemActive = false
          push(`${nameOf(defender)} amortiguó el golpe con su ${defender.build.item}.`)
        }
      }
      if (defender.itemActive && defender.build.item === 'Air Balloon') {
        defender.itemActive = false
        push(`El Globo Helio de ${nameOf(defender)} se rompió.`)
      }
      if (
        effect?.contact &&
        defender.itemActive &&
        defender.build.item === 'Rocky Helmet' &&
        !hasMagicGuard(attacker)
      ) {
        const rh = Math.max(1, Math.floor(attacker.maxHp / 6))
        dealDamage(attacker, rh, `${nameOf(attacker)} sufre ${rh} por el Casco Dentado.`)
      }
      // Habilidades de contacto del defensor.
      if (effect?.contact) {
        const frac = CONTACT_DAMAGE[defender.ability]
        if (frac && !hasMagicGuard(attacker) && !attacker.fainted) {
          const d = Math.max(1, Math.floor(attacker.maxHp / frac))
          dealDamage(attacker, d, `${nameOf(attacker)} sufre ${d} por ${defender.ability}.`)
        }
        if (!attacker.fainted && attacker.status === '') {
          const st = CONTACT_STATUS[defender.ability]
          if (st && Math.random() < 0.3) applyStatus(attacker, st)
          else if (defender.ability === 'Effect Spore' && Math.random() < 0.3) {
            applyStatus(attacker, (['par', 'psn', 'slp'] as StatusCondition[])[Math.floor(Math.random() * 3)])
          }
        }
        // Detonación: al debilitarse, daña 1/4 al atacante.
        if (defender.fainted && defender.ability === 'Aftermath' && !hasMagicGuard(attacker)) {
          const a = Math.max(1, Math.floor(attacker.maxHp / 4))
          dealDamage(attacker, a, `${nameOf(attacker)} sufre ${a} por Detonación.`)
        }
      }
      if (
        !defender.fainted &&
        defender.itemActive &&
        defender.build.item === 'Weakness Policy' &&
        typeEffectiveness(move.type, effectiveTypes(defender)) > 1
      ) {
        defender.itemActive = false
        push(`¡La Póliza de Debilidad de ${nameOf(defender)} se activó!`)
        applyBoosts(defender, { attack: 2, spAttack: 2 })
      }
      if (!defender.fainted && effect?.secondaries) {
        for (const sec of effect.secondaries) {
          if (Math.random() * 100 < sec.chance) {
            if (sec.status) applyStatus(defender, sec.status)
            if (sec.boosts) applyBoosts(defender, sec.boosts)
            if (sec.selfBoosts) applyBoosts(attacker, sec.selfBoosts)
            if (sec.flinch) defender.flinched = true
          }
        }
      }
      // Buenazo: aterriza al objetivo (Tierra pasa a golpearle; anula Levitón).
      if (!defender.fainted && move.name === 'Smack Down') {
        defender.smackedDown = true
        defender.magnetRise = 0
      }
      // Spicy Spray: al recibir daño de un movimiento, quema al atacante.
      if (defender.ability === 'Spicy Spray' && !attacker.fainted && attacker.status === '') {
        applyStatus(attacker, 'brn')
      }
      // Salazón: marca al objetivo para el daño residual por turno.
      if (!defender.fainted && move.name === 'Salt Cure') defender.saltCure = true
      // Eelevate: al debilitar a un rival, sube su estadística más alta.
      if (defender.fainted && !attacker.fainted && attacker.ability === 'Eelevate') {
        boostHighestStat(attacker)
      }
    }
    return total
  }

  /** Efecto sobre quien ataca a un Pokémon protegido con un escudo especial (contacto). */
  function applyProtectContact(
    attacker: Fighter,
    defender: Fighter,
    effect: ReturnType<typeof getMoveEffect>,
  ) {
    if (!effect?.contact || attacker.fainted) return
    switch (defender.protectKind) {
      case 'spiky':
        if (!hasMagicGuard(attacker)) {
          const d = Math.max(1, Math.floor(attacker.maxHp / 8))
          dealDamage(attacker, d, `${nameOf(attacker)} sufre ${d} por la Barrera Espinosa.`)
        }
        break
      case 'kings':
        applyBoosts(attacker, { attack: -1 })
        break
      case 'bunker':
        if (attacker.status === '') applyStatus(attacker, 'psn')
        break
      case 'obstruct':
        applyBoosts(attacker, { defense: -2 })
        break
      case 'silktrap':
        applyBoosts(attacker, { speed: -1 })
        break
    }
  }

  /** ¿El bando defensor bloquea el movimiento con una protección de bando? */
  function sideGuardBlocks(defender: Fighter, move: ChampionsMove, effect: ReturnType<typeof getMoveEffect>, attacker: Fighter): string | null {
    const g = sideGuard[sideOfFighter(defender)]
    const spread =
      effect?.target === 'allAdjacentFoes' ||
      effect?.target === 'allAdjacent' ||
      effect?.target === 'foeSide' ||
      effect?.target === 'all'
    const priority = effectivePriority(attacker, move) > 0
    const isStatus = move.category === 'status' || move.power == null
    if (g.wide && spread) return 'Vasta Guardia'
    if (g.quick && priority) return 'Anticipo'
    if (g.mat && !isStatus) return 'Escudo Tatami'
    if (g.crafty && isStatus) return 'Escudo Áureo'
    return null
  }

  function performMove(attackerSide: SideId, attackerSlot: number, target: MoveTarget, move: ChampionsMove) {
    const attacker = fighterAt(attackerSide, attackerSlot)
    if (!attacker || attacker.fainted) return
    const defSide: SideId = attackerSide === 'ally' ? 'enemy' : 'ally'

    // Sueño (Champions): no se mueve el turno 1; 33,3% de despertar el turno 2;
    // despierta seguro el turno 3. Al despertar, actúa ese mismo turno.
    if (attacker.status === 'slp') {
      attacker.sleepTurns += 1
      const wakes = attacker.sleepTurns >= 3 || (attacker.sleepTurns === 2 && Math.random() < 1 / 3)
      if (!wakes) {
        push(`${nameOf(attacker)} está dormido.`)
        return
      }
      attacker.status = ''
      attacker.sleepTurns = 0
      push(`¡${nameOf(attacker)} se despertó!`)
    }
    // Congelación (Champions): 25% de descongelar por turno; seguro al 3.er turno.
    if (attacker.status === 'frz') {
      attacker.freezeTurns += 1
      const thaws = attacker.freezeTurns >= 3 || Math.random() < 0.25
      if (!thaws) {
        push(`${nameOf(attacker)} está congelado y no puede moverse.`)
        return
      }
      attacker.status = ''
      attacker.freezeTurns = 0
      push(`¡${nameOf(attacker)} se descongeló!`)
    }
    if (attacker.status === 'par' && Math.random() < 0.125) {
      push(`${nameOf(attacker)} está paralizado y no puede moverse.`)
      return
    }

    const effect = getMoveEffect(move.name)

    // Solo el primer turno tras entrar (Sorpresa, Escaramuza).
    if (FIRST_TURN_ONLY.has(move.name) && attacker.turnsActive > 0) {
      push(`${nameOf(attacker)} solo puede usar ${move.name} nada más entrar al campo.`)
      return
    }

    // Volátiles de restricción (Mofa, Anulación, Bis, Tormento).
    const restriction = moveRestriction(attacker, move)
    if (restriction) {
      push(`${nameOf(attacker)} no puede usar ${move.name} (${restriction}).`)
      return
    }
    attacker.lastMove = move.name

    // Aguante: sobrevive con 1 PS este turno (comparte la racha de Protección).
    if (move.name === 'Endure') {
      const ok = attacker.protectStreak === 0 || Math.random() < 1 / Math.pow(3, attacker.protectStreak)
      if (ok) {
        attacker.enduring = true
        attacker.protectStreak += 1
        push(`${nameOf(attacker)} se prepara para aguantar.`)
      } else {
        attacker.protectStreak = 0
        push(`${nameOf(attacker)} usó Aguante… ¡pero falló!`)
      }
      return
    }

    // Protección propia (Protección/Detección, Barrera Espinosa, Escudo Real, Búnker…).
    if (effect?.protectKind) {
      const ok = attacker.protectStreak === 0 || Math.random() < 1 / Math.pow(3, attacker.protectStreak)
      if (ok) {
        attacker.protecting = true
        attacker.protectKind = effect.protectKind
        attacker.protectStreak += 1
        push(`${nameOf(attacker)} se protege.`)
      } else {
        attacker.protectStreak = 0
        push(`${nameOf(attacker)} usó ${move.name}… ¡pero falló!`)
      }
      return
    }
    // Protección de bando (Vasta Guardia, Anticipo, Escudo Áureo, Escudo Tatami).
    if (effect?.sideGuard) {
      sideGuard[attackerSide][effect.sideGuard] = true
      push(`${nameOf(attacker)} usó ${move.name}: protege a su bando este turno.`)
      return
    }
    // Pantallas (Reflejo, Pantalla de Luz, Velo Aurora): en el bando propio.
    if (effect?.screen) {
      const turns = attacker.itemActive && attacker.build.item === 'Light Clay' ? 8 : 5
      screens[attackerSide][effect.screen] = turns
      push(`${nameOf(attacker)} levantó ${move.name} (${turns} turnos).`)
      return
    }
    // Viento Afín: dobla la velocidad del bando propio 4 turnos.
    if (effect?.tailwind) {
      tailwind[attackerSide] = 4
      push(`${nameOf(attacker)} desató ${move.name}: su bando gana velocidad (4 turnos).`)
      return
    }
    // Movimientos de clima (Día Soleado, Danza Lluvia, Tormenta Arena, Nevada).
    if (effect?.weather) {
      const rock = WEATHER_ROCK[effect.weather]
      const turns = rock && attacker.itemActive && attacker.build.item === rock ? 8 : 5
      weather.value = effect.weather
      weatherTurns.value = turns
      push(`${nameOf(attacker)} usó ${move.name}: cambió el clima (${turns} turnos).`)
      return
    }
    // Movimientos de terreno (Campo Eléctrico, Herbáceo, Psíquico, Niebla).
    if (effect?.terrain) {
      const turns = attacker.itemActive && attacker.build.item === 'Terrain Extender' ? 8 : 5
      terrain.value = effect.terrain
      terrainTurns.value = turns
      push(`${nameOf(attacker)} usó ${move.name}: cambió el terreno (${turns} turnos).`)
      return
    }
    // Gravedad: 5 turnos; aterriza a todos (anula Levitón) y sube la precisión.
    if (move.name === 'Gravity') {
      gravity.value = 5
      for (const s of ['ally', 'enemy'] as SideId[]) {
        for (const sl of aliveSlots(s)) fighterAt(s, sl)!.magnetRise = 0
      }
      push(`¡${nameOf(attacker)} intensificó la gravedad! (5 turnos)`)
      return
    }
    // Espacio Raro: invierte el orden de velocidad 5 turnos (o lo deshace si ya está).
    if (move.name === 'Trick Room') {
      if (trickRoom.value > 0) {
        trickRoom.value = 0
        push(`${nameOf(attacker)} deshizo el Espacio Raro.`)
      } else {
        trickRoom.value = 5
        push(`¡${nameOf(attacker)} distorsionó el espacio! (5 turnos)`)
      }
      return
    }
    // Niebla (Haze): borra todos los cambios de estadísticas de ambos bandos.
    if (move.name === 'Haze') {
      for (const s of ['ally', 'enemy'] as SideId[]) {
        for (const sl of aliveSlots(s)) {
          const f = fighterAt(s, sl)!
          f.boosts = zeroBoosts()
          f.accStage = 0
          f.evaStage = 0
        }
      }
      push(`¡${nameOf(attacker)} disipó todos los cambios de estadísticas!`)
      return
    }
    // Aromaterapia / Campana Cura: cura el estado de todo el equipo propio.
    if (move.name === 'Aromatherapy' || move.name === 'Heal Bell') {
      for (const f of teamOf(attackerSide).value) {
        if (!f.fainted && f.status) {
          f.status = ''
          f.sleepTurns = 0
          f.freezeTurns = 0
          f.toxicCounter = 0
        }
      }
      push(`¡El equipo de ${nameOf(attacker)} se libró de los estados alterados!`)
      return
    }
    // Alivio (Refresh): cura el estado del propio usuario.
    if (move.name === 'Refresh') {
      if (attacker.status) {
        attacker.status = ''
        attacker.toxicCounter = 0
        push(`${nameOf(attacker)} se recuperó de su estado.`)
      }
      return
    }
    // Refugio (Safeguard): protege al bando propio de los estados 5 turnos.
    if (move.name === 'Safeguard') {
      safeguard[attackerSide] = 5
      push(`${nameOf(attacker)} protegió a su bando de los estados (5 turnos).`)
      return
    }
    attacker.protectStreak = 0

    // Movimiento de carga: primer turno carga, segundo turno golpea.
    const releasing = attacker.chargingMove?.name === move.name
    if (effect?.charge && !releasing) {
      const solar = move.name === 'Solar Beam' || move.name === 'Solar Blade'
      const powerHerb = attacker.itemActive && attacker.build.item === 'Power Herb'
      const instant = (solar && weather.value === 'Sun') || powerHerb
      if (!instant) {
        attacker.chargingMove = move
        push(`${nameOf(attacker)} está cargando ${move.name}…`)
        return
      }
      if (powerHerb) {
        attacker.itemActive = false
        push(`${nameOf(attacker)} usó su Hierba Única para atacar de inmediato.`)
      }
    }
    if (releasing) attacker.chargingMove = null

    const isStatus = move.category === 'status' || move.power == null

    // Chaleco Asalto: no permite movimientos de estado.
    if (isStatus && attacker.itemActive && attacker.build.item === 'Assault Vest') {
      push(`${nameOf(attacker)} no puede usar ${move.name} con el Chaleco Asalto.`)
      return
    }
    // Objeto Elección: queda bloqueado al primer movimiento usado.
    if (attacker.itemActive && CHOICE_ITEMS.has(attacker.build.item ?? '')) {
      attacker.lockedMove = move.name
    }

    // Colocar campo de peligro en el lado rival.
    if (effect?.hazard) {
      const hz = hazards[defSide]
      if (effect.hazard === 'stealthrock') hz.stealthRock = true
      else if (effect.hazard === 'spikes') hz.spikes = Math.min(3, hz.spikes + 1)
      else hz.toxicSpikes = Math.min(2, hz.toxicSpikes + 1)
      push(`${nameOf(attacker)} colocó una trampa en el campo rival.`)
      return
    }

    const targetsSelf = effect?.target === 'self'
    const acc = effect?.accuracy ?? move.accuracy ?? true

    push(`${nameOf(attacker)} usó ${move.name}.`)

    // Espray Bucal (Throat Spray): sube At. Esp. al usar un movimiento de sonido.
    if (effect?.sound && attacker.itemActive && attacker.build.item === 'Throat Spray') {
      attacker.itemActive = false
      applyBoosts(attacker, { spAttack: 1 })
      push(`${nameOf(attacker)} usó su Espray Bucal.`)
    }

    // --- Movimiento de estado ---
    if (isStatus) {
      // Respiro: pierde el tipo Volador hasta el fin del turno (Tierra pasa a golpearle).
      if (move.name === 'Roost') attacker.roosted = true
      // Arraigo: se aterriza y se cura cada turno. Levitón: inmune a Tierra 5 turnos.
      if (move.name === 'Ingrain') {
        attacker.ingrained = true
        attacker.magnetRise = 0
        push(`${nameOf(attacker)} echó raíces.`)
      }
      if (move.name === 'Magnet Rise' && !attacker.smackedDown && !attacker.ingrained) {
        attacker.magnetRise = 5
        push(`${nameOf(attacker)} levita con Levitón (5 turnos).`)
      }
      if (effect?.heal) heal(attacker, Math.floor((attacker.maxHp * effect.heal[0]) / effect.heal[1]))
      if (targetsSelf) {
        if (effect?.boosts) applyBoosts(attacker, effect.boosts)
        if (effect?.accEva) applyAccEva(attacker, effect.accEva)
      } else {
        for (const d of resolveTargets(attackerSide, attackerSlot, defSide, effect, target, move.type)) {
          const noGuard = attacker.ability === 'No Guard' || d.ability === 'No Guard'
          if (acc !== true && !noGuard) {
            const chance =
              (acc as number) * accMult(attacker.accStage) / accMult(d.evaStage) * (gravity.value > 0 ? 5 / 3 : 1)
            if (Math.random() * 100 >= chance) {
              push(`Falló contra ${nameOf(d)}.`)
              continue
            }
          }
          if (d.ability === 'Soundproof' && effect?.sound) {
            push(`¡${nameOf(d)} es inmune con Insonorizar!`)
            continue
          }
          if (evadesInvuln(d, move, attacker)) {
            push(`${nameOf(d)} está fuera de alcance.`)
            continue
          }
          const guardStatus = sideGuardBlocks(d, move, effect, attacker)
          if (guardStatus) {
            push(`¡${guardStatus} protege a ${nameOf(d)}!`)
            continue
          }
          if (d.protecting) {
            push(`${nameOf(d)} se protegió.`)
            continue
          }
          // Absorción por habilidad (p. ej. Onda Trueno contra Pararrayos).
          const absorb = ABSORB[d.ability ?? '']
          if (absorb && move.type === absorb.type) {
            push(`${nameOf(d)} absorbe ${move.name} con ${d.ability}.`)
            if (absorb.heal) heal(d, Math.floor(d.maxHp * absorb.heal))
            if (absorb.boost) applyBoosts(d, absorb.boost)
            continue
          }
          // Rugido/Bramido: fuerzan el cambio del objetivo (sale otro del banquillo).
          if (FORCE_SWITCH_STATUS.has(move.name)) {
            forceSwitch(defSide, slotOfActive(defSide, d))
            continue
          }
          // Volátiles de restricción: fijan el volátil en el objetivo.
          if (move.name === 'Taunt') {
            d.taunt = 3
            push(`¡${nameOf(d)} cayó en la Mofa!`)
            continue
          }
          if (move.name === 'Disable') {
            if (d.lastMove) {
              d.disableMove = d.lastMove
              d.disableTurns = 4
              push(`¡Se anuló ${d.lastMove} de ${nameOf(d)}!`)
            } else push(`Pero falló.`)
            continue
          }
          if (move.name === 'Encore') {
            if (d.lastMove) {
              d.encoreMove = d.lastMove
              d.encoreTurns = 3
              push(`¡${nameOf(d)} tiene que repetir ${d.lastMove} por el Bis!`)
            } else push(`Pero falló.`)
            continue
          }
          if (move.name === 'Torment') {
            d.torment = true
            push(`¡${nameOf(d)} sufre Tormento!`)
            continue
          }
          // Drenadoras (Leech Seed): siembra al objetivo (los Planta son inmunes).
          if (move.name === 'Leech Seed') {
            if (effectiveTypes(d).includes('grass')) push(`No afecta a ${nameOf(d)}.`)
            else {
              d.leechSeed = true
              push(`¡${nameOf(d)} fue sembrado!`)
            }
            continue
          }
          // Anegar: el objetivo pasa a tipo Agua puro. Maldición Silvana: +Planta.
          if (move.name === 'Soak') {
            d.typeOverride = ['water']
            push(`¡${nameOf(d)} quedó empapado: ahora es de tipo Agua!`)
          } else if (move.name === "Forest's Curse") {
            const base = d.typeOverride ?? [...d.mon.types]
            if (!base.includes('grass')) d.typeOverride = [...base, 'grass']
            push(`¡A ${nameOf(d)} se le añadió el tipo Planta!`)
          }
          if (effect?.boosts) applyBoosts(d, effect.boosts)
          if (effect?.accEva) applyAccEva(d, effect.accEva)
          if (effect?.status) applyStatus(d, effect.status)
        }
      }
      if (effect?.selfBoosts) applyBoosts(attacker, effect.selfBoosts)
      return
    }

    // --- Movimiento de daño (uno o varios objetivos) ---
    const targets = resolveTargets(attackerSide, attackerSlot, defSide, effect, target, move.type)
    if (!targets.length) {
      push(`${nameOf(attacker)} no tiene objetivo.`)
      return
    }
    // Rompe-pantallas (Demolición, Colmillo Psíquico, Furia Titánica): las anula antes de golpear.
    if (BREAKS_SCREENS.has(move.name)) {
      const s = screens[defSide]
      if (s.reflect || s.lightScreen || s.auroraVeil) {
        s.reflect = s.lightScreen = s.auroraVeil = 0
        push(`¡${move.name} rompió las pantallas del bando rival!`)
      }
    }
    // Ignora protecciones: Amago/Fuerza Fantasma… y Puño Invisible en ataques de contacto.
    const ignoresProtect =
      IGNORES_PROTECT.has(move.name) || (!!effect?.contact && attacker.ability === 'Unseen Fist')
    let totalDamage = 0
    for (const d of targets) {
      const noGuard = attacker.ability === 'No Guard' || d.ability === 'No Guard'
      if (acc !== true && !noGuard) {
        const chance = (acc as number) * accMult(attacker.accStage) / accMult(d.evaStage)
        if (Math.random() * 100 >= chance) {
          push(`Falló contra ${nameOf(d)}.`)
          continue
        }
      }
      if (d.ability === 'Soundproof' && effect?.sound) {
        push(`¡${nameOf(d)} es inmune con Insonorizar!`)
        continue
      }
      if (evadesInvuln(d, move, attacker)) {
        push(`${nameOf(d)} está fuera de alcance.`)
        continue
      }
      if (!ignoresProtect) {
        const guardDmg = sideGuardBlocks(d, move, effect, attacker)
        if (guardDmg) {
          push(`¡${guardDmg} protege a ${nameOf(d)}!`)
          continue
        }
        if (d.protecting) {
          // Piercing Drill: los ataques de contacto atraviesan la protección (¼ de daño).
          if (effect?.contact && attacker.ability === 'Piercing Drill') {
            push(`¡${nameOf(attacker)} atraviesa la protección de ${nameOf(d)} con Piercing Drill!`)
            totalDamage += hitTarget(attacker, d, move, effect, 0.25)
          } else {
            push(`${nameOf(d)} se protegió.`)
            applyProtectContact(attacker, d, effect)
          }
          continue
        }
      } else if (d.protecting && IGNORES_PROTECT.has(move.name)) {
        // Amago y similares levantan la protección del objetivo.
        d.protecting = false
        push(`¡${move.name} atravesó la protección de ${nameOf(d)}!`)
      }
      // Los que alcanzan a un objetivo semiinvulnerable pueden hacer el doble (Terremoto→Excavar…).
      const inv = invulnKindOf(d)
      const dbl = inv && DOUBLE_VS_INVULN[inv]?.has(move.name) ? 2 : 1
      totalDamage += hitTarget(attacker, d, move, effect, dbl)
      // Cola Dragón/Llave Giro: fuerzan el cambio del objetivo tras el golpe.
      if (FORCE_SWITCH_DAMAGE.has(move.name) && !d.fainted) {
        forceSwitch(defSide, slotOfActive(defSide, d))
      }
    }

    if (totalDamage > 0) {
      if (effect?.selfBoosts) applyBoosts(attacker, effect.selfBoosts)
      if (effect?.drain) heal(attacker, Math.floor((totalDamage * effect.drain[0]) / effect.drain[1]))
      if (effect?.recoil && !hasMagicGuard(attacker)) {
        const rec = Math.max(1, Math.floor((totalDamage * effect.recoil[0]) / effect.recoil[1]))
        dealDamage(attacker, rec, `${nameOf(attacker)} sufre ${rec} de retroceso.`)
      }
      if (attacker.itemActive && attacker.build.item === 'Life Orb' && !hasMagicGuard(attacker)) {
        const lo = Math.max(1, Math.floor(attacker.maxHp / 10))
        dealDamage(attacker, lo, `${nameOf(attacker)} pierde ${lo} por la Vidasfera.`)
      }
    }

    // Recarga: el próximo turno no podrá actuar.
    if (effect?.recharge) attacker.mustRecharge = true
  }

  /* ---------- Fin de turno ---------- */

  const SAND_IMMUNE_ABILITY = new Set([
    'Magic Guard',
    'Overcoat',
    'Sand Veil',
    'Sand Rush',
    'Sand Force',
  ])

  function applyResidual(f: Fighter) {
    if (f.fainted) return
    const ab = f.ability ?? ''
    // Cura Veneno: se cura con el veneno en vez de dañarse.
    if ((f.status === 'psn' || f.status === 'tox') && ab === 'Poison Heal') {
      heal(f, Math.max(1, Math.floor(f.maxHp / 8)))
      return
    }
    if (hasMagicGuard(f)) return // inmune al daño de estado
    let dmg = 0
    if (f.status === 'brn') dmg = Math.max(1, Math.floor(f.maxHp / 16))
    else if (f.status === 'psn') dmg = Math.max(1, Math.floor(f.maxHp / 8))
    else if (f.status === 'tox') {
      f.toxicCounter += 1
      dmg = Math.max(1, Math.floor((f.maxHp * f.toxicCounter) / 16))
    }
    if (dmg > 0) dealDamage(f, dmg, `${nameOf(f)} sufre ${dmg} por ${STATUS_TEXT[f.status]}.`)
  }

  function applySandDamage(f: Fighter) {
    if (f.fainted) return
    const t = f.mon.types
    if (t.includes('rock') || t.includes('ground') || t.includes('steel')) return
    if (SAND_IMMUNE_ABILITY.has(f.ability ?? '')) return
    const dmg = Math.max(1, Math.floor(f.maxHp / 16))
    dealDamage(f, dmg, `${nameOf(f)} sufre ${dmg} por la tormenta de arena.`)
  }

  function applyLeftovers(f: Fighter) {
    if (f.fainted || !f.itemActive) return
    if (f.build.item === 'Leftovers' && f.hp < f.maxHp) {
      heal(f, Math.max(1, Math.floor(f.maxHp / 16)))
    }
  }

  function applyGrassyHeal(f: Fighter) {
    if (f.fainted || f.hp >= f.maxHp || !isGrounded(f, gravity.value > 0)) return
    heal(f, Math.max(1, Math.floor(f.maxHp / 16)))
  }

  function applyIngrainHeal(f: Fighter) {
    if (f.fainted || !f.ingrained || f.hp >= f.maxHp) return
    heal(f, Math.max(1, Math.floor(f.maxHp / 16)))
  }

  /** Drenadoras: el sembrado pierde 1/16 y el rival de su slot lo recupera. */
  function applyLeechSeed(side: SideId, slot: number) {
    const f = fighterAt(side, slot)
    if (!f || f.fainted || !f.leechSeed || hasMagicGuard(f)) return
    const before = f.hp
    const dmg = Math.max(1, Math.floor(f.maxHp / 16))
    dealDamage(f, dmg, `${nameOf(f)} pierde PS por las Drenadoras.`)
    const drained = before - f.hp
    const foe: SideId = side === 'ally' ? 'enemy' : 'ally'
    const healer = fighterAt(foe, slot)
    if (drained > 0 && healer && !healer.fainted) heal(healer, drained)
  }

  /** Salazón: 1/16 del máximo por turno (1/8 si es de tipo Agua o Acero). */
  function applySaltCure(f: Fighter) {
    if (f.fainted || !f.saltCure || hasMagicGuard(f)) return
    const t = effectiveTypes(f)
    const frac = t.includes('water') || t.includes('steel') ? 8 : 16
    const dmg = Math.max(1, Math.floor(f.maxHp / frac))
    dealDamage(f, dmg, `${nameOf(f)} sufre ${dmg} por la Salazón.`)
  }

  function endOfTurn() {
    // Se acaba la protección de este turno (propia y de bando).
    for (const side of ['ally', 'enemy'] as SideId[]) {
      activesOf(side).value.forEach((idx) => {
        if (idx != null) {
          teamOf(side).value[idx].protecting = false
          teamOf(side).value[idx].protectKind = null
        }
      })
      sideGuard[side] = emptyGuards()
    }

    const actives: Fighter[] = []
    for (const side of ['ally', 'enemy'] as SideId[]) {
      for (const slot of aliveSlots(side)) actives.push(fighterAt(side, slot)!)
    }

    // Clima (arena) y duración.
    if (weather.value === 'Sand') actives.forEach(applySandDamage)
    if (weatherTurns.value > 0) {
      weatherTurns.value -= 1
      if (weatherTurns.value === 0) {
        push('El clima se calmó.')
        weather.value = ''
      }
    }

    // Terreno de hierba (curación) y duración.
    if (terrain.value === 'Grassy') actives.forEach(applyGrassyHeal)
    if (terrainTurns.value > 0) {
      terrainTurns.value -= 1
      if (terrainTurns.value === 0) {
        push('El terreno desapareció.')
        terrain.value = ''
      }
    }

    // Duración de la Gravedad.
    if (gravity.value > 0) {
      gravity.value -= 1
      if (gravity.value === 0) push('La gravedad volvió a la normalidad.')
    }

    // Duración del Espacio Raro.
    if (trickRoom.value > 0) {
      trickRoom.value -= 1
      if (trickRoom.value === 0) push('El Espacio Raro se disipó.')
    }

    // Duración del Refugio por bando.
    for (const side of ['ally', 'enemy'] as SideId[]) {
      if (safeguard[side] > 0) {
        safeguard[side] -= 1
        if (safeguard[side] === 0) {
          push(`El Refugio del bando ${side === 'ally' ? 'aliado' : 'rival'} se disipó.`)
        }
      }
    }

    // Curación de Arraigo.
    actives.forEach(applyIngrainHeal)

    // Duración de las pantallas por bando.
    for (const side of ['ally', 'enemy'] as SideId[]) {
      const s = screens[side]
      for (const key of ['reflect', 'lightScreen', 'auroraVeil'] as (keyof Screens)[]) {
        if (s[key] > 0) {
          s[key] -= 1
          if (s[key] === 0) {
            const label = key === 'reflect' ? 'Reflejo' : key === 'lightScreen' ? 'Pantalla de Luz' : 'Velo Aurora'
            push(`${label} del bando ${side === 'ally' ? 'aliado' : 'rival'} desapareció.`)
          }
        }
      }
      // Duración del Viento Afín.
      if (tailwind[side] > 0) {
        tailwind[side] -= 1
        if (tailwind[side] === 0) {
          push(`El Viento Afín del bando ${side === 'ally' ? 'aliado' : 'rival'} amainó.`)
        }
      }
    }

    // Habilidades dependientes del clima (Poder Solar / Piel Seca).
    for (const f of actives) {
      if (f.fainted) continue
      const ab = f.ability
      if (weather.value === 'Sun' && (ab === 'Solar Power' || ab === 'Dry Skin') && !hasMagicGuard(f)) {
        dealDamage(f, Math.max(1, Math.floor(f.maxHp / 8)), `${nameOf(f)} sufre daño por ${ab} bajo el sol.`)
      } else if (weather.value === 'Rain' && ab === 'Dry Skin') {
        heal(f, Math.max(1, Math.floor(f.maxHp / 8)))
      }
    }

    // Estado y objeto.
    for (const f of actives) applyResidual(f)
    for (const f of actives) applySaltCure(f)
    for (const side of ['ally', 'enemy'] as SideId[]) {
      for (const slot of aliveSlots(side)) applyLeechSeed(side, slot)
    }
    for (const f of actives) applyLeftovers(f)

    // Fin de turno: envejece el "primer turno" y limpia el retroceso.
    for (const side of ['ally', 'enemy'] as SideId[]) {
      activesOf(side).value.forEach((idx) => {
        if (idx == null) return
        const f = teamOf(side).value[idx]
        // El turno en que entró a mitad de combate no cuenta como turno de acción.
        if (!f.enteredThisTurn) f.turnsActive += 1
        f.enteredThisTurn = false
        f.flinched = false
        f.enduring = false // Aguante solo dura el turno
        f.roosted = false // recupera el tipo Volador al acabar el turno
        if (f.magnetRise > 0) f.magnetRise -= 1 // se agota Levitón
        if (f.taunt > 0) f.taunt -= 1 // se agota la Mofa
        if (f.disableTurns > 0 && --f.disableTurns === 0) f.disableMove = null
        if (f.encoreTurns > 0 && --f.encoreTurns === 0) f.encoreMove = null
      })
    }
  }

  /* ---------- Turno ---------- */

  /** Añade acciones forzadas (carga en curso o recarga) a los slots sin acción. */
  function withForced(side: SideId, provided: SlotAction[]): SlotAction[] {
    const covered = new Set(provided.map((a) => a.slot))
    const result = [...provided]
    const foe: SideId = side === 'ally' ? 'enemy' : 'ally'
    for (const slot of aliveSlots(side)) {
      if (covered.has(slot)) continue
      const f = fighterAt(side, slot)!
      if (f.mustRecharge) result.push({ slot, action: { kind: 'recharge' } })
      else if (f.chargingMove) {
        result.push({
          slot,
          action: { kind: 'move', move: f.chargingMove, target: { side: foe, slot: aliveSlots(foe)[0] ?? 0 } },
        })
      }
    }
    return result
  }

  function submitTurn(allyRaw: SlotAction[], enemyRaw: SlotAction[]) {
    if (phase.value !== 'battle') return
    const allyActions = withForced('ally', allyRaw)
    const enemyActions = withForced('enemy', enemyRaw)

    // Recargas: consumen el turno sin actuar.
    for (const [side, acts] of [['ally', allyActions], ['enemy', enemyActions]] as const) {
      for (const sa of acts) {
        if (sa.action.kind === 'recharge') {
          const f = fighterAt(side, sa.slot)
          if (f) {
            push(`${nameOf(f)} debe recargar.`)
            f.mustRecharge = false
          }
        }
      }
    }

    for (const sa of allyActions) if (sa.action.kind === 'switch') applySwitch('ally', sa.slot, sa.action.index)
    for (const sa of enemyActions) if (sa.action.kind === 'switch') applySwitch('enemy', sa.slot, sa.action.index)

    // Megaevoluciones declaradas este turno (antes de atacar).
    for (const sa of allyActions) if (sa.action.kind === 'move' && sa.action.mega) megaEvolve('ally', sa.slot)
    for (const sa of enemyActions) if (sa.action.kind === 'move' && sa.action.mega) megaEvolve('enemy', sa.slot)

    interface Exec {
      side: SideId
      slot: number
      move: ChampionsMove
      target: MoveTarget
    }
    const execs: Exec[] = []
    for (const sa of allyActions) {
      if (sa.action.kind === 'move') execs.push({ side: 'ally', slot: sa.slot, move: sa.action.move, target: sa.action.target })
    }
    for (const sa of enemyActions) {
      if (sa.action.kind === 'move') execs.push({ side: 'enemy', slot: sa.slot, move: sa.action.move, target: sa.action.target })
    }

    execs.sort((a, b) => {
      const fa = fighterAt(a.side, a.slot)
      const fb = fighterAt(b.side, b.slot)
      const pa = fa ? effectivePriority(fa, a.move) : 0
      const pb = fb ? effectivePriority(fb, b.move) : 0
      if (pa !== pb) return pb - pa
      const sa = fa ? effectiveSpeed(fa) : 0
      const sb = fb ? effectiveSpeed(fb) : 0
      // Espacio Raro invierte el orden por velocidad (el más lento actúa primero).
      if (sa !== sb) return trickRoom.value > 0 ? sa - sb : sb - sa
      return Math.random() < 0.5 ? -1 : 1
    })

    for (const e of execs) {
      const attacker = fighterAt(e.side, e.slot)
      if (!attacker || attacker.fainted) continue
      if (attacker.flinched) {
        push(`${nameOf(attacker)} se amedrentó y no pudo moverse.`)
        continue
      }
      performMove(e.side, e.slot, e.target, e.move)
    }

    endOfTurn()
    const played = turn.value
    turn.value += 1
    resolveAfterTurn()
    if (!silent) currentBranch.value?.states.push(captureFullState(`Turno ${played}`))
  }

  /**
   * Ejecuta un turno en un sandbox: parte del estado dado, aplica las acciones
   * de ambos bandos sobre el motor real (con toda su lógica: megas, pantallas,
   * hazards, habilidades…) y devuelve el estado resultante, SIN tocar el
   * combate real ni el registro ni las ramas. Lo usa la IA para explorar
   * jugadas. Es síncrono y reentrante: guarda el estado real, simula y lo
   * restaura al terminar.
   */
  function simulateTurn(state: FullState, allyActions: SlotAction[], enemyActions: SlotAction[]): FullState {
    const real = captureFullState('__real__')
    const wasSilent = silent
    silent = true
    try {
      restoreFullState(state)
      submitTurn(allyActions, enemyActions)
      return captureFullState(state.label)
    } finally {
      silent = wasSilent
      restoreFullState(real)
    }
  }

  function applySwitch(side: SideId, slot: number, benchIndex: number) {
    // Regenerador: el que se retira recupera 1/3 de sus PS.
    const out = fighterAt(side, slot)
    if (out && !out.fainted && out.ability === 'Regenerator') {
      heal(out, Math.floor(out.maxHp / 3))
    }
    activesOf(side).value[slot] = benchIndex
    const f = teamOf(side).value[benchIndex]
    push(side === 'ally' ? `Cambias a ${nameOf(f)}.` : `El rival cambia a ${nameOf(f)}.`)
    onEnter(side, slot, true)
  }

  /** Slot activo que ocupa un combatiente (o -1 si no está activo). */
  function slotOfActive(side: SideId, f: Fighter): number {
    return activesOf(side).value.findIndex((idx) => idx != null && teamOf(side).value[idx] === f)
  }

  /** Cambio forzado (Rugido/Cola Dragón…): saca al azar a otro del banquillo. */
  function forceSwitch(side: SideId, slot: number) {
    if (slot < 0) return
    const bench = benchAlive(side)
    if (!bench.length) return
    const out = fighterAt(side, slot)
    if (out && !out.fainted && out.ability === 'Regenerator') heal(out, Math.floor(out.maxHp / 3))
    const idx = bench[Math.floor(Math.random() * bench.length)]
    activesOf(side).value[slot] = idx
    push(`¡${nameOf(teamOf(side).value[idx])} entra a la fuerza!`)
    onEnter(side, slot, true)
  }

  function teamWiped(side: SideId): boolean {
    return teamOf(side).value.every((f) => f.fainted)
  }

  /** Mejor daño medio (%) que un combatiente hace a otro con su moveset. */
  function bestDamagePctBetween(attacker: Fighter, defender: Fighter, defenderSide: SideId): number {
    let best = 0
    for (const move of attacker.build.moves ?? []) {
      if (move.power == null || move.category === 'status') continue
      try {
        const r = runCalc({
          attacker: combatantFrom(attacker),
          defender: combatantFrom(defender),
          move,
          field: fieldFor(defenderSide),
          doubles: format.value === 'doubles',
        })
        const pct = (r.minPercent + r.maxPercent) / 2
        if (pct > best) best = pct
      } catch {
        /* movimiento no reconocido */
      }
    }
    return best
  }

  /**
   * Elige a qué Pokémon del banquillo relevar tras un KO. Según la dificultad:
   * en `easy` saca al primero disponible; en `normal`/`hard` elige el de mejor
   * emparejamiento (ofensiva − defensiva) contra los activos rivales.
   */
  function chooseReplacement(side: SideId, bench: number[]): number {
    if (difficulty.value === 'easy' || bench.length <= 1) return bench[0]
    const foeSide: SideId = side === 'ally' ? 'enemy' : 'ally'
    const foes = aliveSlots(foeSide)
      .map((s) => fighterAt(foeSide, s))
      .filter((f): f is Fighter => !!f)
    if (!foes.length) return bench[0]
    let bestIdx = bench[0]
    let bestScore = -Infinity
    for (const idx of bench) {
      const cand = teamOf(side).value[idx]
      let score = 0
      for (const foe of foes) {
        score += bestDamagePctBetween(cand, foe, foeSide) - bestDamagePctBetween(foe, cand, side)
      }
      score /= foes.length
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    }
    return bestIdx
  }

  function resolveAfterTurn() {
    if (teamWiped('ally')) return end('enemy', 'Has perdido el combate.')
    if (teamWiped('enemy')) return end('ally', '¡Has ganado el combate!')

    const queue: { side: SideId; slot: number }[] = []
    for (const side of ['ally', 'enemy'] as SideId[]) {
      // Nº de suplentes vivos disponibles. Cada relevo (aplicado al momento por
      // la IA, o encolado para el jugador) consume uno. Los relevos del jugador
      // no se aplican hasta `resolveReplace`, así que benchAlive no baja solo:
      // este contador evita encolar más huecos que suplentes hay. Los huecos
      // sobrantes quedan vacíos (en dobles se sigue con un solo activo).
      let available = benchAlive(side).length
      activesOf(side).value.forEach((idx, slot) => {
        if (idx != null && teamOf(side).value[idx].fainted) {
          if (available > 0) {
            if (side === 'enemy' && aiEnabled.value) {
              const next = chooseReplacement('enemy', benchAlive('enemy'))
              enemyActives.value[slot] = next
              push(`El rival envía a ${nameOf(enemies.value[next])}.`)
              onEnter('enemy', slot, true)
            } else {
              queue.push({ side, slot })
            }
            available--
          } else {
            activesOf(side).value[slot] = null
          }
        }
      })
    }

    if (queue.length) {
      replaceQueue.value = queue
      phase.value = 'replace'
    } else {
      phase.value = 'battle'
    }
  }

  function end(win: SideId, msg: string) {
    winner.value = win
    phase.value = 'ended'
    push(msg)
  }

  function resolveReplace(benchIndex: number) {
    if (phase.value !== 'replace' || !replaceQueue.value.length) return
    const { side, slot } = replaceQueue.value[0]
    activesOf(side).value[slot] = benchIndex
    push(
      side === 'ally'
        ? `Envías a ${nameOf(teamOf('ally').value[benchIndex])}.`
        : `El rival envía a ${nameOf(teamOf('enemy').value[benchIndex])}.`,
    )
    onEnter(side, slot, true)
    replaceQueue.value = replaceQueue.value.slice(1)
    if (!replaceQueue.value.length) phase.value = 'battle'
  }

  /** Estimación del daño (%) de un movimiento contra un objetivo, con el estado actual. */
  /**
   * Daño estimado (%) de un movimiento. Las suposiciones son hipotéticas y
   * solo afectan a esta previsualización, nunca al combate real.
   */
  function estimateDamagePercent(
    attackerSide: SideId,
    attackerSlot: number,
    move: ChampionsMove,
    defSide: SideId,
    defSlot: number,
    assume: DamageAssumptions = {},
  ): { minPct: number; maxPct: number } | null {
    if (move.power == null || move.category === 'status') return null
    const a = fighterAt(attackerSide, attackerSlot)
    const d = fighterAt(defSide, defSlot)
    if (!a || !d || d.maxHp <= 0) return null
    // Campo hipotético solo para la previsualización (parte de las pantallas reales del rival).
    const field = { ...fieldFor(defSide) }
    if (assume.weather !== undefined) field.weather = assume.weather
    if (assume.terrain !== undefined) field.terrain = assume.terrain
    if (assume.attHelpingHand) field.helpingHand = true
    if (assume.attBattery) field.battery = true
    if (assume.attPowerSpot) field.powerSpot = true
    if (assume.attSteelySpirit) field.steelySpirit = true
    if (assume.defReflect !== undefined) field.reflect = assume.defReflect
    if (assume.defLightScreen !== undefined) field.lightScreen = assume.defLightScreen
    if (assume.defAuroraVeil !== undefined) field.auroraVeil = assume.defAuroraVeil
    if (assume.defFriendGuard) field.friendGuard = true
    const attacker = combatantFrom(a)
    const defender = combatantFrom(d)
    // Suponer megaevolución: usa los stats/tipos/habilidad de la megaforma.
    if (assume.attMega && a.megaForm && !a.megaEvolved) {
      attacker.mon = a.megaForm
      attacker.ability = a.megaForm.abilities[0] ?? attacker.ability
    }
    if (assume.attBoosts) attacker.boosts = assume.attBoosts
    if (assume.attAbility) attacker.ability = assume.attAbility
    if (assume.defMega && d.megaForm && !d.megaEvolved) {
      defender.mon = d.megaForm
      defender.ability = d.megaForm.abilities[0] ?? defender.ability
    }
    if (assume.defBoosts) defender.boosts = assume.defBoosts
    if (assume.defAbility) defender.ability = assume.defAbility
    const r = runCalc({ attacker, defender, move, field, doubles: format.value === 'doubles' })
    return { minPct: (r.minDamage / d.maxHp) * 100, maxPct: (r.maxDamage / d.maxHp) * 100 }
  }

  /**
   * Precisión efectiva (%) de un movimiento contra un rival, o null si no puede
   * fallar (movimientos que nunca fallan, No Guard, o auto-objetivo).
   * Refleja las suposiciones (habilidad, clima, precisión/evasión hipotéticas).
   */
  function estimateAccuracy(
    attackerSide: SideId,
    attackerSlot: number,
    move: ChampionsMove,
    defSide: SideId,
    defSlot: number,
    assume: DamageAssumptions = {},
  ): number | null {
    const a = fighterAt(attackerSide, attackerSlot)
    const d = fighterAt(defSide, defSlot)
    if (!a || !d) return null
    const effect = getMoveEffect(move.name)
    if (effect?.target === 'self') return null // no se lanza contra un rival
    const acc = effect?.accuracy ?? move.accuracy ?? true

    const attAbility =
      assume.attAbility ??
      (assume.attMega && a.megaForm ? a.megaForm.abilities[0] : a.ability) ??
      ''
    const defAbility =
      assume.defAbility ??
      (assume.defMega && d.megaForm ? d.megaForm.abilities[0] : d.ability) ??
      ''
    if (attAbility === 'No Guard' || defAbility === 'No Guard') return 100
    if (acc === true) return null // nunca falla

    const w = assume.weather ?? weather.value
    const accStage = assume.attAccStage ?? a.accStage
    const evaStage = assume.defEvaStage ?? d.evaStage
    let chance = (acc as number) * (accMult(accStage) / accMult(evaStage))

    // Habilidades y objetos que alteran la precisión.
    if (attAbility === 'Compound Eyes') chance *= 1.3
    if (attAbility === 'Victory Star') chance *= 1.1
    if (attAbility === 'Hustle' && move.category === 'physical') chance *= 0.8
    if (a.itemActive && a.build.item === 'Wide Lens') chance *= 1.1
    if (d.itemActive && d.build.item === 'Bright Powder') chance *= 0.9
    if (defAbility === 'Sand Veil' && w === 'Sand') chance *= 0.8
    if (defAbility === 'Snow Cloak' && w === 'Snow') chance *= 0.8

    return Math.max(0, Math.min(100, chance))
  }

  /**
   * Orden de turno de los activos vivos (quién se movería antes): primero por
   * prioridad del movimiento supuesto (Bromista, Alas Vendaval, Ataque Rápido…),
   * luego por velocidad efectiva. Admite suposiciones (clima, velocidad, habilidad,
   * megaforma y el movimiento que usaría cada uno).
   */
  function speedRanking(o?: {
    weather?: Weather
    override?: (
      side: SideId,
      slot: number,
    ) =>
      | { speedStage?: number; ability?: string; mon?: ChampionsMon; move?: ChampionsMove; tailwind?: boolean }
      | undefined
  }): { side: SideId; slot: number; name: string; speed: number; priority: number }[] {
    const list: { side: SideId; slot: number; name: string; speed: number; priority: number }[] = []
    for (const side of ['ally', 'enemy'] as SideId[]) {
      for (const slot of aliveSlots(side)) {
        const f = fighterAt(side, slot)
        if (!f) continue
        const ov = o?.override?.(side, slot)
        const speed = effectiveSpeed(f, {
          weather: o?.weather,
          speedStage: ov?.speedStage,
          ability: ov?.ability,
          mon: ov?.mon,
          tailwind: ov?.tailwind,
        })
        const priority = ov?.move ? effectivePriority(f, ov.move, ov?.ability) : 0
        list.push({ side, slot, name: (ov?.mon ?? f.mon).name, speed, priority })
      }
    }
    return list.sort((a, b) => b.priority - a.priority || b.speed - a.speed)
  }

  function aiActions(): SlotAction[] {
    const targets = aliveSlots('ally')
    let megaPlanned = megaUsed.enemy
    const out: SlotAction[] = []
    for (const slot of aliveSlots('enemy')) {
      const active = fighterAt('enemy', slot)!
      if (active.mustRecharge || active.chargingMove) continue // acción forzada (la inyecta el store)
      const all = active.build.moves ?? []
      const moves = active.lockedMove ? all.filter((m) => m.name === active.lockedMove) : all
      let best: { move: ChampionsMove; target: number; avg: number } | null = null
      for (const move of moves) {
        if (move.power == null || move.category === 'status') continue
        for (const t of targets) {
          const target = fighterAt('ally', t)!
          const r = runCalc({
            attacker: combatantFrom(active),
            defender: combatantFrom(target),
            move,
            field: fieldFor('ally'),
            doubles: format.value === 'doubles',
          })
          const avg = (r.minDamage + r.maxDamage) / 2
          if (!best || avg > best.avg) best = { move, target: t, avg }
        }
      }
      // Megaevoluciona si puede (una vez por combate).
      const mega = !megaPlanned && !!active.megaForm && !active.megaEvolved
      if (mega) megaPlanned = true

      if (best) {
        out.push({ slot, action: { kind: 'move', move: best.move, target: { side: 'ally', slot: best.target }, mega } })
      } else {
        const bench = benchAlive('enemy')
        if (bench.length) out.push({ slot, action: { kind: 'switch', index: bench[0] } })
        else out.push({ slot, action: { kind: 'move', move: moves[0], target: { side: 'ally', slot: targets[0] ?? 0 }, mega } })
      }
    }
    return out
  }

  /** Lanza la búsqueda expectiminimax sobre el estado actual (sin tocar la UI). */
  function runAiSearch(): Promise<SlotAction[]> {
    const state = captureFullState('IA')
    const diff = difficulty.value === 'hard' ? 'hard' : 'normal'
    return chooseAiActions(state, { simulate: simulateTurn, doubles: format.value === 'doubles' }, diff)
  }

  /**
   * Prefetch: la jugada de la IA solo depende del estado al empezar el turno,
   * no de lo que elija el jugador. Así que en cuanto arranca la selección del
   * turno lanzamos el cálculo en segundo plano (troceado, sin congelar la UI);
   * al enviar, `computeAiActions` reutiliza este resultado (normalmente ya
   * listo → respuesta instantánea). Se invalida por número de turno.
   */
  interface AiPrefetch {
    turn: number
    promise: Promise<SlotAction[]>
    done: boolean
  }
  let aiPrefetch: AiPrefetch | null = null

  function clearAiPrefetch() {
    aiPrefetch = null
  }

  function prefetchAiActions() {
    if (!aiEnabled.value || difficulty.value === 'easy' || phase.value !== 'battle') return
    if (aiPrefetch && aiPrefetch.turn === turn.value) return // ya en marcha para este turno
    const rec: AiPrefetch = { turn: turn.value, done: false, promise: runAiSearch() }
    rec.promise.finally(() => {
      rec.done = true
    })
    aiPrefetch = rec
  }

  /**
   * Acciones de la IA para el turno actual, según la dificultad elegida.
   * - `easy`: heurística voraz de 1 turno (síncrona, instantánea).
   * - `normal`/`hard`: expectiminimax (profundidad 1/2). Reutiliza el prefetch
   *   si lo hay; solo muestra "pensando…" si al enviar aún no ha terminado.
   */
  async function computeAiActions(): Promise<SlotAction[]> {
    if (difficulty.value === 'easy') return aiActions()

    const pf = aiPrefetch && aiPrefetch.turn === turn.value ? aiPrefetch : null
    if (pf) {
      aiPrefetch = null
      if (pf.done) return pf.promise // ya calculado durante tu elección → instantáneo
      aiThinking.value = true
      try {
        return await pf.promise
      } finally {
        aiThinking.value = false
      }
    }

    // Sin prefetch válido: cálculo al vuelo con indicador.
    aiThinking.value = true
    try {
      return await runAiSearch()
    } finally {
      aiThinking.value = false
    }
  }

  function reset() {
    clearAiPrefetch()
    phase.value = 'setup'
    allies.value = []
    enemies.value = []
    allyActives.value = []
    enemyActives.value = []
    log.value = []
    winner.value = null
    turn.value = 0
    replaceQueue.value = []
    weather.value = ''
    weatherTurns.value = 0
    terrain.value = ''
    terrainTurns.value = 0
    gravity.value = 0
    trickRoom.value = 0
    hazards.ally = emptyHazards()
    hazards.enemy = emptyHazards()
    sideGuard.ally = emptyGuards()
    sideGuard.enemy = emptyGuards()
    screens.ally = emptyScreens()
    screens.enemy = emptyScreens()
    tailwind.ally = 0
    tailwind.enemy = 0
    safeguard.ally = 0
    safeguard.enemy = 0
    megaUsed.ally = false
    megaUsed.enemy = false
    branches.value = []
    currentBranchId.value = ''
  }

  return {
    format,
    activeCount,
    allies,
    enemies,
    allyActives,
    enemyActives,
    allyFighters,
    enemyFighters,
    field,
    weather,
    terrain,
    gravity,
    trickRoom,
    hazards,
    screens,
    tailwind,
    megaUsed,
    snapshots,
    branches,
    currentBranchId,
    createBranch,
    switchBranch,
    log,
    turn,
    phase,
    winner,
    aiEnabled,
    difficulty,
    aiThinking,
    replaceQueue,
    aliveSlots,
    benchAlive,
    fighterAt,
    start,
    submitTurn,
    resolveReplace,
    aiActions,
    computeAiActions,
    prefetchAiActions,
    moveRestriction,
    estimateDamagePercent,
    estimateAccuracy,
    speedRanking,
    reset,
  }
})

import { Dex } from '@pkmn/dex'
import type { BoostKey, StatusCondition, Terrain, Weather } from '@/types/pokemon'

/**
 * Efectos estructurados de un movimiento, extraídos de @pkmn/dex, para que el
 * simulador pueda reproducir mecánicas reales (subidas de stats, estados,
 * curación, drenaje, retroceso y efectos secundarios).
 */

export type BoostChanges = Partial<Record<BoostKey, number>>

/** Cambios de precisión/evasión (etapas). */
export interface AccEvaChanges {
  accuracy?: number
  evasion?: number
}

/** Campo de peligro que coloca un movimiento. */
export type Hazard = 'stealthrock' | 'spikes' | 'toxicspikes'

export interface SecondaryEffect {
  chance: number
  status?: StatusCondition
  /** Cambios de stat al objetivo. */
  boosts?: BoostChanges
  /** Cambios de stat al usuario. */
  selfBoosts?: BoostChanges
  /** Provoca retroceso (el objetivo no se mueve ese turno si aún no actuó). */
  flinch?: boolean
}

export interface MoveEffect {
  /** Precisión; `true` = no falla nunca. */
  accuracy: number | true
  priority: number
  category: 'Physical' | 'Special' | 'Status'
  /** Objetivo (self, normal, allAdjacentFoes…). */
  target: string
  /** Cambios de stat del efecto principal (self si target = self, si no al rival). */
  boosts?: BoostChanges
  /** Estado que inflige como efecto principal. */
  status?: StatusCondition
  /** Curación [num, den] del usuario (Recover = [1,2]). */
  heal?: [number, number]
  /** Drenaje [num, den] del daño causado. */
  drain?: [number, number]
  /** Retroceso [num, den] del daño causado. */
  recoil?: [number, number]
  /** Cambios de stat que el ataque provoca en el usuario (Onda Ígnea, A Bocajarro). */
  selfBoosts?: BoostChanges
  secondaries?: SecondaryEffect[]
  /** Nº de golpes (fijo o rango [mín, máx]). */
  multihit?: number | [number, number]
  /** Movimiento de protección propia (Protección/Detección y variantes con efecto de contacto). */
  isProtect?: boolean
  /** Tipo de protección propia (para su efecto sobre quien hace contacto). */
  protectKind?: 'protect' | 'spiky' | 'kings' | 'bunker' | 'obstruct' | 'silktrap'
  /** Protección de bando (Vasta Guardia, Anticipo, Escudo Áureo, Escudo Tatami). */
  sideGuard?: 'wide' | 'quick' | 'crafty' | 'mat'
  /** Pantalla que coloca en el bando propio (Reflejo, Pantalla de Luz, Velo Aurora). */
  screen?: 'reflect' | 'lightScreen' | 'auroraVeil'
  /** Viento Afín: dobla la velocidad del bando propio 4 turnos. */
  tailwind?: boolean
  /** Clima que invoca (Día Soleado, Danza Lluvia, Tormenta Arena, Nevada). */
  weather?: Weather
  /** Terreno que invoca (Campo Eléctrico, Herbáceo, Psíquico, Niebla). */
  terrain?: Terrain
  /** Movimiento de sonido (para Insonorizar/Soundproof y Espray Bucal/Throat Spray). */
  sound?: boolean
  /** Campo de peligro que coloca en el lado rival. */
  hazard?: Hazard
  /** Cambios de precisión/evasión del efecto principal (self si target = self). */
  accEva?: AccEvaChanges
  /** El movimiento hace contacto (para Casco Dentado, etc.). */
  contact: boolean
  /** Movimiento de carga (golpea al segundo turno). */
  charge: boolean
  /** Movimiento con recarga (el turno siguiente no puede actuar). */
  recharge: boolean
}

const STAT_MAP: Record<string, BoostKey> = {
  atk: 'attack',
  def: 'defense',
  spa: 'spAttack',
  spd: 'spDefense',
  spe: 'speed',
}

const STATUSES: StatusCondition[] = ['brn', 'par', 'psn', 'tox', 'slp', 'frz']

function mapBoosts(raw: Record<string, number> | undefined): BoostChanges | undefined {
  if (!raw) return undefined
  const out: BoostChanges = {}
  for (const [k, v] of Object.entries(raw)) {
    const key = STAT_MAP[k]
    if (key) out[key] = v
  }
  return Object.keys(out).length ? out : undefined
}

function asStatus(s: unknown): StatusCondition | undefined {
  return typeof s === 'string' && (STATUSES as string[]).includes(s)
    ? (s as StatusCondition)
    : undefined
}

function accEvaOf(raw: Record<string, number> | undefined): AccEvaChanges | undefined {
  if (!raw) return undefined
  const out: AccEvaChanges = {}
  if (typeof raw.accuracy === 'number') out.accuracy = raw.accuracy
  if (typeof raw.evasion === 'number') out.evasion = raw.evasion
  return out.accuracy !== undefined || out.evasion !== undefined ? out : undefined
}

const HAZARDS: Hazard[] = ['stealthrock', 'spikes', 'toxicspikes']

/** volatileStatus → tipo de protección propia. */
const PROTECT_KIND: Record<string, MoveEffect['protectKind']> = {
  protect: 'protect',
  detect: 'protect',
  spikyshield: 'spiky',
  kingsshield: 'kings',
  banefulbunker: 'bunker',
  obstruct: 'obstruct',
  silktrap: 'silktrap',
}

/** sideCondition → tipo de protección de bando. */
const SIDE_GUARD: Record<string, MoveEffect['sideGuard']> = {
  wideguard: 'wide',
  quickguard: 'quick',
  craftyshield: 'crafty',
  matblock: 'mat',
}

/** sideCondition → pantalla que coloca en el bando propio. */
const SCREEN: Record<string, MoveEffect['screen']> = {
  reflect: 'reflect',
  lightscreen: 'lightScreen',
  auroraveil: 'auroraVeil',
}

/** `weather` de @pkmn/dex → clima de Champions. */
const WEATHER_MOVE: Record<string, Weather> = {
  sunnyday: 'Sun',
  desolateland: 'Sun',
  raindance: 'Rain',
  primordialsea: 'Rain',
  sandstorm: 'Sand',
  snow: 'Snow',
  snowscape: 'Snow',
  hail: 'Snow',
}

/** `terrain` de @pkmn/dex (normalizado a solo letras) → terreno de Champions. */
const TERRAIN_MOVE: Record<string, Terrain> = {
  electricterrain: 'Electric',
  grassyterrain: 'Grassy',
  psychicterrain: 'Psychic',
  mistyterrain: 'Misty',
}

/**
 * Ajustes de Champions al % de efecto secundario (la BD de @pkmn/dex trae el
 * valor estándar). Fuente: Serebii "Updated Attacks". Ampliable a medida que se
 * documenten más; se aplica a TODOS los secundarios del movimiento.
 */
const CHAMPIONS_SECONDARY_CHANCE: Record<string, number> = {
  'Iron Head': 20, // retroceso 30% → 20%
  Moonblast: 10, // baja At. Esp. 30% → 10%
  'Dire Claw': 30, // estado 50% → 30%
}

const cache = new Map<string, MoveEffect | null>()

export function getMoveEffect(name: string): MoveEffect | null {
  if (cache.has(name)) return cache.get(name)!

  const m = Dex.moves.get(name)
  if (!m || !m.exists) {
    cache.set(name, null)
    return null
  }

  const chanceOverride = CHAMPIONS_SECONDARY_CHANCE[name]
  const secondariesRaw = (m.secondaries ?? (m.secondary ? [m.secondary] : [])) as any[]
  const secondaries: SecondaryEffect[] = secondariesRaw.map((s) => ({
    chance: chanceOverride ?? s.chance ?? 100,
    status: asStatus(s.status),
    boosts: mapBoosts(s.boosts),
    selfBoosts: mapBoosts(s.self?.boosts),
    flinch: s.volatileStatus === 'flinch',
  }))

  const effect: MoveEffect = {
    accuracy: m.accuracy === true ? true : (m.accuracy as number),
    priority: m.priority ?? 0,
    category: m.category as MoveEffect['category'],
    target: m.target,
    boosts: mapBoosts(m.boosts as Record<string, number> | undefined),
    status: asStatus(m.status),
    heal: m.heal ? [m.heal[0], m.heal[1]] : undefined,
    drain: m.drain ? [m.drain[0], m.drain[1]] : undefined,
    recoil: m.recoil ? [m.recoil[0], m.recoil[1]] : undefined,
    selfBoosts: mapBoosts((m.self as { boosts?: Record<string, number> } | undefined)?.boosts),
    secondaries: secondaries.length ? secondaries : undefined,
    multihit: m.multihit as number | [number, number] | undefined,
    isProtect: !!PROTECT_KIND[(m as { volatileStatus?: string }).volatileStatus ?? ''],
    protectKind: PROTECT_KIND[(m as { volatileStatus?: string }).volatileStatus ?? ''],
    sideGuard: SIDE_GUARD[(m as { sideCondition?: string }).sideCondition ?? ''],
    screen: SCREEN[(m as { sideCondition?: string }).sideCondition ?? ''],
    tailwind: (m as { sideCondition?: string }).sideCondition === 'tailwind',
    weather: WEATHER_MOVE[((m as { weather?: string }).weather ?? '').toLowerCase()],
    terrain: TERRAIN_MOVE[((m as { terrain?: string }).terrain ?? '').toLowerCase().replace(/[^a-z]/g, '')],
    // Champions reclasifica Ánimo Dragón (Dragon Cheer) como movimiento de sonido.
    sound: !!(m.flags as { sound?: number } | undefined)?.sound || name === 'Dragon Cheer',
    hazard: HAZARDS.includes((m as { sideCondition?: string }).sideCondition as Hazard)
      ? ((m as { sideCondition?: string }).sideCondition as Hazard)
      : undefined,
    accEva: accEvaOf(m.boosts as Record<string, number> | undefined),
    contact: !!(m.flags && (m.flags as { contact?: number }).contact),
    charge: !!(m.flags && (m.flags as { charge?: number }).charge),
    recharge: !!(m.flags && (m.flags as { recharge?: number }).recharge),
  }

  cache.set(name, effect)
  return effect
}

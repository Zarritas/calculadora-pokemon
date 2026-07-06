import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ChampionsMon, ChampionsMove } from '@/types/pokemon'
import type { SavedBuild } from '@/types/library'
import { zeroStatPoints } from '@/utils/champions'

// Evita la descarga del roster (fetch a GitHub) durante el test: sin megas.
vi.mock('@/services/championsData', () => ({
  getRoster: async () => [],
}))

import { useSimulatorStore, type SlotAction } from '@/stores/simulator'

function mon(name: string, types: ChampionsMon['types'], baseStats: ChampionsMon['baseStats']): ChampionsMon {
  return { name, dexNumber: 1, form: 'Base', types, abilities: ['Pressure'], baseStats, sprite: '', spriteBase: '' }
}

function mv(o: Partial<ChampionsMove>): ChampionsMove {
  return { name: 'Body Slam', type: 'normal', category: 'physical', power: 85, accuracy: 100, pp: 15, priority: 0, ...o }
}

let counter = 0
function build(m: ChampionsMon, moves: ChampionsMove[]): SavedBuild {
  return {
    id: `b${counter++}`,
    name: m.name,
    mon: m,
    build: { statPoints: zeroStatPoints(), nature: 'Serious' },
    item: null,
    status: '',
    ability: m.abilities[0],
    moves,
  }
}

const tauros = () =>
  mon('Tauros', ['normal'], { hp: 75, attack: 100, defense: 95, spAttack: 40, spDefense: 70, speed: 110 })
const venusaur = () =>
  mon('Venusaur', ['grass', 'poison'], { hp: 80, attack: 82, defense: 83, spAttack: 100, spDefense: 100, speed: 80 })

describe('simulador: IA expectiminimax + simulateTurn (motor real)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  async function startBattle(diff: 'normal' | 'hard') {
    const sim = useSimulatorStore()
    const ally = [build(tauros(), [mv({ name: 'Body Slam' })]), build(venusaur(), [mv({ name: 'Sludge Bomb', type: 'poison', category: 'special', power: 90 })])]
    const enemy = [
      build(venusaur(), [mv({ name: 'Sludge Bomb', type: 'poison', category: 'special', power: 90 }), mv({ name: 'Growl', category: 'status', power: null })]),
      build(tauros(), [mv({ name: 'Body Slam' })]),
    ]
    await sim.start(ally, enemy, true, 'singles', diff)
    return sim
  }

  it('computeAiActions (normal) devuelve una jugada válida sin tocar el estado real', async () => {
    const sim = await startBattle('normal')
    const logBefore = sim.log.length
    const turnBefore = sim.turn
    const branchStatesBefore = sim.branches[0].states.length
    const enemyHpBefore = sim.enemies.map((f) => f.hp)
    const allyHpBefore = sim.allies.map((f) => f.hp)

    const actions = await sim.computeAiActions()

    // Jugada válida.
    expect(actions.length).toBe(1)
    expect(actions[0].slot).toBe(0)
    expect(['move', 'switch']).toContain(actions[0].action.kind)

    // El estado real NO se ha alterado por las simulaciones.
    expect(sim.log.length).toBe(logBefore)
    expect(sim.turn).toBe(turnBefore)
    expect(sim.branches[0].states.length).toBe(branchStatesBefore)
    expect(sim.enemies.map((f) => f.hp)).toEqual(enemyHpBefore)
    expect(sim.allies.map((f) => f.hp)).toEqual(allyHpBefore)
    expect(sim.aiThinking).toBe(false)
  })

  it('computeAiActions (hard, profundidad 2) también resuelve sin contaminar el estado', async () => {
    const sim = await startBattle('hard')
    const logBefore = sim.log.length

    const actions = await sim.computeAiActions()

    expect(actions.length).toBe(1)
    expect(['move', 'switch']).toContain(actions[0].action.kind)
    expect(sim.log.length).toBe(logBefore)
    expect(sim.aiThinking).toBe(false)
  })

  it('el prefetch precalcula la jugada: al enviar sale lista y sin marcar "pensando"', async () => {
    const sim = await startBattle('normal')
    const logBefore = sim.log.length
    const allyHpBefore = sim.allies.map((f) => f.hp)

    // Simula el flujo real: arranca el prefetch al empezar el turno…
    sim.prefetchAiActions()
    // …y el jugador "tarda" en elegir (dando tiempo a que termine en segundo plano).
    await new Promise((r) => setTimeout(r, 700))

    // Al enviar, computeAiActions reutiliza el prefetch ya resuelto (instantáneo).
    const actions = await sim.computeAiActions()
    expect(actions.length).toBe(1)
    expect(['move', 'switch']).toContain(actions[0].action.kind)
    // Ya estaba calculado: nunca se marcó "pensando".
    expect(sim.aiThinking).toBe(false)
    // El estado real no se tocó durante el prefetch.
    expect(sim.log.length).toBe(logBefore)
    expect(sim.allies.map((f) => f.hp)).toEqual(allyHpBefore)
  })

  it('prefetchAiActions es idempotente en el mismo turno (no rompe al llamarlo dos veces)', async () => {
    const sim = await startBattle('normal')
    sim.prefetchAiActions()
    sim.prefetchAiActions()
    const actions = await sim.computeAiActions()
    expect(actions.length).toBe(1)
    expect(sim.aiThinking).toBe(false)
  })

  it('el clima fijado en el campo dura 5 turnos y luego se disipa (no es permanente)', async () => {
    const sim = useSimulatorStore()
    sim.field.weather = 'Sun'
    // Sin IA y con Gruñido (estado, sin daño): nadie se debilita en 5 turnos.
    const ally = [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])]
    const enemy = [build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])]
    await sim.start(ally, enemy, false, 'singles', 'easy')
    expect(sim.weather).toBe('Sun')

    const growl = (side: 'ally' | 'enemy'): SlotAction[] => [
      { slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: side === 'ally' ? 'enemy' : 'ally', slot: 0 } } },
    ]

    for (let t = 1; t <= 4; t++) {
      sim.submitTurn(growl('ally'), growl('enemy'))
      expect(sim.weather).toBe('Sun') // sigue activo turnos 1–4
    }
    sim.submitTurn(growl('ally'), growl('enemy')) // 5º turno
    expect(sim.weather).toBe('') // se disipa
  })

  it('el movimiento Día Soleado invoca el sol', async () => {
    const sim = useSimulatorStore()
    const ally = [build(tauros(), [mv({ name: 'Sunny Day', category: 'status', power: null })])]
    const enemy = [build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])]
    await sim.start(ally, enemy, false, 'singles', 'easy')
    expect(sim.weather).toBe('')

    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Sunny Day', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.weather).toBe('Sun')
  })

  it('el movimiento Campo Eléctrico invoca el terreno', async () => {
    const sim = useSimulatorStore()
    const ally = [build(tauros(), [mv({ name: 'Electric Terrain', category: 'status', power: null })])]
    const enemy = [build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])]
    await sim.start(ally, enemy, false, 'singles', 'easy')
    expect(sim.terrain).toBe('')

    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Electric Terrain', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.terrain).toBe('Electric')
  })

  const waterMon = () =>
    mon('Vaporeon', ['water'], { hp: 130, attack: 65, defense: 60, spAttack: 110, spDefense: 95, speed: 65 })
  const fireMon = () =>
    mon('Charizard', ['fire', 'flying'], { hp: 78, attack: 84, defense: 78, spAttack: 109, spDefense: 85, speed: 100 })
  const grassMon = () =>
    mon('Venusaur', ['grass', 'poison'], { hp: 80, attack: 82, defense: 83, spAttack: 100, spDefense: 100, speed: 80 })

  /** Prepara: activo rival a punto de caer, banquillo = [fuego (malo), hierba (bueno)] vs un Agua aliado. */
  async function koScenario(diff: 'easy' | 'normal') {
    const sim = useSimulatorStore()
    const ally = [build(waterMon(), [mv({ name: 'Surf', type: 'water', category: 'special', power: 90 })])]
    const enemy = [
      build(tauros(), [mv({ name: 'Body Slam' })]), // índice 0: activo, caerá
      build(fireMon(), [mv({ name: 'Flamethrower', type: 'fire', category: 'special', power: 90 })]), // 1: fuego (malo vs Agua)
      build(grassMon(), [mv({ name: 'Energy Ball', type: 'grass', category: 'special', power: 90 })]), // 2: hierba (bueno vs Agua)
    ]
    await sim.start(ally, enemy, true, 'singles', diff)
    sim.enemies[0].hp = 1 // el activo rival cae con cualquier golpe
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Surf', type: 'water', category: 'special', power: 90 }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    return sim
  }

  it('relevo tras KO (normal): la IA saca el mejor emparejamiento del banquillo', async () => {
    const sim = await koScenario('normal')
    expect(sim.enemies[0].fainted).toBe(true)
    // Contra un Agua, debe entrar la Hierba (índice 2), no el Fuego (índice 1).
    expect(sim.enemyActives[0]).toBe(2)
  })

  it('relevo tras KO (easy): la IA saca al primero del banquillo, sin estrategia', async () => {
    const sim = await koScenario('easy')
    expect(sim.enemies[0].fainted).toBe(true)
    expect(sim.enemyActives[0]).toBe(1) // primero disponible
  })

  it('dobles: con un solo suplente y dos activos K.O. no se bloquea el relevo', async () => {
    const sim = useSimulatorStore()
    // Aliado: 2 activos (0, 1) + 1 suplente (2). Rival: 2 activos.
    const growl = () => mv({ name: 'Growl', category: 'status', power: null })
    const ally = [build(tauros(), [growl()]), build(tauros(), [growl()]), build(venusaur(), [growl()])]
    const enemy = [build(tauros(), [mv({ name: 'Body Slam' })]), build(tauros(), [mv({ name: 'Body Slam' })])]
    await sim.start(ally, enemy, false, 'doubles', 'easy')

    // Ambos activos aliados caerán con cualquier golpe.
    sim.allies[0].hp = 1
    sim.allies[1].hp = 1

    const allyGrowl = (slot: number): SlotAction => ({
      slot,
      action: { kind: 'move', move: growl(), target: { side: 'enemy', slot: 0 } },
    })
    const slam = (slot: number, target: number): SlotAction => ({
      slot,
      action: { kind: 'move', move: mv({ name: 'Body Slam' }), target: { side: 'ally', slot: target } },
    })
    sim.submitTurn([allyGrowl(0), allyGrowl(1)], [slam(0, 0), slam(1, 1)])

    // Los dos activos aliados han caído.
    expect(sim.allies[0].fainted).toBe(true)
    expect(sim.allies[1].fainted).toBe(true)

    // Con un único suplente solo se pide UN relevo (antes se encolaban dos → bloqueo).
    expect(sim.phase).toBe('replace')
    expect(sim.replaceQueue.length).toBe(1)

    // Se resuelve y el combate sigue: el otro hueco queda vacío.
    sim.resolveReplace(2)
    expect(sim.phase).toBe('battle')
    expect(sim.allyActives[0]).toBe(2)
    expect(sim.allyActives[1]).toBe(null)
  })

  const growlBoth = (sim: ReturnType<typeof useSimulatorStore>) => {
    const growl = (foe: 'ally' | 'enemy'): SlotAction[] => [
      { slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: foe, slot: 0 } } },
    ]
    sim.submitTurn(growl('enemy'), growl('ally'))
  }

  async function statusScenario() {
    const sim = useSimulatorStore()
    const ally = [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])]
    const enemy = [build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])]
    await sim.start(ally, enemy, false, 'singles', 'easy')
    return sim
  }

  it('sueño (Champions): el 1.er turno no se mueve; al 3.er turno despierta seguro', async () => {
    const sim = await statusScenario()
    sim.allies[0].status = 'slp'
    sim.allies[0].sleepTurns = 0

    // Turno 1 de sueño: seguro dormido.
    growlBoth(sim)
    expect(sim.allies[0].status).toBe('slp')
    expect(sim.allies[0].sleepTurns).toBe(1)

    // Escenario de 3.er turno de sueño: despierta seguro (100%).
    sim.allies[0].sleepTurns = 2
    growlBoth(sim)
    expect(sim.allies[0].status).toBe('')
  })

  it('congelación (Champions): se descongela seguro al 3.er turno', async () => {
    const sim = await statusScenario()
    sim.allies[0].status = 'frz'
    sim.allies[0].freezeTurns = 2 // el siguiente intento es el 3.er turno
    growlBoth(sim)
    expect(sim.allies[0].status).toBe('')
  })

  it('Respiro aterriza al Volador: Terremoto le pega (antes inmune)', async () => {
    const sim = useSimulatorStore()
    // Pidgeot es Volador puro (aquí Normal/Volador → uso Volador puro para el caso claro).
    // Volador puro y rápido (usa Respiro ANTES de recibir el Terremoto del lento Golem).
    const flyer = mon('Tornadus', ['flying'], { hp: 79, attack: 115, defense: 70, spAttack: 125, spDefense: 80, speed: 111 })
    const digger = mon('Golem', ['rock', 'ground'], { hp: 80, attack: 120, defense: 130, spAttack: 55, spDefense: 65, speed: 45 })
    const ally = [build(digger, [mv({ name: 'Earthquake', type: 'ground', category: 'physical', power: 100 })])]
    const enemy = [build(flyer, [mv({ name: 'Roost', category: 'status', power: null })])]
    await sim.start(ally, enemy, false, 'singles', 'easy')

    const hpBefore = sim.enemies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Earthquake', type: 'ground', category: 'physical', power: 100 }), target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Roost', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
    )
    // El Volador usó Respiro (más lento), quedó aterrizado y el Terremoto le pegó.
    expect(sim.enemies[0].hp).toBeLessThan(hpBefore)
    // Al acabar el turno recupera el tipo (roosted vuelve a false).
    expect(sim.enemies[0].roosted).toBe(false)
  })

  const pureFlyer = () =>
    mon('Tornadus', ['flying'], { hp: 100, attack: 100, defense: 90, spAttack: 110, spDefense: 90, speed: 111 })
  const groundAtk = (moves: ChampionsMove[]) =>
    build(mon('Golem', ['ground'], { hp: 90, attack: 120, defense: 130, spAttack: 55, spDefense: 65, speed: 45 }), moves)
  const EQ = () => mv({ name: 'Earthquake', type: 'ground', category: 'physical', power: 100 })
  const move1 = (m: ChampionsMove): SlotAction[] => [{ slot: 0, action: { kind: 'move', move: m, target: { side: 'enemy', slot: 0 } } }]
  const self1 = (m: ChampionsMove): SlotAction[] => [{ slot: 0, action: { kind: 'move', move: m, target: { side: 'ally', slot: 0 } } }]

  it('Buenazo aterriza al Volador: después Terremoto le pega', async () => {
    const sim = useSimulatorStore()
    const smackDown = mv({ name: 'Smack Down', type: 'rock', category: 'physical', power: 50 })
    await sim.start([groundAtk([smackDown, EQ()])], [build(pureFlyer(), [mv({ name: 'Roost', category: 'status', power: null })])], false, 'singles', 'easy')

    sim.submitTurn(move1(smackDown), [])
    expect(sim.enemies[0].smackedDown).toBe(true)
    const hp = sim.enemies[0].hp
    sim.submitTurn(move1(EQ()), [])
    expect(sim.enemies[0].hp).toBeLessThan(hp) // Terremoto ya le afecta
  })

  it('Anegar cambia el tipo del objetivo a Agua', async () => {
    const sim = useSimulatorStore()
    const soak = mv({ name: 'Soak', category: 'status', power: null })
    await sim.start([groundAtk([soak])], [build(pureFlyer(), [mv({ name: 'Roost', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.submitTurn(move1(soak), [])
    expect(sim.enemies[0].typeOverride).toEqual(['water'])
  })

  it('Levitón hace al usuario inmune a Tierra', async () => {
    const sim = useSimulatorStore()
    const magnetRise = mv({ name: 'Magnet Rise', category: 'status', power: null })
    // Tauros (rápido) usa Levitón antes de que el Golem (lento) use Terremoto.
    await sim.start([groundAtk([EQ()])], [build(tauros(), [magnetRise])], false, 'singles', 'easy')
    const hp = sim.enemies[0].hp
    sim.submitTurn(move1(EQ()), self1(magnetRise))
    expect(sim.enemies[0].magnetRise).toBeGreaterThan(0)
    expect(sim.enemies[0].hp).toBe(hp) // Terremoto no le hizo nada
  })

  it('Gravedad aterriza al Volador y dura 5 turnos', async () => {
    const sim = useSimulatorStore()
    const gravityMove = mv({ name: 'Gravity', category: 'status', power: null })
    await sim.start([groundAtk([gravityMove, EQ()])], [build(pureFlyer(), [mv({ name: 'Roost', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.submitTurn(move1(gravityMove), [])
    expect(sim.gravity).toBe(4) // 5 al usarse, −1 al acabar el turno
    const hp = sim.enemies[0].hp
    sim.submitTurn(move1(EQ()), [])
    expect(sim.enemies[0].hp).toBeLessThan(hp) // Terremoto le pega bajo Gravedad
  })

  it('Spicy Spray (habilidad de Champions) quema al atacante al recibir daño', async () => {
    const sim = useSimulatorStore()
    const attacker = build(tauros(), [mv({ name: 'Body Slam' })])
    const defender = build(mon('Grafaiai', ['poison', 'normal'], { hp: 63, attack: 95, defense: 65, spAttack: 80, spDefense: 72, speed: 110 }), [mv({ name: 'Growl', category: 'status', power: null })])
    defender.ability = 'Spicy Spray'
    await sim.start([attacker], [defender], false, 'singles', 'easy')
    // El aliado (Tauros) golpea al rival con Spicy Spray → se quema.
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Body Slam' }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.allies[0].status).toBe('brn')
  })

  it('Eelevate (habilidad de Champions) da inmunidad a Tierra y a estados', async () => {
    const sim = useSimulatorStore()
    const eel = build(mon('Eelektross', ['electric'], { hp: 85, attack: 115, defense: 80, spAttack: 105, spDefense: 80, speed: 50 }), [mv({ name: 'Growl', category: 'status', power: null })])
    eel.ability = 'Eelevate'
    await sim.start([groundAtk([EQ(), mv({ name: 'Spore', category: 'status', power: null })])], [eel], false, 'singles', 'easy')
    const hp = sim.enemies[0].hp
    // Terremoto no le afecta (inmune a Tierra) y Espora tampoco (inmune a estados).
    sim.submitTurn(move1(EQ()), [])
    expect(sim.enemies[0].hp).toBe(hp)
    sim.submitTurn(move1(mv({ name: 'Spore', category: 'status', power: null })), [])
    expect(sim.enemies[0].status).toBe('')
  })

  it('Salazón (Salt Cure) inflige daño residual cada turno', async () => {
    const sim = useSimulatorStore()
    const saltCure = mv({ name: 'Salt Cure', type: 'rock', category: 'physical', power: 40 })
    await sim.start([groundAtk([saltCure])], [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.submitTurn(move1(saltCure), [])
    expect(sim.enemies[0].saltCure).toBe(true)
    const hp = sim.enemies[0].hp
    // Otro turno: el daño residual de Salazón le resta vida aunque no le ataquen.
    sim.submitTurn([], [])
    expect(sim.enemies[0].hp).toBeLessThan(hp)
  })

  it('Puño Furia (Rage Fist) sube de potencia con cada golpe recibido', async () => {
    const sim = useSimulatorStore()
    const rageFist = mv({ name: 'Rage Fist', type: 'ghost', category: 'physical', power: 50 })
    const waterGun = mv({ name: 'Water Gun', type: 'water', category: 'special', power: 40 })
    // Usuario rápido (ataca antes de que le peguen) y rival lento, muy defensivo (aguanta).
    const user = build(mon('Annihilape', ['fighting', 'ghost'], { hp: 90, attack: 115, defense: 80, spAttack: 50, spDefense: 90, speed: 130 }), [rageFist])
    const wall = build(mon('Muro', ['water'], { hp: 160, attack: 50, defense: 150, spAttack: 50, spDefense: 150, speed: 40 }), [waterGun])
    await sim.start([user], [wall], false, 'singles', 'easy')

    const rage = (): SlotAction[] => [{ slot: 0, action: { kind: 'move', move: rageFist, target: { side: 'enemy', slot: 0 } } }]
    const water = (): SlotAction[] => [{ slot: 0, action: { kind: 'move', move: waterGun, target: { side: 'ally', slot: 0 } } }]

    const hp0 = sim.enemies[0].hp
    sim.submitTurn(rage(), water()) // Puño Furia con 0 golpes (pot. 50); luego recibe Water Gun → timesHit 1
    const hp1 = sim.enemies[0].hp
    sim.submitTurn(rage(), water()) // Puño Furia con 1 golpe (pot. 100) → más daño
    const hp2 = sim.enemies[0].hp

    expect(sim.allies[0].timesHit).toBe(2)
    expect(hp0 - hp1).toBeGreaterThan(0) // hizo daño
    expect(hp1 - hp2).toBeGreaterThan(hp0 - hp1) // el segundo golpe pega más (potencia escalada)
  })

  it('Piercing Drill atraviesa la protección (con ¼ de daño)', async () => {
    const sim = useSimulatorStore()
    const driller = build(tauros(), [mv({ name: 'Body Slam' })])
    driller.ability = 'Piercing Drill'
    // Protección con prioridad +4: se activa antes del golpe.
    const protectMove = mv({ name: 'Protect', category: 'status', power: null, priority: 4 })
    const protector = build(venusaur(), [protectMove])
    await sim.start([driller], [protector], false, 'singles', 'easy')
    const hp = sim.enemies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Body Slam' }), target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: protectMove, target: { side: 'enemy', slot: 0 } } }],
    )
    // Aun protegido, recibe algo de daño (¼) por Piercing Drill.
    expect(sim.enemies[0].hp).toBeLessThan(hp)
  })

  it('Eelevate sube la estadística más alta al debilitar a un rival', async () => {
    const sim = useSimulatorStore()
    const eel = build(mon('Eelektross', ['electric'], { hp: 85, attack: 130, defense: 80, spAttack: 105, spDefense: 80, speed: 120 }), [mv({ name: 'Thunder Punch', type: 'electric', category: 'physical', power: 75 })])
    eel.ability = 'Eelevate'
    const frail = build(mon('Frágil', ['normal'], { hp: 1, attack: 10, defense: 10, spAttack: 10, spDefense: 10, speed: 5 }), [mv({ name: 'Growl', category: 'status', power: null })])
    await sim.start([eel], [frail], false, 'singles', 'easy')
    sim.enemies[0].hp = 1 // se debilita con el golpe
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Thunder Punch', type: 'electric', category: 'physical', power: 75 }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemies[0].fainted).toBe(true)
    // Su Ataque (la stat más alta de este Eelektross) subió +1.
    expect(sim.allies[0].boosts.attack).toBe(1)
  })

  it('Insonorizar (Soundproof) hace inmune a los movimientos de sonido', async () => {
    const sim = useSimulatorStore()
    const target = build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])
    target.ability = 'Soundproof'
    // Gruñido es un movimiento de sonido: no debería bajar el ataque.
    const growler = build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])
    await sim.start([growler], [target], false, 'singles', 'easy')
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemies[0].boosts.attack).toBe(0) // inmune: no bajó
  })

  it('Espray Bucal (Throat Spray) sube At. Esp. al usar un movimiento de sonido', async () => {
    const sim = useSimulatorStore()
    const singer = build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])
    singer.item = 'Throat Spray'
    await sim.start([singer], [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.allies[0].boosts.spAttack).toBe(1)
    expect(sim.allies[0].itemActive).toBe(false) // consumido
  })

  it('Espacio Raro invierte el orden: el más lento actúa primero', async () => {
    const sim = useSimulatorStore()
    // Aliado lento con Espacio Raro + un ataque; rival rápido.
    const trickRoom = mv({ name: 'Trick Room', category: 'status', power: null })
    const slow = build(mon('Torkoal', ['fire'], { hp: 70, attack: 85, defense: 140, spAttack: 85, spDefense: 70, speed: 20 }), [trickRoom, mv({ name: 'Body Slam' })])
    const fast = build(mon('Jolteon', ['electric'], { hp: 65, attack: 65, defense: 60, spAttack: 110, spDefense: 95, speed: 130 }), [mv({ name: 'Body Slam' })])
    await sim.start([slow], [fast], false, 'singles', 'easy')

    // Turno 1: el lento pone Espacio Raro (el rival usa Gruñido, sin riesgo de parálisis).
    const growlT1 = mv({ name: 'Growl', category: 'status', power: null })
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: trickRoom, target: { side: 'ally', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: growlT1, target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.trickRoom).toBe(4) // 5 al usarse, −1 al acabar el turno

    // Turno 2: ambos usan Gruñido; con Espacio Raro, el lento (aliado) actúa primero.
    const logLen = sim.log.length
    const growl = mv({ name: 'Growl', category: 'status', power: null })
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: growl, target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: growl, target: { side: 'ally', slot: 0 } } }],
    )
    const turn2 = sim.log.slice(logLen)
    const idxSlow = turn2.findIndex((l) => l.includes('Torkoal usó'))
    const idxFast = turn2.findIndex((l) => l.includes('Jolteon usó'))
    expect(idxSlow).toBeGreaterThanOrEqual(0)
    expect(idxSlow).toBeLessThan(idxFast) // el lento actuó antes
  })

  it('Aguante deja al Pokémon con 1 PS ante un golpe letal', async () => {
    const sim = useSimulatorStore()
    const endure = mv({ name: 'Endure', category: 'status', power: null, priority: 4 })
    // Frágil y débil a Tierra: el Terremoto sería letal sin Aguante.
    const endurer = build(mon('Frágil', ['fire'], { hp: 45, attack: 50, defense: 40, spAttack: 50, spDefense: 40, speed: 5 }), [endure])
    const hitter = build(groundAtk([EQ()]).mon, [EQ()]) // Golem con Terremoto
    await sim.start([endurer], [hitter], false, 'singles', 'easy')
    sim.allies[0].hp = 10 // a punto de caer
    // Aguante (prioridad +4) va primero y sobrevive al Terremoto letal.
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: endure, target: { side: 'ally', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: EQ(), target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.allies[0].fainted).toBe(false)
    expect(sim.allies[0].hp).toBe(1)
  })

  it('Rugido fuerza el cambio del rival (sale otro del banquillo)', async () => {
    const sim = useSimulatorStore()
    const roar = mv({ name: 'Roar', category: 'status', power: null, priority: -6 })
    const enemyTeam = [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })]), build(venusaur(), [mv({ name: 'Growl', category: 'status', power: null })])]
    await sim.start([build(venusaur(), [roar])], enemyTeam, false, 'singles', 'easy')
    expect(sim.enemyActives[0]).toBe(0) // Tauros activo
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: roar, target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemyActives[0]).toBe(1) // forzado a Venusaur (único del banquillo)
  })

  it('Vuelo hace semiinvulnerable: un ataque normal falla mientras carga', async () => {
    const sim = useSimulatorStore()
    const fly = mv({ name: 'Fly', type: 'flying', category: 'physical', power: 90 })
    // Volador rápido: usa Vuelo antes de que le ataque el rival lento.
    const flyer = build(mon('Talonflame', ['fire', 'flying'], { hp: 78, attack: 81, defense: 71, spAttack: 74, spDefense: 69, speed: 126 }), [fly])
    const slowHitter = build(mon('Snorlax', ['normal'], { hp: 160, attack: 110, defense: 65, spAttack: 65, spDefense: 110, speed: 30 }), [mv({ name: 'Body Slam' })])
    await sim.start([flyer], [slowHitter], false, 'singles', 'easy')
    const hp = sim.allies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: fly, target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Body Slam' }), target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.allies[0].chargingMove).toBeTruthy() // sigue cargando Vuelo (arriba)
    expect(sim.allies[0].hp).toBe(hp) // el ataque falló: estaba fuera de alcance
  })

  it('Terremoto sí golpea a un objetivo bajo tierra (Excavar)', async () => {
    const sim = useSimulatorStore()
    const dig = mv({ name: 'Dig', type: 'ground', category: 'physical', power: 80 })
    // Excavador rápido: se entierra antes del Terremoto del Golem lento.
    const digger = build(mon('Excadrill', ['ground', 'steel'], { hp: 110, attack: 135, defense: 60, spAttack: 50, spDefense: 65, speed: 88 }), [dig])
    await sim.start([digger], [groundAtk([EQ()])], false, 'singles', 'easy')
    const hp = sim.allies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: dig, target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: EQ(), target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.allies[0].chargingMove).toBeTruthy() // sigue bajo tierra
    expect(sim.allies[0].hp).toBeLessThan(hp) // Terremoto alcanza bajo tierra
  })

  it('la baya reductora de tipo se consume tras amortiguar un golpe supereficaz', async () => {
    const sim = useSimulatorStore()
    // Yache Berry reduce un golpe de Hielo supereficaz. Defensor Dragón/Tierra (×4 a Hielo).
    const iceUser = build(mon('Frost', ['ice'], { hp: 80, attack: 60, defense: 60, spAttack: 120, spDefense: 70, speed: 100 }), [mv({ name: 'Ice Beam', type: 'ice', category: 'special', power: 90 })])
    const berryMon = build(mon('Garchomp', ['dragon', 'ground'], { hp: 108, attack: 130, defense: 95, spAttack: 80, spDefense: 85, speed: 102 }), [mv({ name: 'Growl', category: 'status', power: null })])
    berryMon.item = 'Yache Berry'
    await sim.start([iceUser], [berryMon], false, 'singles', 'easy')
    expect(sim.enemies[0].itemActive).toBe(true)
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Ice Beam', type: 'ice', category: 'special', power: 90 }), target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemies[0].itemActive).toBe(false) // baya consumida
  })

  it('la baya cura el estado al infligirlo (Lum cura cualquiera)', async () => {
    const sim = useSimulatorStore()
    const spore = mv({ name: 'Spore', category: 'status', power: null }) // sueño, 100% precisión
    const target = build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])
    target.item = 'Lum Berry'
    await sim.start([build(venusaur(), [spore])], [target], false, 'singles', 'easy')
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: spore, target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemies[0].status).toBe('') // curado al instante
    expect(sim.enemies[0].itemActive).toBe(false) // baya consumida
  })

  it('Niebla (Haze) borra todos los cambios de estadísticas', async () => {
    const sim = useSimulatorStore()
    const haze = mv({ name: 'Haze', category: 'status', power: null })
    const ally = build(venusaur(), [haze])
    await sim.start([ally], [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.allies[0].boosts.attack = 4
    sim.enemies[0].boosts.defense = -2
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: haze, target: { side: 'ally', slot: 0 } } }],
      [],
    )
    expect(sim.allies[0].boosts.attack).toBe(0)
    expect(sim.enemies[0].boosts.defense).toBe(0)
  })

  it('Aromaterapia cura el estado de todo el equipo', async () => {
    const sim = useSimulatorStore()
    const aroma = mv({ name: 'Aromatherapy', category: 'status', power: null })
    const active = build(venusaur(), [aroma])
    const benched = build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])
    await sim.start([active, benched], [build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])], false, 'singles', 'easy')
    sim.allies[0].status = 'brn'
    sim.allies[1].status = 'par' // en el banquillo
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: aroma, target: { side: 'ally', slot: 0 } } }],
      [],
    )
    expect(sim.allies[0].status).toBe('')
    expect(sim.allies[1].status).toBe('') // también el del banquillo
  })

  it('Refugio bloquea la infliccion de estados en su bando', async () => {
    const sim = useSimulatorStore()
    const safeguard = mv({ name: 'Safeguard', category: 'status', power: null, priority: 4 })
    const protectedMon = build(tauros(), [safeguard])
    const spore = mv({ name: 'Spore', category: 'status', power: null })
    await sim.start([protectedMon], [build(venusaur(), [spore])], false, 'singles', 'easy')
    // El aliado pone Refugio (prioridad +4) antes de la Espora rival.
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: safeguard, target: { side: 'ally', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: spore, target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.allies[0].status).toBe('') // la Espora no prendió
  })

  it('Drenadoras roba PS cada turno hacia el rival', async () => {
    const sim = useSimulatorStore()
    const leech = mv({ name: 'Leech Seed', category: 'status', power: null })
    const seeder = build(venusaur(), [leech])
    seeder.ability = 'No Guard' // Leech Seed nunca falla (test determinista)
    const victim = build(tauros(), [mv({ name: 'Growl', category: 'status', power: null })])
    await sim.start([seeder], [victim], false, 'singles', 'easy')
    sim.allies[0].hp = 100 // deja margen para curarse
    const seederHp = sim.allies[0].hp
    const victimHp = sim.enemies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: leech, target: { side: 'enemy', slot: 0 } } }],
      [],
    )
    expect(sim.enemies[0].leechSeed).toBe(true)
    expect(sim.enemies[0].hp).toBeLessThan(victimHp) // el sembrado pierde PS
    expect(sim.allies[0].hp).toBeGreaterThan(seederHp) // el sembrador los gana
  })

  it('Mofa impide usar movimientos de estado', async () => {
    const sim = useSimulatorStore()
    const taunt = mv({ name: 'Taunt', category: 'status', power: null, priority: 4 })
    const growl = mv({ name: 'Growl', category: 'status', power: null })
    // El aliado (rápido/prioridad) mofa; el rival intenta Gruñido (estado) y no puede.
    const taunter = build(venusaur(), [taunt])
    const victim = build(tauros(), [growl])
    await sim.start([taunter], [victim], false, 'singles', 'easy')
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: taunt, target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: growl, target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.enemies[0].taunt).toBeGreaterThan(0)
    expect(sim.allies[0].boosts.attack).toBe(0) // el Gruñido rival no llegó a bajar el ataque
  })

  it('Anulación bloquea el último movimiento usado', async () => {
    const sim = useSimulatorStore()
    const disable = mv({ name: 'Disable', category: 'status', power: null, priority: 4 })
    const bodySlam = mv({ name: 'Body Slam' })
    const disabler = build(venusaur(), [disable])
    const victim = build(tauros(), [bodySlam])
    await sim.start([disabler], [victim], false, 'singles', 'easy')
    // Turno 1: el rival usa Placaje (queda como último movimiento).
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Growl', category: 'status', power: null }), target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: bodySlam, target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.enemies[0].lastMove).toBe('Body Slam')
    // Turno 2: el aliado anula Placaje (prioridad +4) y el rival ya no puede usarlo.
    const hp = sim.allies[0].hp
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: disable, target: { side: 'enemy', slot: 0 } } }],
      [{ slot: 0, action: { kind: 'move', move: bodySlam, target: { side: 'ally', slot: 0 } } }],
    )
    expect(sim.enemies[0].disableMove).toBe('Body Slam')
    expect(sim.allies[0].hp).toBe(hp) // Placaje anulado: no hizo daño
  })

  it('un turno completo con la IA avanza el combate y sí registra en el log', async () => {
    const sim = await startBattle('normal')
    const logBefore = sim.log.length
    const enemyActions = await sim.computeAiActions()
    sim.submitTurn(
      [{ slot: 0, action: { kind: 'move', move: mv({ name: 'Body Slam' }), target: { side: 'enemy', slot: 0 } } }],
      enemyActions,
    )
    expect(sim.turn).toBe(2)
    expect(sim.log.length).toBeGreaterThan(logBefore)
    expect(sim.branches[0].states.length).toBe(2)
  })
})

# Roadmap — Calculadora Pokémon Champions

Estado de las fases del proyecto. Marca los items a medida que se completen.

## Fase 0 — Estructura base ✅

- [x] Scaffolding Vue 3 + Vite + TypeScript
- [x] Routing (`vue-router`) y estado global (`pinia`)
- [x] Capa de datos aislada sobre PokéAPI (`services/pokeapi.ts`)
- [x] Caché persistente de PokéAPI (memoria + localStorage con versión, `services/cache.ts`)
- [x] Modelo de dominio (`types/pokemon.ts`)
- [x] Tests unitarios del motor de cálculo

## Fase 1 — Selección visual y mecánica de Champions ✅

- [x] Selector de Pokémon en tarjetas con buscador (`PokemonPicker`)
- [x] Selector de movimientos del atacante (`MovePicker`)
- [x] Motor de daño con `@smogon/calc` (`services/damageEngine.ts`)
- [x] Sistema de Stat Points de Champions (66 SP, máx. 32, nivel 50, sin IVs)
- [x] Editor de Stat Points + naturaleza con stat final en vivo (`StatPointsEditor`)
- [x] Resultado: rango de daño, %, barra de HP, chance de KO y descripción Showdown

## Fase 2 — Roster real de Champions ✅

- [x] Roster limitado a los Pokémon de Champions (dataset propio de Champions)
- [x] Megaevoluciones seleccionables (clásicas y nuevas de Legends Z-A)
- [x] Formas regionales (Alola/Galar/Hisui/Paldea)
- [x] Movimientos filtrados por el learnset de Champions de cada forma
- [x] Detalle de movimiento (tipo, categoría, potencia) en el selector
- [x] Objeto equipado (item) por combatiente (con su piedra implícita en megas)
- [x] Fidelidad vía `overrides` de stats/tipos/habilidad del dataset de Champions

## Fase 3 — Campo de batalla ✅ / Calculadora completa

- [x] Estado por combatiente (quemado, paralizado, envenenado, tóxico, dormido, congelado)
- [x] Clima (sol, lluvia, arena, nieve)
- [x] Terreno (eléctrico, hierba, psíquico, niebla)
- [x] Pantallas del defensor (Reflejo, Pantalla de Luz, Velo Aurora)
- [x] Habilidad seleccionable por combatiente (slots 0/1/oculta/especial)
- [x] Stat stages / boosts (−6 a +6) por combatiente
- [ ] Movimientos de golpe múltiple y críticos
- [ ] Selección de los 4 movimientos y comparativa de daño lado a lado
- [ ] Modo dobles (spread) y Mano Amiga

## Fase 4 — Builds, equipos e historial ✅

- [x] Capa de persistencia versionada en localStorage (`services/storage.ts`)
- [x] Guardar builds de Pokémon (SP + naturaleza + objeto + estado) con nombre
- [x] Crear equipos y seleccionar Pokémon desde ellos sin buscar
- [x] Selector con pestañas Roster / Mis builds / Equipos
- [x] Páginas dedicadas de Builds (`/builds`) y Equipos (`/teams`)
- [x] Historial automático de los últimos 20 enfrentamientos
- [x] Guardar enfrentamientos favoritos y recargarlos (`/matchups`)
- [x] Modo Equipo vs Equipo (`/battle`): aliado vs rival con selección rápida
- [x] Moveset (hasta 4 movimientos) por build; botones rápidos en Batalla
- [x] Editar equipos y builds directamente (sin pasar por la calculadora)
- [x] Simulador de combate por equipos (`/simulator`): turnos, cambios, KO,
      daño residual de estado, orden por prioridad/velocidad, rival IA o manual
- [x] Formato de combate individual o doble (2 activos por bando con objetivo)
- [x] Guardar equipos ad-hoc (Batalla/Simulador) como equipos de la biblioteca
- [x] Fase de orden de equipo (team preview) antes del combate
- [x] Simulación fiel (datos de efectos de @pkmn/dex): precisión/fallos, críticos,
      movimientos de estado (boosts/estado/curación/self-boosts), efectos
      secundarios, drenaje/retroceso, objetos (Restos/Sitrus/Banda Focus/Vidasfera),
      clima con duración y daño de arena, habilidades de entrada (Intimidación,
      invocadores de clima) e inmunidades de estado por tipo

## Simulador — mecánicas avanzadas ✅

- [x] Protección/Detección (con racha decreciente) y movimientos de multi-golpe
- [x] Campos de peligro: Trampa Rocas (según efectividad), Púas y Púas Tóxicas
      (con inmunidad de voladores/Levitate y absorción por tipo Veneno)
- [x] Cambios de precisión/evasión (afectan al acierto)
- [x] Terreno dinámico: curación de Hierba, duración e invocadores de habilidad
- [x] Más habilidades: Regenerador (cura al cambiar), invocadores de terreno
- [x] Indicadores de clima/terreno/campos de peligro en la interfaz
- [x] @pkmn/dex queda en el chunk diferido del simulador (no afecta al arranque)

## Simulador — pasivas y objetos ✅

- [x] Velocidad por clima (Nado Rápido, Clorofila, Ímpetu Arena, Quitanieves)
- [x] Prioridad de habilidad (Prankster, Alas Vendaval)
- [x] Absorciones (Absorbe Agua/Elec, Colector, Pararrayos, Piel Seca, Cortina Plasma…)
- [x] Muro Mágico (inmune a daño indirecto) y Cura Veneno; Regenerador; inmunidad a arena
- [x] Habilidades dependientes de HP vía curHP (Multiescama, etc.)
- [x] Objetos: Cinta/Gafas/Pañuelo Elección (con bloqueo de movimiento), Chaleco Asalto,
      Casco Dentado, Póliza de Debilidad, Globo Helio
- [x] Megaevolución en combate: llevar la mega piedra permite megaevolucionar
      (una vez por bando), con cambio de forma/tipos/stats/habilidad e IA que megaevoluciona
- [x] Ataques de dos turnos: carga (Rayo Solar, Vuelo, Excavar…; sol/Hierba Única
      saltan la carga) y recarga (Hiperrayo, Giga Impacto)
- [x] Replay navegable: instantánea por turno; moverse adelante/atrás y volver a en vivo
- [x] Movimientos de múltiples objetivos (área): Terremoto/Surf/Onda Certera… golpean
      a todos los objetivos con el modificador de área ×0.75 en dobles
- [x] Atacar al aliado en dobles (objetivo por bando y slot)
- [x] Cards de combate completas: estado, habilidad, objeto y cambios de stats
- [x] Movimientos de auto-objetivo no piden objetivo; volver atrás en la selección
- [x] Habilidades de contacto (Piel Tosca/Punta Acero dañan; Cuerpo Llama/Elec.
      Estática/Punto Tóxico/Efecto Espora infligen estado; Detonación) y por clima
      (Poder Solar, Piel Seca)
- [x] Movimientos de primer turno (Sorpresa, Escaramuza) y retroceso (flinch)
- [x] Protecciones de bando (Vasta Guardia bloquea área, Anticipo bloquea prioridad,
      Escudo Áureo bloquea estado, Escudo Tatami bloquea daño) y escudos con efecto de
      contacto (Barrera Espinosa daña, Escudo Real −Atq, Búnker envenena, Obstrucción
      −Def, Trampa Seda −Vel)
- [x] Pantallas dinámicas por bando en combate (Reflejo/Pantalla de Luz/Velo Aurora
      con duración 5, u 8 con Luz Arcilla) que activan Reflejo/Pantalla de Luz/Velo Aurora
- [x] Movimientos que rompen pantallas (Demolición, Colmillo Psíquico, Furia Titánica)
- [x] Ataques que ignoran protecciones (Amago, Fuerza Fantasma, Golpe Umbrío, Agujero/
      Furia Dimensional) y habilidad Puño Invisible (contacto atraviesa protección)
- [x] Ramas del combate: bifurcar desde un turno pasado y navegar entre líneas
      alternativas (guarda y restaura el estado completo del combate)
- [x] Megaformas que no están en el roster del dataset se construyen desde @pkmn/dex
      (cubre todas las megas con piedra: clásicas y nuevas de Champions/Z-A)
- [x] Sprites específicos de forma (megas/regionales) vía @pkmn/img con respaldo a PokéAPI
- [x] Orientación de sprites en combate (aliado mira a la derecha, rival a la izquierda)
- [x] Habilidad Fortaleza (No Guard): los ataques no fallan
- [x] Pararrayos/Colector: redirección en dobles y absorción de movimientos de estado
      (además de la absorción de ataques que ya existía)
- [x] Daño estimado (%) en los botones de movimiento del simulador, por cada rival
- [x] Previsualización de daño con clima y terreno hipotéticos (sin cambiar el combate)
- [x] Porcentaje de vida restante en las cards de combate
- [x] Panel de suposiciones (what-if) en el simulador: clima, cambios de stats y
      habilidad hipotéticos (atacante y rival) y orden por velocidad; solo afecta
      a los porcentajes mostrados, nunca al combate real
- [x] La previsualización de daño usa la megaforma si se planea megaevolucionar
      (stats/tipos/habilidad de la mega, con su habilidad en el desplegable)
- [x] Suposición de megaevolución también en cada rival (casilla Mega por rival):
      la previsualización de daño, precisión y orden por velocidad usan su megaforma
- [x] Suposición de pantallas por rival (Reflejo / Pantalla de Luz / Velo Aurora):
      reducen el daño estimado del lado del rival correspondiente
- [x] Suposiciones de apoyo del aliado en dobles: Mano Amiga (×1.5), Batería (×1.3
      especial), Punto Poder (×1.3), Alma Acerada (×1.5 Acero) en el atacante y
      Prevención (Friend Guard, ×0.75) por rival
- [x] El orden por velocidad refleja las suposiciones: clima hipotético (Clorofila/
      Nado Rápido… duplican), cambios de velocidad y habilidad/megaforma supuestas
- [x] Orden de turno con movimiento supuesto por combatiente: prioridad primero
      (Bromista en estado, Alas Vendaval, Ataque Rápido…) y luego velocidad
- [x] Viento Afín (Tailwind) en combate: dobla la velocidad del bando 4 turnos, con
      duración e integrado en el orden de turno; suposición por bando en el panel
- [x] Suposiciones por cada rival por separado (en dobles): cada rival tiene su
      propio bloque de cambios de stats y habilidad; el % de daño y el orden por
      velocidad usan las suposiciones específicas de cada uno
- [x] Precisión efectiva (%) en cada movimiento (también los de estado contra rival):
      considera precisión/evasión, No Guard (100%), Ojo Compuesto/Estrella Victoria/
      Entusiasmo, Lupa, Polvo Brillo y Velo Arena/Manto Níveo por clima; influida por
      las suposiciones (habilidad, clima, precisión y evasión hipotéticas)

## Pendiente — Simulador (mecánicas)

- [ ] **Espacio Raro** (Trick Room): invierte el orden de velocidad (encaja con el
      orden de turno ya implementado) y **Gravedad** (precisión y anclaje al suelo)
- [ ] **Cambios forzados**: Rugido / Bramido / Remolino (sacan al rival del campo)
- [ ] **Aguante** (Endure) y bayas/objetos ligados (sobrevivir con 1 PS)
- [ ] **Semiinvulnerabilidad real** de Vuelo/Excavar/Buceo (hoy cargan pero no esquivan
      durante la fase invulnerable — documentado como pendiente)
- [ ] Más **objetos**: bayas reductoras de tipo, más bayas de curación/estado, etc.
- [ ] Movimientos de campo extra (Viento Veloz, Truco Defensa) y más interacciones de habilidad
- [ ] Tesoros de la Ruina / Don Floral (solo si entran en el roster de Champions)
- [ ] **Tests del simulador**: turnos, prioridad, pantallas, protecciones, clima/terreno
      (hoy solo hay tests del motor de daño)

## Pendiente — Builds y equipos

- [ ] **Exportar e importar builds y equipos** (JSON / portapapeles o archivo) para
      compartirlos y respaldarlos entre navegadores
- [ ] Presets de reparto competitivos (32/32/2, etc.) para armar builds rápido

## Pendiente — Fidelidad de datos (específico de Champions)

- [ ] **Validar los resultados contra la calc oficial de Showdown** en modo Champions
      (base de todo: confirmar que los % son exactos)
- [ ] Sprites propios de megas/regionales (hoy usan el sprite de la forma base como respaldo)
- [ ] Nuevas habilidades de mega exclusivas de Champions no presentes en @smogon/calc

## Pendiente — Calidad y experiencia

- [ ] **Compartir por URL** un cálculo o un equipo (query params)
- [ ] Diseño responsive y accesible (a11y), sobre todo el simulador en móvil
- [ ] PWA / uso offline (manifest + service worker; los datos ya se cachean)
- [ ] Carga diferida (`import()`) de `@smogon/calc` para aligerar el bundle inicial
- [ ] i18n (español / inglés)

## Fase 5 — Despliegue

- [x] Deploy en GitHub Pages con dominio propio (pkmncalc.jesuslorenzo.es) y HTTPS,
      vía GitHub Actions al hacer push a la rama `production`
- [ ] CI: lint + type-check + tests en cada push (evitar romper el deploy)
- [ ] Silenciar el aviso de Node 20 del workflow al salir versiones nuevas de las actions

## Notas técnicas

- **Motor**: `@smogon/calc` (gen 9). El sistema de Stat Points se traduce a su
  modelo con `EVs = SP × 8`, `IVs = 31`, `nivel = 50` (`utils/champions.ts`).
- **Datos estáticos** (tabla de tipos, colores, naturalezas): la tabla de tipos
  se usa solo para el badge de efectividad; el cálculo real lo hace la librería.
  Las naturalezas se leen de `@smogon/calc` (`NATURES`) para garantizar nombres
  compatibles.

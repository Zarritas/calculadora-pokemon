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

## Reglas propias de Pokémon Champions ✅

- [x] Estados nerfeados de Champions: **sueño** (seguro T1, 33% T2, seguro T3),
      **congelación** (25%/turno, seguro T3), **parálisis** (12,5% de fallar)
- [x] Movimientos de clima (Día Soleado, Danza Lluvia, Tormenta Arena, Nevada) con
      duración 5/8 según su roca; el clima/terreno inicial dura 5 turnos (no permanente)
- [x] Movimientos de terreno (Campo Eléctrico/Herbáceo/Psíquico/Niebla, 5/8 turnos)
- [x] Interacciones de tipo y aterrizaje: **Respiro** (pierde Volador), **Buenazo**,
      **Arraigo**, **Levitón**, **Anegar** (→Agua), **Maldición Silvana** (+Planta)
- [x] Potencia de movimientos tomada del dataset de Champions (override de basePower;
      los de potencia variable se dejan a @smogon/calc)
- [x] Cambio de tipo puntual (Snap Trap→Acero) y reclasificaciones a Corte
      (Sharpness las potencia) y Sonido; % de secundarios documentados por Serebii
- [x] 6 habilidades nuevas de Champions y objetos/estados propios: **Salt Cure**
      (residual), **Rage Fist** (potencia por golpes recibidos), Soundproof, Throat Spray
- [x] Fuente: contrastado con Serebii (nada implementado a ciegas); los % de secundarios
      no documentados quedan fuera hasta tener datos oficiales

## IA de combate ✅

- [x] Rival por **expectiminimax** (matriz de pagos por jugadas simultáneas + nodos de
      azar por muestreo Monte Carlo sobre el motor real), NO un LLM
- [x] Selector de dificultad: **Fácil** (voraz), **Normal** (profundidad 1), **Difícil**
      (profundidad 2), con búsqueda troceada y **prefetch** (piensa mientras eliges)
- [x] Selección de equipo (mejores 4 + líder) y **relevo tras KO** por emparejamiento,
      según la dificultad
- [x] Regla de Champions: se traen exactamente **4 Pokémon** al combate (de un equipo
      de hasta 6); cláusula de objeto (sin objetos repetidos por equipo)
- [x] (Fase 2 pendiente) Blindar la IA como feature de pago: mover el motor a un backend
      (VPS) para que no se pueda extraer del bundle del navegador

## Pendiente — Simulador (mecánicas)

- [x] **Espacio Raro** (Trick Room): invierte el orden de velocidad 5 turnos (toggle),
      integrado en el orden de turno; indicador en la interfaz
- [x] **Gravedad**: aterriza a todos (Tierra golpea a Voladores/Levitación), sube la
      precisión ×5/3 y dura 5 turnos
- [x] **Cambios forzados**: Rugido / Bramido (estado) y Cola Dragón / Llave Giro (daño)
      sacan al rival al azar del banquillo (con Regenerador y peligros de entrada)
- [x] **Aguante** (Endure): sobrevive con 1 PS a un golpe letal (racha de Protección)
- [ ] Bayas/objetos ligados a sobrevivir con 1 PS (más allá de Banda Focus)
- [x] **Semiinvulnerabilidad real** de Vuelo/Excavar/Buceo/Fuerza Fantasma: esquivan
      durante la carga salvo los movimientos que alcanzan cada escondite (Terremoto→
      Excavar, Surf→Buceo, Trueno/Ventisca→Vuelo…), con su daño ×2 cuando corresponde
- [x] **Bayas reductoras de tipo** (Yache/Occa/Passho…): amortiguan un golpe supereficaz
      del tipo y se consumen; **bayas de estado** (Lum/Zreza y por estado) curan al infligirlo
- [x] **Niebla** (Haze): borra todos los cambios de estadísticas de ambos bandos
- [x] Movimientos de apoyo: Aromaterapia/Campana Cura (cura estados del equipo),
      Alivio (cura estado propio), Refugio (bloquea estados 5 turnos), Drenadoras (roba PS)
- [x] **Volátiles de restricción**: Mofa (Taunt, sin estados), Anulación (Disable),
      Bis (Encore, fuerza el último), Tormento (Torment, sin repetir) — con seguimiento
      del último movimiento, bloqueo en el motor, botones desactivados en la UI y
      filtrado en la IA
- [ ] Interacciones de habilidad adicionales
- [ ] Tesoros de la Ruina / Don Floral (solo si entran en el roster de Champions)
- [x] **Tests del simulador**: batería de integración con Pinia real y motor de daño
      (turnos, IA, estados, clima/terreno, aterrizaje, habilidades de Champions…)

## Pendiente — Builds y equipos

- [x] **Exportar e importar builds y equipos** en **formato Pokémon Showdown/Smogon**
      (el estándar para compartir sets): serializa a texto y parsea de vuelta. Los Stat
      Points se muestran tal cual bajo la línea `EVs:` (sin convertir a EVs), con mapeo
      de nombres (megas/regionales) y ajuste de movimientos al learnset de Champions
- [x] Presets de reparto por rol (Ofensivo físico/especial, Muro físico/especial,
      Bulk equilibrado) + Limpiar, en el editor de Stat Points

## Pendiente — Fidelidad de datos (específico de Champions)

- [ ] **Validar los resultados contra la calc oficial de Showdown** en modo Champions
      (base de todo: confirmar que los % son exactos)
- [ ] Sprites propios de megas/regionales (hoy usan el sprite de la forma base como respaldo)
- [x] Habilidades nuevas de Champions (Piercing Drill, Dragonize, Eelevate, Mega Sol,
      Fire Mane, Spicy Spray) implementadas

## Pendiente — Calidad y experiencia

- [x] **Compartir por URL** un equipo (query param `s`, texto Showdown codificado en
      base64; al abrir el enlace la app ofrece importarlo) y un **cálculo** (query param
      `calc` en la calculadora: reconstruye atacante/defensor/movimiento/campo)
- [~] Diseño responsive y accesible (a11y): foco visible por teclado, `prefers-reduced-motion`,
      imágenes que no desbordan y aria-labels en botones de icono. **Pasada WCAG 2.1 AA**:
      modales con focus trap + retorno de foco + `aria-labelledby` (`BaseModal`); fila de
      movimiento seleccionable convertida en `<button>` (operable por teclado); color de texto
      de los chips de tipo por luminancia (contraste); acento oscurecido `--color-accent-strong`
      (4.5:1 con blanco) en el estado activo de la nav; regiones `aria-live`/`role` en registro
      de combate, "IA pensando", resultado/error de daño y avisos de copiado; nombres accesibles
      en ranges/números de SP, +/− de stats, selects (cargar equipo, rama, orden) y buscadores;
      `role="radiogroup"` en Formato/Dificultad, `aria-pressed`/`aria-expanded` en toggles;
      `<nav aria-label>`, skip-link al contenido y utilidad `.sr-only`. Acento oscurecido
      `--color-accent-strong` (4.5:1) aplicado a TODOS los botones/superficies con texto blanco
      (nav activa, badge, Empezar combate, Crear equipo, guardar, diálogos, MatchupCard).
- [x] **Navegación móvil**: menú hamburguesa accesible (≤860px) con `aria-expanded`/`aria-controls`,
      que despliega los enlaces como filas grandes y agrupa los iconos (GitHub/Patreon/idioma)
      al pie; se cierra al navegar. Sustituye al scroll horizontal (enlaces ocultos/no
      descubribles). En escritorio la nav sigue inline. **Pulido móvil**: convención
      de breakpoints 720px (layout) / 480px (densidad); objetivos táctiles ampliados en nav,
      cabecera/formulario de equipos (con `flex-wrap`), steppers de stats (36px), chips de tipo,
      botones de setup/replay y panel de suposiciones del simulador; sprite reducido en slots
      estrechos. **Secciones colapsables** (`CollapsibleCard` con `<details>/<summary>` nativos,
      accesibles por teclado y lector de pantalla): Reparto de SP, Cambios de stats y Campo de
      batalla se pliegan por defecto en móvil (abiertos en escritorio) para acortar el scroll.
      Falta: prevenir el zoom de iOS al enfocar inputs pequeños (<16px) y afinar densidad en
      tablas/editores muy compactos
- [x] PWA / uso offline (`vite-plugin-pwa`): manifest instalable, service worker con
      `autoUpdate` y **precache del app-shell + chunks** (~5,7 MiB, 51 entradas) para uso
      offline tras la primera visita; icono maskable SVG (`public/pwa-icon.svg`),
      `theme-color` y metas de iOS/Android en `index.html`
- [x] Bundle inicial ligero (~106 kB / 41 kB gzip): las vistas son rutas diferidas y el
      diálogo de importación se carga con `defineAsyncComponent`, así `@smogon/calc` y
      `@pkmn/img` quedan fuera del arranque (solo se cargan al usar calc/simulador/importar)
- [~] i18n (español / inglés): base propia sin dependencias (`src/i18n`, `t()` reactivo +
      persistencia + detección del navegador), selector ES/EN en la barra, y traducidos la
      navegación, el pie y la calculadora. **Nombres del juego** (movimientos/habilidades/
      objetos) traducidos desde PokéAPI vía `nameLocale.ts` (bajo demanda + caché); aplicado
      a movimientos en calc/builds/equipos. Falta: migrar el resto de vistas (Simulador,
      etc.), enganchar habilidades/objetos en más sitios, y el registro de combate (store)

## Fase 5 — Despliegue

- [x] Deploy en GitHub Pages con dominio propio (pkmncalc.jesuslorenzo.es) y HTTPS,
      vía GitHub Actions al hacer push a la rama `production`
- [x] CI (`.github/workflows/ci.yml`): lint + type-check + tests + build en cada push
      (main/production) y pull request, para no romper el deploy. Config flat de ESLint 9
      (`eslint.config.js`) recuperada y código sin usar limpiado
- [ ] Silenciar el aviso de Node 20 del workflow al salir versiones nuevas de las actions

## Notas técnicas

- **Motor**: `@smogon/calc` (gen 9). El sistema de Stat Points se traduce a su
  modelo con `EVs = SP × 8`, `IVs = 31`, `nivel = 50` (`utils/champions.ts`).
- **Datos estáticos** (tabla de tipos, colores, naturalezas): la tabla de tipos
  se usa solo para el badge de efectividad; el cálculo real lo hace la librería.
  Las naturalezas se leen de `@smogon/calc` (`NATURES`) para garantizar nombres
  compatibles.

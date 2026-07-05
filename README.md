# Calculadora Pokémon Champions

Calculadora de daño no oficial para **Pokémon Champions**, hecha con Vue 3 + Vite + TypeScript. El cálculo usa [`@smogon/calc`](https://github.com/smogon/damage-calc) (el mismo motor que la calculadora oficial de Pokémon Showdown) y los datos de Pokémon/movimientos para el selector se obtienen de [PokéAPI](https://pokeapi.co/).

Implementa el sistema de estadísticas de Champions: **nivel 50 fijo, sin IVs y 66 Stat Points** (máximo 32 por stat), en lugar de los EVs/IVs clásicos.

> Proyecto no afiliado a Nintendo, Game Freak ni The Pokémon Company.

## Requisitos

- Node.js 18+
- npm

## Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
```

Otros scripts:

```bash
npm run build        # build de producción (type-check + vite build)
npm run preview      # sirve el build
npm run test         # tests unitarios (Vitest)
npm run type-check   # comprobación de tipos
npm run lint         # ESLint con autofix
npm run format       # Prettier
```

## Estructura del proyecto

```
calculadora-pokemon/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── ROADMAP.md
└── src/
    ├── main.ts                 # punto de entrada
    ├── App.vue                 # layout + navegación
    ├── router/                 # rutas (vue-router)
    ├── stores/                 # estado global (pinia)
    │   └── calculator.ts       # estado de la calculadora
    ├── views/                  # páginas
    │   ├── CalculatorView.vue
    │   └── AboutView.vue
    ├── components/             # componentes reutilizables
    │   ├── PokemonPicker.vue   # selector de Pokémon en tarjetas + buscador
    │   ├── PokemonCard.vue     # tarjeta individual
    │   ├── MovePicker.vue      # selector de movimientos del atacante
    │   ├── CombatantSlot.vue   # hueco de atacante/defensor
    │   ├── StatPointsEditor.vue# reparto de Stat Points + naturaleza
    │   ├── TypeBadge.vue       # etiqueta de tipo con color
    │   ├── BaseModal.vue       # modal reutilizable
    │   └── DamageResultCard.vue
    ├── services/               # acceso a datos y motor de cálculo
    │   ├── pokeapi.ts          # cliente de PokéAPI (cacheado)
    │   ├── cache.ts            # caché memoria + localStorage (versionada)
    │   └── damageEngine.ts     # motor de daño (envoltura de @smogon/calc)
    ├── utils/                  # lógica de dominio pura
    │   ├── champions.ts        # reglas del sistema de Stat Points
    │   ├── natures.ts          # naturalezas (desde @smogon/calc)
    │   ├── typeChart.ts        # efectividad de tipos (solo para el badge)
    │   ├── typeColors.ts       # colores/etiquetas de tipo
    │   └── format.ts           # formateo de nombres
    ├── types/                  # tipos del dominio
    │   └── pokemon.ts
    └── assets/styles/          # estilos globales
```

## Fuente de datos y cálculo

- **Selector** (nombres, sprites, tipos, movimientos del Pokémon) → PokéAPI
  (`services/pokeapi.ts`), con **caché** en memoria + localStorage (`services/cache.ts`).
  Los sprites de las tarjetas se derivan del id, sin peticiones extra.
- **Cálculo de daño** → `@smogon/calc` (gen 9), a través de `services/damageEngine.ts`.
  Los Stat Points de Champions se traducen a su modelo con `EVs = SP × 8`, `IVs = 31`,
  `nivel = 50` (ver `utils/champions.ts`).

La caché está **versionada**: al cambiar la forma de los datos guardados se sube la versión
en `services/cache.ts` y las entradas antiguas se purgan solas al arrancar.

## Notas sobre Pokémon Champions

Al ser un juego reciente, PokéAPI puede no incluir todavía datos específicos de Champions
(nuevos movimientos, formas o mecánicas de daño). La fórmula actual usa la de los juegos
principales; se ajustará cuando se confirmen las mecánicas del juego (ver ROADMAP, Fase 2).

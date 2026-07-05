import type { FieldState, StatusCondition, Terrain, Weather } from '@/types/pokemon'

/** Opciones de estado alterado con etiqueta en español. */
export const STATUS_OPTIONS: { value: StatusCondition; label: string }[] = [
  { value: '', label: 'Sin estado' },
  { value: 'brn', label: 'Quemado' },
  { value: 'par', label: 'Paralizado' },
  { value: 'psn', label: 'Envenenado' },
  { value: 'tox', label: 'Envenenamiento grave' },
  { value: 'slp', label: 'Dormido' },
  { value: 'frz', label: 'Congelado' },
]

/** Opciones de clima. */
export const WEATHER_OPTIONS: { value: Weather; label: string }[] = [
  { value: '', label: 'Sin clima' },
  { value: 'Sun', label: 'Sol' },
  { value: 'Rain', label: 'Lluvia' },
  { value: 'Sand', label: 'Tormenta de arena' },
  { value: 'Snow', label: 'Nieve' },
]

/** Opciones de terreno. */
export const TERRAIN_OPTIONS: { value: Terrain; label: string }[] = [
  { value: '', label: 'Sin terreno' },
  { value: 'Electric', label: 'Eléctrico' },
  { value: 'Grassy', label: 'Hierba' },
  { value: 'Psychic', label: 'Psíquico' },
  { value: 'Misty', label: 'Niebla' },
]

/** Estado de campo por defecto (sin efectos). */
export function defaultField(): FieldState {
  return {
    weather: '',
    terrain: '',
    reflect: false,
    lightScreen: false,
    auroraVeil: false,
  }
}

import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

// Config flat de ESLint 9 para Vue 3 + TypeScript.
export default defineConfigWithVueTs(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    rules: {
      // El proyecto usa castings `as unknown as` puntuales contra APIs externas.
      '@typescript-eslint/no-explicit-any': 'off',
      // Patrón deliberado: los editores (BuildEditor/FieldControls/…) reciben un
      // objeto reactivo y lo mutan en sitio; el padre ve los cambios por reactividad.
      'vue/no-mutating-props': 'off',
    },
  },
)

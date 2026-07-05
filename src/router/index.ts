import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // Modo hash: funciona en GitHub Pages sin 404 al refrescar rutas profundas.
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'calculator',
      component: () => import('@/views/CalculatorView.vue'),
    },
    {
      path: '/builds',
      name: 'builds',
      component: () => import('@/views/BuildsView.vue'),
    },
    {
      path: '/teams',
      name: 'teams',
      component: () => import('@/views/TeamsView.vue'),
    },
    {
      path: '/battle',
      name: 'battle',
      component: () => import('@/views/BattleView.vue'),
    },
    {
      path: '/simulator',
      name: 'simulator',
      component: () => import('@/views/SimulatorView.vue'),
    },
    {
      path: '/matchups',
      name: 'matchups',
      component: () => import('@/views/MatchupsView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
  ],
})

export default router

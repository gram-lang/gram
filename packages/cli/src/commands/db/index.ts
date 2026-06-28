import { defineCommand } from 'citty'

export default defineCommand({
  meta: { name: 'db', description: 'Manage the ingredient database' },
  subCommands: {
    sync: () => import('./sync').then(m => m.default),
    lint: () => import('./lint').then(m => m.default),
    enrich: () => import('./enrich').then(m => m.default),
    validate: () => import('./validate').then(m => m.default),
    search: () => import('./search').then(m => m.default),
    merge: () => import('./merge').then(m => m.default),
  },
})

import { defineCommand } from 'citty'

export default defineCommand({
  meta: { name: 'db', description: 'Manage the ingredient database' },
  subCommands: {
    sync: () => import('./sync').then(m => m.default),
    validate: () => import('./validate').then(m => m.default),
  },
})

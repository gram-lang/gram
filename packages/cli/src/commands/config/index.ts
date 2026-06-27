import { defineCommand } from 'citty'

export default defineCommand({
  meta: { name: 'config', description: 'Read and write project configuration' },
  subCommands: {
    list: () => import('./list').then(m => m.default),
    get: () => import('./get').then(m => m.default),
    set: () => import('./set').then(m => m.default),
    unset: () => import('./unset').then(m => m.default),
  },
})

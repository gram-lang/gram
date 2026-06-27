import { defineCommand, runMain } from 'citty'
import { log } from '@clack/prompts'
import { GramCLIError, ExitCode } from './errors'
import { version } from '../package.json'

const main = defineCommand({
  meta: {
    name: 'gram',
    version,
    description: 'CLI for the GRAM recipe language',
  },
  subCommands: {
    init: () => import('./commands/init').then(m => m.default),
    check: () => import('./commands/check').then(m => m.default),
    build: () => import('./commands/build').then(m => m.default),
    view: () => import('./commands/view').then(m => m.default),
    import: () => import('./commands/import').then(m => m.default),
    db: () => import('./commands/db').then(m => m.default),
    shop: () => import('./commands/shop').then(m => m.default),
    watch: () => import('./commands/watch').then(m => m.default),
    scale: () => import('./commands/scale').then(m => m.default),
    diff: () => import('./commands/diff').then(m => m.default),
    cook: () => import('./commands/cook').then(m => m.default),
  },
})

try {
  await runMain(main)
} catch (err) {
  if (err instanceof GramCLIError) {
    log.error(err.message)
    process.exit(err.exitCode)
  }
  log.error('An unexpected internal error occurred.')
  console.error(err)
  process.exit(ExitCode.InternalError)
}

import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export async function findProjectRoot(start = process.cwd()): Promise<string> {
  let dir = start
  while (true) {
    try {
      await access(resolve(dir, '.gram'))
      return dir
    } catch {}
    const parent = dirname(dir)
    if (parent === dir) return start
    dir = parent
  }
}

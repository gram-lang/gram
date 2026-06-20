import { Glob } from 'bun'
import { resolve, extname } from 'node:path'
import { GramCLIError, ExitCode } from '../errors'

export function resolveGlob(patterns: string[]): string[] {
  const files: string[] = []

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const matches = [
        ...new Glob(pattern).scanSync({
          cwd: process.cwd(),
          absolute: true,
        }),
      ].filter(f => extname(f) === '.gram')
      files.push(...matches)
    } else {
      files.push(resolve(pattern))
    }
  }

  if (files.length === 0) {
    throw new GramCLIError(
      `No .gram files found for: ${patterns.join(', ')}`,
      ExitCode.Error,
    )
  }

  return [...new Set(files)]
}

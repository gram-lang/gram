import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toPrintHTML } from '@gram/renderer'
import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

export async function generatePrintHTML(
  filePath: string,
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
): Promise<string> {
  const { compiled } = await runPipeline(filePath, { db, scaleFactor })
  const html = toPrintHTML(compiled)
  const outPath = join(tmpdir(), `gram_print_${Date.now()}.html`)
  await writeFile(outPath, html, 'utf-8')
  return outPath
}

export function openInBrowser(htmlPath: string): boolean {
  const cmds: Record<string, string[]> = {
    darwin: ['open', htmlPath],
    win32: ['cmd', '/c', 'start', '', htmlPath],
    linux: ['xdg-open', htmlPath],
  }
  const argv = cmds[process.platform] ?? ['xdg-open', htmlPath]
  try {
    Bun.spawn(argv, { stdio: ['ignore', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}

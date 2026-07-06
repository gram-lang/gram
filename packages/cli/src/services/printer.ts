import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RendererOptions } from '@gram-lang/renderer'
import type { IngredientData } from '@gram-lang/analyzer'
import { exportRecipe } from './exporter'

export async function generatePrintHTML(
  filePath: string,
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
  rendererOptions?: Pick<RendererOptions, 'hideStepQty' | 'bakersMathOnly'> & { bakersReference?: string },
): Promise<string> {
  const html = await exportRecipe(filePath, 'html', db, scaleFactor, rendererOptions)
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

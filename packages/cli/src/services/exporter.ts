import { toMarkdown, toPrintHTML, type RendererOptions } from '@gram/renderer'
import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

export async function exportRecipe(
  filePath: string,
  format: 'md' | 'html',
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
  rendererOptions?: Pick<RendererOptions, 'hideStepQty'>,
): Promise<string> {
  const { compiled } = await runPipeline(filePath, { db, scaleFactor })

  if (format === 'md') return toMarkdown(compiled)
  return toPrintHTML(compiled, rendererOptions)
}

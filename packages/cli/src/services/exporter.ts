import { toMarkdown, toPrintHTML, type RendererOptions } from '@gram/renderer'
import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

export async function exportRecipe(
  filePath: string,
  format: 'md' | 'html',
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
  rendererOptions?: Pick<RendererOptions, 'hideStepQty' | 'bakersMath' | 'bakersMathOnly'>,
): Promise<string> {
  const { compiled, analyzed } = await runPipeline(filePath, { db, scaleFactor })
  const data = db ? analyzed?.result : compiled

  if (format === 'md') return toMarkdown(data, rendererOptions)
  return toPrintHTML(data, rendererOptions)
}

import { toMarkdown, toPrintHTML, type RendererOptions } from '@gram/renderer'
import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

export async function exportRecipe(
  filePath: string,
  format: 'md' | 'html',
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
  rendererOptions?: Pick<RendererOptions, 'hideStepQty' | 'bakersReference' | 'bakersMathOnly'>,
): Promise<string> {
  const { compiled, analyzed } = await runPipeline(filePath, { 
    db, 
    scaleFactor, 
    bakersReference: rendererOptions?.bakersReference 
  })

  const ast = analyzed ? analyzed.result : compiled

  if (format === 'md') return toMarkdown(ast, rendererOptions)
  return toPrintHTML(ast, rendererOptions)
}

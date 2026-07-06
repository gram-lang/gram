import { toMarkdown, toPrintHTML, type RendererOptions } from '@gram-lang/renderer'
import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram-lang/analyzer'

export async function exportRecipe(
  filePath: string,
  format: 'md' | 'html',
  db: Record<string, IngredientData> | null,
  scaleFactor?: number,
  // bakersReference is an analyzer concern (which ingredient is the 100% base),
  // not a renderer option — the renderer only reads the already-computed
  // per-item `bakersPercentage` — so it's threaded through separately here
  // and only forwarded to the pipeline below, not into RendererOptions.
  rendererOptions?: Pick<RendererOptions, 'hideStepQty' | 'bakersMathOnly'> & { bakersReference?: string },
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

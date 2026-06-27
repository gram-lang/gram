import { readFile } from 'node:fs/promises'
import { getAST } from '@gram/parser'
import { compile } from '@gram/kitchen'
import { analyze } from '@gram/analyzer'
import type { CompilationResult } from '@gram/kitchen'
import type { AnalysisResult, IngredientData } from '@gram/analyzer'
import type { PipelineOptions } from '../types'
import { GramCLIError, ExitCode } from '../errors'

export interface PipelineResult {
  content: string
  compiled: CompilationResult
  analyzed: AnalysisResult | null
}

export async function runPipeline(
  filePath: string,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new GramCLIError(`File not found: ${filePath}`, ExitCode.Error)
    }
    throw err
  }
  const ast = getAST(content)
  const compiled = compile(ast, opts.scaleFactor ? { scaleFactor: opts.scaleFactor } : undefined)

  const analyzed =
    !opts.skipAnalyzer && opts.db ? analyze(compiled, opts.db) : null

  return { content, compiled, analyzed }
}

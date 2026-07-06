import pLimit from 'p-limit'
import { runPipeline } from '../core/pipeline'
import type { CheckResult, Diagnostic, CheckOptions } from '../types'

function errorToDiagnostic(file: string, err: unknown): Diagnostic {
  const message = err instanceof Error ? err.message : String(err)
  // Parser errors often embed "line N" in the message
  const lineMatch = message.match(/line[: ]+(\d+)/i)
  return {
    level: 'error',
    category: 'Structure',
    file,
    message,
    line: lineMatch ? parseInt(lineMatch[1]!, 10) : undefined,
  }
}

function getLineFromOffset(content: string, offset?: number): number | undefined {
  if (offset == null) return undefined
  return content.slice(0, offset).split('\n').length
}

export async function checkFiles(
  files: string[],
  opts: CheckOptions = {},
): Promise<CheckResult> {
  const limit = pLimit(20)
  const diagnostics: Diagnostic[] = []

  await Promise.all(
    files.map(file =>
      limit(async () => {
        try {
          const { content, compiled, analyzed } = await runPipeline(file, { db: opts.db })

          // Compiler structural errors (undefined references, scope conflicts, etc.)
          for (const w of compiled.warnings) {
            diagnostics.push({
              level: 'error',
              category: 'Structure',
              file,
              message: w.message,
              line: getLineFromOffset(content, w.loc?.start),
            })
          }

          // Analyzer: ingredients absent from the database
          if (analyzed) {
            for (const id of analyzed.missingIngredients) {
              diagnostics.push({
                level: 'warning',
                category: 'Database',
                file,
                message: `"${id}" not found in ingredient database.`,
              })
            }
          }
        } catch (err) {
          diagnostics.push(errorToDiagnostic(file, err))
        }
      }),
    ),
  )

  return {
    diagnostics,
    hasErrors: diagnostics.some(d => d.level === 'error'),
    fileCount: files.length,
  }
}

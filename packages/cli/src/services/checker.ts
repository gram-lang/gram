import pLimit from 'p-limit'
import { runPipeline } from '../core/pipeline'
import type { CheckResult, Diagnostic, CheckOptions } from '../types'

function errorToDiagnostic(file: string, err: unknown): Diagnostic {
  const message = err instanceof Error ? err.message : String(err)
  // Parser errors often embed "line N" in the message
  const lineMatch = message.match(/line[: ]+(\d+)/i)
  return {
    level: 'error',
    file,
    message,
    line: lineMatch ? parseInt(lineMatch[1]!, 10) : undefined,
  }
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
          const { compiled, analyzed } = await runPipeline(file, { db: opts.db })

          // Compiler structural warnings (undefined references, scope conflicts, etc.)
          for (const w of compiled.warnings) {
            diagnostics.push({
              level: 'warning',
              file,
              message: typeof w === 'string' ? w : (w as { message: string }).message,
            })
          }

          // Analyzer: ingredients absent from the database
          if (analyzed) {
            for (const id of analyzed.missingIngredients) {
              diagnostics.push({
                level: 'warning',
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

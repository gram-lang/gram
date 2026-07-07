import pLimit from 'p-limit'
import { warningSeverity, type WarningSeverity } from '@gram-lang/kitchen'
import { runPipeline } from '../core/pipeline'
import type { CheckResult, Diagnostic, CheckOptions, DiagnosticLevel } from '../types'
import { getErrorMessage } from '../errors'

function diagnosticLevel(severity: WarningSeverity, strict: boolean | undefined): DiagnosticLevel {
  return strict && severity !== 'error' ? 'error' : severity
}

function errorToDiagnostic(file: string, err: unknown): Diagnostic {
  const message = getErrorMessage(err)
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

          // Compiler warnings, leveled by warningSeverity — a nutritional/
          // estimation gap (e.g. RELATIVE_QUANTITY_UNKNOWN_MASS) no longer
          // fails the build the same way an undefined reference does.
          // --strict promotes every warning/info to error.
          for (const w of compiled.warnings) {
            diagnostics.push({
              level: diagnosticLevel(warningSeverity[w.code], opts.strict),
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

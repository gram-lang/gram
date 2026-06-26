import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { version } from '../../package.json'
import { importJsonLd, importWithAI } from '../services/importer'
import { renderImportResult } from '../ui/importer'
import { loadConfig } from '../core/config'
import { loadAiModel } from '../core/ai'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: { name: 'import', version, description: 'Import a recipe from a JSON-LD file or URL' },
  args: {
    source: {
      type: 'positional',
      required: true,
      description: 'Local JSON-LD file or HTTP(S) URL',
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output .gram file (default: stdout)',
    },
    ai: {
      type: 'boolean',
      description: 'Use configured AI for semantic translation (requires ai config)',
      default: false,
    },
  },
  async run({ args }) {
    const source = args.source as string
    const outputPath = args.output ? resolve(args.output) : undefined
    const useStdout = !outputPath

    let result
    try {
      if (args.ai) {
        const config = await loadConfig()
        let model
        try {
          model = loadAiModel(config)
        } catch (err) {
          if (err instanceof GramCLIError) {
            log.error(err.message)
            process.exit(err.exitCode)
          }
          throw err
        }
        // Inform user which model is being used (to stderr so stdout stays clean)
        process.stderr.write(`  Using AI model for import…\n`)
        result = await importWithAI(source, model, config.language)
      } else {
        result = await importJsonLd(source)
      }
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    if (outputPath) {
      await writeFile(outputPath, result.gramContent, 'utf-8')
      renderImportResult(result, source, outputPath)
    } else {
      if (useStdout) {
        process.stderr.write('\n')
        process.stderr.write(`  ${'Title'.padEnd(14)} ${result.title}\n`)
        process.stderr.write(`  ${'Ingredients'.padEnd(14)} ${result.ingredientCount}\n`)
        process.stderr.write(`  ${'Steps'.padEnd(14)} ${result.stepCount}\n`)
        if (result.parseWarnings.length > 0) {
          process.stderr.write(`\n  ⚠ Could not parse:\n`)
          for (const w of result.parseWarnings) {
            process.stderr.write(`    ${w}\n`)
          }
        }
        process.stderr.write('\n')
      }
      process.stdout.write(result.gramContent + '\n')
    }

    process.exit(ExitCode.Ok)
  },
})

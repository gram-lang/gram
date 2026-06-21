import chalk from 'chalk'
import { spawn } from 'node:child_process'
import type { RecipeViewModel } from '../types'

const COL = Math.min(process.stdout.columns || 70, 78)

function pad(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - s.length))
}

function rule(label?: string): string {
  if (!label) return chalk.dim('─'.repeat(COL))
  const inner = `─── ${label} `
  return chalk.dim(inner + '─'.repeat(Math.max(0, COL - inner.length)))
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${m}` : `${h}h`
}

function renderHeader(model: RecipeViewModel): string {
  const lines: string[] = []
  const servStr = model.servings ? ` ${model.servings} servings ` : ' '
  const top = `┌─ ${model.title} ${'─'.repeat(Math.max(0, COL - 4 - model.title.length - servStr.length))}${servStr}─┐`
  lines.push(chalk.bold(top))

  if (model.times) {
    const t = model.times
    const parts: string[] = []
    if (t.prep) parts.push(`Prep: ${formatMinutes(t.prep)}`)
    if (t.active) parts.push(`Active: ${formatMinutes(t.active)}`)
    if (t.rest) parts.push(`Rest: ${formatMinutes(t.rest)}`)
    if (t.total) parts.push(`Total: ${formatMinutes(t.total)}`)
    if (parts.length > 0) {
      const inner = `⏱  ${parts.join('  ·  ')}`
      lines.push(chalk.bold(`│  `) + chalk.dim(pad(inner, COL - 4)) + chalk.bold(` │`))
    }
  }

  lines.push(chalk.bold(`└${'─'.repeat(COL - 2)}┘`))
  return lines.join('\n')
}

function renderShoppingList(list: RecipeViewModel['shoppingList']): string {
  if (list.length === 0) return ''
  const lines: string[] = ['', chalk.bold('SHOPPING LIST')]
  for (const item of list) {
    const name = item.name.padEnd(22)
    const qty = item.isEstimate ? chalk.dim(`≈ ${item.displayQty}`) : item.displayQty
    lines.push(`  ${name} ${qty}`)
  }
  return lines.join('\n')
}

function renderSections(sections: RecipeViewModel['sections']): string {
  const lines: string[] = []
  let stepNum = 1

  for (const sec of sections) {
    lines.push('')
    lines.push(rule(sec.title ?? undefined))

    if (sec.ingredients.length > 0) {
      for (const ing of sec.ingredients) {
        const name = ing.name.padEnd(20)
        const qty = ing.isEstimate ? chalk.dim(`≈ ${ing.displayQty}`) : ing.displayQty
        lines.push(`  ${chalk.dim('•')} ${name} ${qty}`)
      }
      lines.push('')
    }

    for (const step of sec.steps) {
      const num = String(stepNum++).padStart(2)
      const action = step.action ? chalk.cyan(`[${step.action}]`).padEnd(12) : ''.padEnd(10)
      const timer = step.timerMinutes ? chalk.dim(` (~${formatMinutes(step.timerMinutes)})`) : ''
      lines.push(`  ${chalk.dim(num + '.')} ${action} ${step.text}${timer}`)
    }
  }

  return lines.join('\n')
}

function renderNutrition(nutrition: RecipeViewModel['nutrition']): string {
  if (!nutrition?.perPortion) return ''
  const p = nutrition.perPortion
  const lines: string[] = [
    '',
    chalk.bold('NUTRITION (per serving)'),
    `  ${'Calories'.padEnd(12)} ${p.calories} kcal`,
    `  ${'Carbs'.padEnd(12)} ${p.carbs} g`,
    `  ${'Protein'.padEnd(12)} ${p.protein} g`,
    `  ${'Fat'.padEnd(12)} ${p.fat} g`,
  ]
  if (p.fiber != null) lines.push(`  ${'Fiber'.padEnd(12)} ${p.fiber} g`)
  if (nutrition.isEstimate) lines.push(chalk.dim('  * estimated values'))
  return lines.join('\n')
}

function renderMissingWarning(missing: string[]): string {
  if (missing.length === 0) return ''
  return (
    '\n' +
    chalk.yellow(
      `⚠ ${missing.length} ingredient${missing.length !== 1 ? 's' : ''} missing nutrition data — run \`gram db enrich\``,
    )
  )
}

export function renderRecipe(model: RecipeViewModel): string {
  return [
    renderHeader(model),
    renderShoppingList(model.shoppingList),
    renderSections(model.sections),
    renderNutrition(model.nutrition),
    renderMissingWarning(model.missingIngredients),
    '',
  ].join('\n')
}

export async function outputRecipe(model: RecipeViewModel, noPager: boolean): Promise<void> {
  // Force chalk colors before rendering so ANSI codes are present even when piping to less
  const savedLevel = chalk.level
  if (chalk.level === 0) chalk.level = 1

  const content = renderRecipe(model)

  const lineCount = content.split('\n').length
  const termRows = process.stdout.rows ?? 24
  const usePager = !noPager && process.stdout.isTTY && lineCount > termRows * 0.85

  if (usePager) {
    await new Promise<void>((resolve, reject) => {
      const less = spawn('less', ['-R', '--quit-if-one-screen'], {
        stdio: ['pipe', 'inherit', 'inherit'],
      })
      less.stdin.write(content)
      less.stdin.end()
      less.on('close', resolve)
      less.on('error', reject)
    })
  } else {
    process.stdout.write(content)
  }

  chalk.level = savedLevel
}

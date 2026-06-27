import chalk from 'chalk'
import { log } from '@clack/prompts'
import type { DiffResult, IngredientDelta, TimingDelta, SectionDelta } from '@gram/analyzer'

function fmtQty(qty?: number, unit?: string | null): string {
  if (qty === undefined) return '?'
  const rounded = Math.abs(qty - Math.round(qty)) < 0.005 ? Math.round(qty) : parseFloat(qty.toFixed(2))
  return unit ? `${rounded}${unit}` : String(rounded)
}

function fmtMinutes(m: number): string {
  if (m === 0) return '0 min'
  const h = Math.floor(Math.abs(m) / 60)
  const min = Math.abs(m) % 60
  const sign = m < 0 ? '-' : '+'
  if (h > 0 && min > 0) return `${sign}${h}h ${min} min`
  if (h > 0) return `${sign}${h}h`
  return `${sign}${min} min`
}

const TIMING_LABELS: Record<string, string> = {
  totalTime: 'Total time',
  activeTime: 'Active time',
  preparationTime: 'Prep time',
}

function renderIngredient(d: IngredientDelta): string {
  const name = (d.name || d.id).padEnd(18)

  if (d.change === 'added') {
    const qty = chalk.green(fmtQty(d.toQty, d.toUnit))
    return `  ${chalk.green('+')} ${name} ${qty}`
  }
  if (d.change === 'removed') {
    const qty = chalk.red(fmtQty(d.fromQty, d.fromUnit))
    return `  ${chalk.red('-')} ${name} ${qty}`
  }

  // changed
  const from = chalk.dim(fmtQty(d.fromQty, d.fromUnit))
  const to = chalk.yellow(fmtQty(d.toQty, d.toUnit))
  const pct = d.percentChange !== undefined
    ? chalk.dim(` (${d.percentChange > 0 ? '+' : ''}${d.percentChange}%)`)
    : ''
  return `  ${chalk.yellow('~')} ${name} ${from} → ${to}${pct}`
}

function renderTiming(d: TimingDelta): string {
  const label = (TIMING_LABELS[d.field] ?? d.field).padEnd(18)
  const from = chalk.dim(`${d.from} min`)
  const to = chalk.yellow(`${d.to} min`)
  const delta = fmtMinutes(d.to - d.from)
  return `  ${chalk.yellow('~')} ${label} ${from} → ${to} ${chalk.dim(`(${delta})`)}`
}

function renderSection(d: SectionDelta): string {
  const title = d.title ? `"${d.title}"` : '(unnamed)'

  if (d.change === 'added') {
    const steps = d.toStepCount !== undefined ? ` — ${d.toStepCount} step${d.toStepCount !== 1 ? 's' : ''}` : ''
    return `  ${chalk.green('+')} Section ${title}${steps}`
  }
  if (d.change === 'removed') {
    return `  ${chalk.red('-')} Section ${title}`
  }

  const from = d.fromStepCount ?? 0
  const to = d.toStepCount ?? 0
  const diff = to - from
  const sign = diff > 0 ? '+' : ''
  return `  ${chalk.yellow('~')} Section ${title} — ${chalk.dim(`${from}`)} → ${chalk.yellow(`${to}`)} steps ${chalk.dim(`(${sign}${diff})`)}`
}

export function renderDiffResult(result: DiffResult, label: string): void {
  console.log()
  console.log(`  ${chalk.bold('Semantic diff:')} ${chalk.dim(label)}`)

  if (!result.hasChanges) {
    console.log()
    log.info('No semantic changes detected.')
    return
  }

  if (result.titleChanged) {
    console.log()
    console.log(`  ${chalk.yellow('~')} ${'Title'.padEnd(18)} ${chalk.dim(result.fromTitle ?? '(none)')} → ${chalk.yellow(result.toTitle ?? '(none)')}`)
  }

  if (result.ingredients.length > 0) {
    console.log()
    console.log(`  ${chalk.bold('INGREDIENTS')}`)
    for (const d of result.ingredients) {
      console.log(renderIngredient(d))
    }
  }

  if (result.timings.length > 0) {
    console.log()
    console.log(`  ${chalk.bold('TIMING')}`)
    for (const d of result.timings) {
      console.log(renderTiming(d))
    }
  }

  if (result.sections.length > 0) {
    console.log()
    console.log(`  ${chalk.bold('SECTIONS')}`)
    for (const d of result.sections) {
      console.log(renderSection(d))
    }
  }

  console.log()
}

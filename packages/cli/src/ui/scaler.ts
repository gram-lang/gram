import chalk from 'chalk'
import { log } from '@clack/prompts'
import { fmtNumber } from '../core/format'
import type { ScaleResult } from '../services/scaler'

function fmtQty(qty: number, unit: string | null): string {
  // Show integers without decimals, trim trailing zeros otherwise
  const rounded = Math.abs(qty - Math.round(qty)) < 0.005 ? Math.round(qty) : parseFloat(qty.toFixed(2))
  return unit ? `${fmtNumber(rounded)}${unit}` : fmtNumber(rounded, 1)
}

export function renderScaleResult(result: ScaleResult): void {
  const { title, factor, items, warnings } = result

  const factorStr = factor === Math.round(factor) ? `×${factor}` : `×${factor.toFixed(2)}`
  const header = title ? `${title} — ${factorStr}` : factorStr

  const scalable = items.filter(i => !i.nonScalable)
  const nonScalable = items.filter(i => i.nonScalable)

  console.log()
  console.log(`  ${chalk.bold(header)}`)
  console.log()

  const COL_NAME = 22
  const COL_QTY = 11

  if (scalable.length > 0) {
    console.log(
      `  ${'Ingredient'.padEnd(COL_NAME)} ${chalk.dim('Original'.padStart(COL_QTY))} ${chalk.dim('Scaled'.padStart(COL_QTY))}`,
    )
    console.log(`  ${'─'.repeat(COL_NAME + COL_QTY * 2 + 3)}`)

    for (const item of scalable) {
      const name = (item.name || item.id).slice(0, COL_NAME).padEnd(COL_NAME)
      const orig = chalk.dim(fmtQty(item.originalQty!, item.unit ?? null).padStart(COL_QTY))
      const scaled = chalk.green(fmtQty(item.scaledQty!, item.unit ?? null).padStart(COL_QTY))
      console.log(`  ${name} ${orig} ${scaled}`)
    }
  }

  if (nonScalable.length > 0) {
    if (scalable.length > 0) console.log()
    console.log(`  ${chalk.dim('Non-scalable (kept as-is):')}`)
    for (const item of nonScalable) {
      const name = (item.name || item.id).slice(0, COL_NAME).padEnd(COL_NAME)
      console.log(`  ${name} ${chalk.dim('—')}`)
    }
  }

  console.log()

  if (warnings.length > 0) {
    for (const w of warnings) {
      log.warn(w)
    }
    console.log()
  }
}

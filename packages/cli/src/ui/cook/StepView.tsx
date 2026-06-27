import React from 'react'
import { Box, Text } from 'ink'
import type { ActiveTimer, FlatStep } from './types'
import type { CompilationResult } from '@gram/kitchen'
import { stepToText } from './prepare'

function fmtCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtQty(item: any): string {
  if (item.qty == null) return ''
  const n = typeof item.qty === 'number' ? item.qty : (item.qty?.value ?? '')
  return ` ${n}${item.unit ?? ''}`
}

interface Props {
  flatStep: FlatStep
  stepIndex: number
  totalSteps: number
  title: string | null
  activeTimers: ActiveTimer[]
  tick: number
  quitConfirm: boolean
  timerSelect: boolean
  timerSelectIndex: number
  registry: CompilationResult['registry']
  width: number
}

export default function StepView({
  flatStep,
  stepIndex,
  totalSteps,
  title,
  activeTimers,
  tick: _tick,
  quitConfirm,
  timerSelect,
  timerSelectIndex,
  registry,
  width,
}: Props) {
  const { step, timers, sectionTitle } = flatStep
  const now = Date.now()

  const instructionText = stepToText(step.content ?? [], registry)
  const stepIngredients = (step.content ?? []).filter(
    (t: any) => t && t.id && t.type !== 'reference' && t.type !== 'cookware',
  )
  const hasAction = step.action && step.action.trim()
  const stepNum = stepIndex + 1

  const runningTimers = activeTimers.filter(t => !t.done)
  const doneTimers = activeTimers.filter(t => t.done)
  const availableTimers = timers.filter(t => !activeTimers.some(a => a.id === t.id))

  const divider = '─'.repeat(Math.min(width - 4, 52))

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width={width}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold>{title ?? 'Recipe'}</Text>
        <Text dimColor>{stepNum} / {totalSteps}</Text>
      </Box>

      {sectionTitle && <Text dimColor>  {sectionTitle}</Text>}
      <Text> </Text>

      {/* Action */}
      {hasAction && (
        <Text bold color="cyan">[{step.action!.toUpperCase()}]</Text>
      )}

      {/* Step ingredients */}
      {stepIngredients.length > 0 && (
        <>
          <Text dimColor>Ingredients for this step:</Text>
          {stepIngredients.map((item: any, i: number) => (
            <Text key={i}>
              {'  • '}
              <Text color="yellow">{item.alias ?? registry.ingredients[item.id]?.name ?? item.name ?? item.id}</Text>
              <Text dimColor>{fmtQty(item)}</Text>
            </Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Instructions */}
      {instructionText.split('\n').map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}

      <Text> </Text>
      <Text dimColor>{divider}</Text>

      {/* Timer panel */}
      {runningTimers.length > 0 && (
        <>
          {runningTimers.map(t => {
            const remaining = t.startedAt + t.durationMs - now
            const pct = Math.max(0, Math.min(1, remaining / t.durationMs))
            const barW = 12
            const filled = Math.round(pct * barW)
            const bar = '█'.repeat(filled) + '░'.repeat(barW - filled)
            return (
              <Text key={t.id}>
                {'  ⏱ '}
                <Text color="yellow">{t.name.padEnd(14)}</Text>
                <Text bold> {fmtCountdown(remaining)} </Text>
                <Text dimColor>{bar}</Text>
              </Text>
            )
          })}
          <Text> </Text>
        </>
      )}

      {doneTimers.length > 0 && (
        <>
          {doneTimers.map(t => (
            <Text key={t.id} color="green">{'  ✓ '}{t.name} — DONE  <Text dimColor>[any key to dismiss]</Text></Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Timer selector */}
      {timerSelect && (
        <>
          <Text>Start timer:</Text>
          {timers.map((t, i) => (
            <Text key={t.id}>
              {i === timerSelectIndex ? <Text color="cyan">  › {t.name}</Text> : <Text>{'    '}{t.name}</Text>}
            </Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Quit confirm */}
      {quitConfirm ? (
        <Text color="yellow">  Timer is running — really quit? [Y / any key to cancel]</Text>
      ) : (
        <Box>
          <Text dimColor>  [Space] Next  [B] Back  </Text>
          {availableTimers.length > 0 && <Text dimColor>[T] Timer  </Text>}
          <Text dimColor>[Q] Quit</Text>
        </Box>
      )}
    </Box>
  )
}

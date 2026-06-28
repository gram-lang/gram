import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useApp, useStdout } from 'ink'
import type { RecipeData, ActiveTimer, Phase } from './types'
import MiseEnPlace from './MiseEnPlace'
import StepView from './StepView'
import EndScreen from './EndScreen'
import { fmtQty, fmtMass, fmtCountdown, shouldShowMass } from './prepare'

interface Props {
  recipe: RecipeData
}

export default function App({ recipe }: Props) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 72

  const [phase, setPhase] = useState<Phase>('mise-en-place')
  const [stepIndex, setStepIndex] = useState(0)
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([])
  const [tick, setTick] = useState(0)
  const [quitConfirm, setQuitConfirm] = useState(false)
  const [timerSelect, setTimerSelect] = useState(false)
  const [timerSelectIndex, setTimerSelectIndex] = useState(0)
  const [startTime] = useState(() => Date.now())

  const totalSteps = recipe.steps.length
  const currentFlat = recipe.steps[stepIndex]

  // Tick every second for timer countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Bell + done flag when a timer completes
  useEffect(() => {
    setActiveTimers(prev => {
      const now = Date.now()
      let changed = false
      const next = prev.map(t => {
        if (!t.done && now - t.startedAt >= t.durationMs) {
          process.stdout.write('\x07')
          changed = true
          return { ...t, done: true }
        }
        return t
      })
      return changed ? next : prev
    })
  }, [tick])

  const startTimer = useCallback((timer: { id: string; name: string; durationMs: number }) => {
    setActiveTimers(prev => {
      if (prev.some(t => t.id === timer.id && !t.done)) return prev
      return [...prev, { ...timer, startedAt: Date.now(), done: false }]
    })
  }, [])

  const dismissDoneTimer = useCallback(() => {
    setActiveTimers(prev => {
      const doneIdx = prev.findIndex(t => t.done)
      if (doneIdx === -1) return prev
      return prev.filter((_, i) => i !== doneIdx)
    })
  }, [])

  useInput((input, key) => {
    // Timer selector mode
    if (timerSelect) {
      if (key.upArrow) setTimerSelectIndex(i => Math.max(0, i - 1))
      if (key.downArrow) {
        setTimerSelectIndex(i => Math.min((currentFlat?.timers.length ?? 1) - 1, i + 1))
      }
      if (key.return || input === ' ') {
        const t = currentFlat?.timers[timerSelectIndex]
        if (t) startTimer(t)
        setTimerSelect(false)
      }
      if (key.escape || input === 'q' || input === 'Q') setTimerSelect(false)
      return
    }

    // Quit confirm
    if (quitConfirm) {
      if (input === 'y' || input === 'Y') exit()
      else setQuitConfirm(false)
      return
    }

    // Dismiss done timer with any key (except quit)
    const hasDone = activeTimers.some(t => t.done)
    if (hasDone && input !== 'q' && input !== 'Q' && !key.escape) {
      dismissDoneTimer()
      return
    }

    // Quit
    if (input === 'q' || input === 'Q' || key.escape) {
      const hasRunning = activeTimers.some(t => !t.done)
      if (hasRunning) setQuitConfirm(true)
      else exit()
      return
    }

    // Navigation: next
    if (input === ' ' || key.return) {
      if (phase === 'mise-en-place') {
        if (totalSteps === 0) { setPhase('end'); return }
        setPhase('section-start')
        return
      }
      if (phase === 'section-start') { setPhase('cooking'); return }
      if (phase === 'cooking') {
        const next = stepIndex + 1
        if (next >= totalSteps) { setPhase('end'); return }
        setStepIndex(next)
        setPhase(recipe.steps[next]!.isFirstOfSection ? 'section-start' : 'cooking')
      }
      return
    }

    // Navigation: back
    if (input === 'b' || input === 'B') {
      if (phase === 'section-start') {
        if (stepIndex === 0) setPhase('mise-en-place')
        else { setStepIndex(stepIndex - 1); setPhase('cooking') }
        return
      }
      if (phase === 'cooking') {
        if (stepIndex === 0) setPhase('mise-en-place')
        else { setStepIndex(stepIndex - 1); setPhase('cooking') }
      }
      return
    }

    // Timer
    if ((input === 't' || input === 'T') && phase === 'cooking') {
      if (!currentFlat) return
      const available = currentFlat.timers.filter(t => !activeTimers.some(a => a.id === t.id && !a.done))
      if (available.length === 0) return
      if (available.length === 1) { startTimer(available[0]!); return }
      setTimerSelect(true)
      setTimerSelectIndex(0)
    }
  })

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'mise-en-place') {
    return <MiseEnPlace title={recipe.title} items={recipe.shoppingList} massMap={recipe.massMap} width={width} />
  }

  if (phase === 'section-start' && currentFlat) {
    const runningTimers = activeTimers.filter(t => !t.done)
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} width={width}>
        <Box justifyContent="space-between">
          <Text bold>{recipe.title ?? 'Recipe'}</Text>
          {runningTimers.length > 0 && (
            <Box>
              {runningTimers.map(t => (
                <Text key={t.id} bold color="yellow">⏱ {fmtCountdown(t.startedAt + t.durationMs - Date.now())}  </Text>
              ))}
            </Box>
          )}
        </Box>
        <Text> </Text>
        <Text bold color="cyan">
          {currentFlat.sectionTitle ? `Section: ${currentFlat.sectionTitle}` : 'New section'}
        </Text>
        <Text> </Text>
        {currentFlat.sectionIngredients.length > 0 && (
          <>
            <Text dimColor>Ingredients for this section:</Text>
            {currentFlat.sectionIngredients.map((ing, idx) => {
              const mass = recipe.massMap[ing.id]
              const qtyStr = ing.quantities
                ? ing.quantities.map(q => fmtQty({ qty: q.qty, unit: q.unit }).trim()).join(' + ')
                : null
              const showMass = mass != null && ing.quantities != null &&
                ing.quantities.some(q => shouldShowMass(q.unit))
              return (
                <Text key={`${ing.id}-${idx}`}>
                  {'  • '}
                  <Text color="yellow">{ing.name}</Text>
                  {qtyStr && <Text>  {qtyStr}</Text>}
                  {showMass && <Text dimColor>  ≈ {fmtMass(mass!)}</Text>}
                </Text>
              )
            })}
            <Text> </Text>
          </>
        )}
        <Text dimColor>  [Space] Start section  [B] Back</Text>
      </Box>
    )
  }

  if (phase === 'cooking' && currentFlat) {
    return (
      <StepView
        flatStep={currentFlat}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        title={recipe.title}
        activeTimers={activeTimers}
        tick={tick}
        quitConfirm={quitConfirm}
        timerSelect={timerSelect}
        timerSelectIndex={timerSelectIndex}
        registry={recipe.registry}
        massMap={recipe.massMap}
        width={width}
      />
    )
  }

  if (phase === 'end') {
    return <EndScreen title={recipe.title} elapsedMs={Date.now() - startTime} onQuit={exit} />
  }

  return null
}

import React from 'react'
import { Box, Text } from 'ink'
import { fmtQty, fmtMass } from './prepare'

interface Props {
  title: string | null
  items: any[]
  massMap: Record<string, number>
  width: number
}

export default function MiseEnPlace({ title, items, massMap, width }: Props) {
  const base = items.filter(i => i.type !== 'composite' && i.type !== 'alternative')
  const seen = new Set<string>()
  const deduped = base.filter((i: any) => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
  const scalable = deduped.filter(i => i.qty != null)
  const other = deduped.filter(i => i.qty == null)

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width={width}>
      <Text bold>{title ?? 'Recipe'}</Text>
      <Text> </Text>
      <Text bold underline>Ingredients (mise en place)</Text>
      <Text> </Text>
      {scalable.map((item: any) => {
        const mass = massMap[item.id]
        return (
          <Text key={item.id}>
            {'  • '}
            <Text>{(item.name ?? item.id).padEnd(22)}</Text>
            <Text color="green">{fmtQty(item).trimStart()}</Text>
            {mass != null && <Text dimColor>{' ≈ '}{fmtMass(mass)}</Text>}
          </Text>
        )
      })}
      {other.map((item: any) => (
        <Text key={item.id} dimColor>{'  • '}{item.name ?? item.id}</Text>
      ))}
      <Text> </Text>
      <Text dimColor>{'─'.repeat(Math.min(width - 4, 44))}</Text>
      <Text dimColor>  [Space] Ready — start cooking</Text>
    </Box>
  )
}

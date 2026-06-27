import React from 'react'
import { Box, Text } from 'ink'

interface Props {
  title: string | null
  items: any[]
  width: number
}

export default function MiseEnPlace({ title, items, width }: Props) {
  const scalable = items.filter(i => i.type !== 'composite' && i.type !== 'alternative' && i.qty != null)
  const other = items.filter(i => i.type !== 'composite' && i.type !== 'alternative' && i.qty == null)

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width={width}>
      <Text bold>{title ?? 'Recipe'}</Text>
      <Text> </Text>
      <Text bold underline>Ingredients (mise en place)</Text>
      <Text> </Text>
      {scalable.map((item: any) => {
        const qty = typeof item.qty === 'number' ? item.qty : (item.qty?.value ?? '')
        const unit = item.unit ? item.unit : ''
        return (
          <Text key={item.id}>
            {'  • '}
            <Text>{(item.name ?? item.id).padEnd(22)}</Text>
            <Text color="green">{String(qty)}{unit}</Text>
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

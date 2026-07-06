import { isSeq, Scalar, type Document } from 'yaml'

// `parseDocument()`'s inferred return type distributes into a large union of
// `Document<X, boolean>` variants, which is impractical to thread through call
// sites that only need `createNode`/`get`/`set`. `Document<any, any>` accepts
// every concrete variant these helpers are actually called with.
type Doc = Document<any, any>

export function quotedScalar(doc: Doc, value: string): Scalar {
  const node = doc.createNode(value) as Scalar
  node.type = Scalar.QUOTE_DOUBLE
  return node
}

export function addAliasesToNode(doc: Doc, ingNode: any, aliases: string[]): void {
  const aliasesNode = ingNode.get('aliases', true)
  const existing: string[] = isSeq(aliasesNode) ? (aliasesNode.toJSON() as string[]) : []
  const merged = Array.from(new Set([...existing, ...aliases]))
  if (isSeq(aliasesNode)) {
    aliasesNode.items.length = 0
    for (const a of merged) aliasesNode.add(quotedScalar(doc, a))
  } else {
    const seq = doc.createNode([] as string[])
    for (const a of merged) (seq as any).add(quotedScalar(doc, a))
    ingNode.set('aliases', seq)
  }
}

export function removeIngredientKey(map: any, key: string): void {
  const idx = map.items.findIndex((pair: any) => String(pair.key) === key)
  if (idx !== -1) map.items.splice(idx, 1)
}

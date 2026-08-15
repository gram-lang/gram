import {
	isNode,
	isSeq,
	Scalar,
	type Document,
	type YAMLMap,
	type YAMLSeq,
} from "yaml";

// `parseDocument()`'s inferred return type distributes into a large union of
// `Document<X, boolean>` variants, which is impractical to thread through call
// sites that only need `createNode`/`get`/`set`. `Document<any, any>` accepts
// every concrete variant these helpers are actually called with.
type Doc = Document<any, any>;

function quotedScalar(doc: Doc, value: string): Scalar {
	const node = doc.createNode(value) as Scalar;
	node.type = Scalar.QUOTE_DOUBLE;
	return node;
}

export function addAliasesToNode(
	doc: Doc,
	ingNode: YAMLMap,
	aliases: string[],
): void {
	const aliasesNode = ingNode.get("aliases", true);
	const existing: string[] = isSeq(aliasesNode)
		? (aliasesNode.toJSON() as string[])
		: [];
	const merged = Array.from(new Set([...existing, ...aliases]));
	if (isSeq(aliasesNode)) {
		aliasesNode.items.length = 0;
		for (const a of merged) aliasesNode.add(quotedScalar(doc, a));
	} else {
		const seq = doc.createNode([] as string[]) as YAMLSeq<Scalar>;
		for (const a of merged) seq.add(quotedScalar(doc, a));
		ingNode.set("aliases", seq);
	}
}

export function removeIngredientKey(map: YAMLMap, key: string): void {
	const idx = map.items.findIndex((pair) => String(pair.key) === key);
	if (idx !== -1) map.items.splice(idx, 1);
}

// Writes `value` under `key` on `map`, optionally tagging it with a trailing
// YAML comment (e.g. " [LLM]" for an unreviewed AI estimate). `YAMLMap.set`
// with a raw JS value stores a plain scalar that ignores `.comment` at
// stringify time, so this goes through `doc.createNode` to get a real
// `Scalar` node first. If `map` was parsed as a flow map (`{}` on one line),
// comments on its children are silently dropped at stringify — forcing
// `flow = false` avoids that (and converts that one block to multiline,
// which is an acceptable, generally more readable, formatting side effect).
export function setProvenancedField(
	doc: Doc,
	map: YAMLMap,
	key: string,
	value: unknown,
	provenance: string | null,
): void {
	if (map.flow) map.flow = false;
	const node = doc.createNode(value);
	map.set(key, node);
	if (provenance) {
		const pair = map.items.find((p) => String(p.key) === key);
		if (pair && isNode(pair.value)) pair.value.comment = provenance;
	}
}

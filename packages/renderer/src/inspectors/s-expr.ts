/**
 * An AST as an S-expression: one node per line, `(Type :attr value` then its
 * children indented below. `type` and `loc` are left out; a `{ min, max }`
 * range is written `min-max`.
 */
export function renderSExpr(node: unknown, level = 0): string {
	if (node === null || node === undefined) return "nil";
	if (typeof node !== "object") {
		if (typeof node === "string") return `"${node}"`;
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map((n) => renderSExpr(n, level)).join("\n");
	}
	const indent = "  ".repeat(level);
	const record = node as Record<string, unknown>;
	const type = (record.type as string | undefined) || "Object";
	let attrs = "";
	const children: unknown[] = [];

	for (const [k, v] of Object.entries(record)) {
		if (k === "type" || k === "loc" || v === null) continue;
		if (typeof v !== "object") {
			attrs += ` :${k} ${typeof v === "string" ? `"${v}"` : v}`;
		} else if (Array.isArray(v)) {
			children.push(...v);
		} else if ("min" in v && "max" in v) {
			const range = v as { min: unknown; max: unknown };
			attrs += ` :${k} ${range.min}-${range.max}`;
		} else {
			children.push(v);
		}
	}
	if (children.length === 0) return `${indent}(${type}${attrs})`;
	const childrenStr = children.map((c) => renderSExpr(c, level + 1)).join("\n");
	return `${indent}(${type}${attrs}\n${childrenStr})`;
}

import { escapeHtml } from "../shared/utils";
import css from "./json-tree.css" with { type: "text" };

/**
 * The stylesheet of `renderJsonTree`. Its colors are CSS variables
 * (`--gram-json-key`, `--gram-json-string`, `--gram-json-punct`,
 * `--gram-json-muted`, `--gram-json-guide`, `--gram-json-hover`) that each
 * surface maps to its own theme, light and dark.
 */
export const JSON_TREE_CSS: string = css;

export interface JsonTreeOptions {
	/**
	 * How many levels start unfolded: `0` folds everything below the root's
	 * own line, the default (`Infinity`) unfolds everything.
	 */
	expandDepth?: number;
}

const span = (cls: string, text: string) =>
	`<span class="${cls}">${escapeHtml(text)}</span>`;
const COMMA = span("jt-punct", ",");

/**
 * Data as a tree that folds, with no script and no framework: each object and
 * array is a native `<details>`, so a node folds and unfolds with the mouse and
 * the keyboard. A folded node shows how many items it holds. Keys and strings
 * are escaped. Style it with `JSON_TREE_CSS`.
 */
export function renderJsonTree(
	data: unknown,
	options: JsonTreeOptions = {},
): string {
	const expandDepth = options.expandDepth ?? Number.POSITIVE_INFINITY;
	const seen = new WeakSet<object>();

	function node(
		value: unknown,
		name: string | undefined,
		last: boolean,
		depth: number,
	): string {
		const label =
			name === undefined
				? ""
				: `${span("jt-key", JSON.stringify(name))}${span("jt-punct", ": ")}`;
		const comma = last ? "" : COMMA;
		if (value === null || typeof value !== "object") {
			return `<div class="jt-line">${label}${primitive(value)}${comma}</div>`;
		}
		if (seen.has(value)) {
			return `<div class="jt-line">${label}${span("jt-null", "[Circular]")}${comma}</div>`;
		}
		const isArray = Array.isArray(value);
		const entries: [string | undefined, unknown][] = isArray
			? (value as unknown[]).map((v) => [undefined, v === undefined ? null : v])
			: Object.entries(value as Record<string, unknown>)
					.filter(([, v]) => v !== undefined && typeof v !== "function")
					.map(([k, v]) => [k, v]);
		const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
		if (entries.length === 0) {
			return `<div class="jt-line">${label}${span("jt-punct", open + close)}${comma}</div>`;
		}
		seen.add(value);
		const children = entries
			.map(([k, v], i) => node(v, k, i === entries.length - 1, depth + 1))
			.join("");
		seen.delete(value);
		const count = `${entries.length} ${entries.length === 1 ? "item" : "items"}`;
		return (
			`<details class="jt-node"${depth < expandDepth ? " open" : ""}>` +
			`<summary class="jt-line">${label}${span("jt-punct", open)}` +
			`<span class="jt-folded">${span("jt-count", count)}${span("jt-punct", close)}${comma}</span>` +
			`</summary><div class="jt-children">${children}</div>` +
			`<div class="jt-line">${span("jt-punct", close)}${comma}</div></details>`
		);
	}

	return `<div class="gram-json-tree">${node(data, undefined, true, 0)}</div>`;
}

function primitive(value: unknown): string {
	switch (typeof value) {
		case "string":
			return span("jt-string", JSON.stringify(value));
		case "number":
			return span("jt-number", Number.isFinite(value) ? String(value) : "null");
		case "boolean":
			return span("jt-boolean", String(value));
		case "bigint":
			return span("jt-number", String(value));
		default:
			return span("jt-null", "null");
	}
}

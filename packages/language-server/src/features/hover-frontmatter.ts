import { type Hover, MarkupKind, type Position } from "vscode-languageserver";
import { getDictionary } from "@gram-lang/i18n";
import { frontmatterKey } from "@gram-lang/kitchen";
import type { DocumentState } from "../document-state";
import { offsetToPosition, positionToOffset } from "../utils/position";
import { frontmatterKeyAt, scanFrontmatter } from "../utils/frontmatter-text";

/**
 * The hover of a frontmatter key Gram knows: what it means and the kind of
 * value it takes, in the editor's language, and for a deprecated key what
 * its replacement means. Read from the text, so it works on a block the
 * grammar has not taken (no closing `---` yet, a `# …` line).
 */
export function provideFrontmatterHover(
	state: DocumentState,
	position: Position,
	locale?: string,
): Hover | null {
	const block = scanFrontmatter(state.text);
	if (!block) return null;
	const at = frontmatterKeyAt(
		block,
		positionToOffset(state.lineStarts, position),
	);
	const def = at && frontmatterKey(at.key);
	if (!at || !def) return null;

	const t = getDictionary(locale).frontmatter;
	const lines = [
		`**\`${def.key}\`** · ${t.values[def.value]}`,
		t.keys[def.key],
	];
	const replacement =
		def.deprecated && frontmatterKey(def.deprecated.replacement);
	if (replacement) {
		lines.push(
			`**\`${replacement.key}\`** · ${t.values[replacement.value]}`,
			t.keys[replacement.key],
		);
	}
	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: lines.filter(Boolean).join("\n\n"),
		},
		range: {
			start: offsetToPosition(state.lineStarts, at.start),
			end: offsetToPosition(state.lineStarts, at.end),
		},
	};
}

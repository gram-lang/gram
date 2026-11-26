import {
	type CompletionItem,
	CompletionItemKind,
	MarkupKind,
	type Position,
} from "vscode-languageserver";
import { getDictionary } from "@gram-lang/i18n";
import {
	canonicalFrontmatterKeys,
	type FrontmatterKeyDefinition,
	frontmatterKey,
} from "@gram-lang/kitchen";
import { isFrontmatterLine, scanFrontmatter } from "@gram-lang/modules/lint";

const KEY_PREFIX = /^[\p{L}\p{N}_-]*$/u;

/**
 * The completions of a cursor in the frontmatter, read from the live text
 * (the block may not parse yet: no closing `---`), or null when the cursor
 * is not in one, so the other completions take over. In the frontmatter,
 * only the name of a key is completed: the canonical keys not written yet,
 * a deprecated key standing for its replacement. Nothing else (no
 * ingredient on `@`, no name on `#`).
 */
export function provideFrontmatterCompletions(
	text: string,
	position: Position,
	locale?: string,
): CompletionItem[] | null {
	const block = scanFrontmatter(text);
	if (!block) return null;
	const lines = text.split("\n");
	const line = (lines[position.line] ?? "").replace(/\r$/, "");
	const prefix = line.slice(0, position.character);
	const rest = line.slice(position.character);
	const typingKey = KEY_PREFIX.test(prefix) && rest.trim() === "";
	// A block with no closing `---` stops at the line being typed (a key
	// with no `:` yet): that line still belongs to it, as long as it is a
	// key's name; anything else there is the recipe's.
	const inside =
		isFrontmatterLine(block, position.line) ||
		(!block.closed && position.line === block.endLine && typingKey);
	if (!inside) return null;
	if (!typingKey) return [];

	const present = new Set<string>();
	for (const { key, line: keyLine } of block.keys) {
		if (keyLine === position.line) continue;
		present.add(frontmatterKey(key)?.deprecated?.replacement ?? key);
	}
	const t = getDictionary(locale).frontmatter;
	return canonicalFrontmatterKeys()
		.filter((def) => !present.has(def.key))
		.map((def, i) => keyCompletion(def, i, t, position, prefix.length));
}

function keyCompletion(
	def: FrontmatterKeyDefinition,
	index: number,
	t: ReturnType<typeof getDictionary>["frontmatter"],
	position: Position,
	typed: number,
): CompletionItem {
	const description = t.keys[def.key];
	return {
		label: def.key,
		kind: CompletionItemKind.Property,
		detail: t.values[def.value],
		documentation: {
			kind: MarkupKind.Markdown,
			value: [description, `\`${def.example}\``].filter(Boolean).join("\n\n"),
		},
		// The registry's order (title first), not the alphabet.
		sortText: String(index).padStart(2, "0"),
		textEdit: {
			range: {
				start: { line: position.line, character: position.character - typed },
				end: position,
			},
			newText: `${def.key}: `,
		},
	};
}

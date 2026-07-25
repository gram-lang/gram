import type { TextEdit, Range } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { formatGram } from "@gram-lang/format";

/**
 * This used to be an independent, line-by-line implementation with its own
 * (smaller) rule set — now a thin wrapper turning the shared
 * `@gram-lang/format` formatter's
 * full-text output into the single whole-document `TextEdit` the LSP
 * protocol expects. See `@gram-lang/format` for the actual formatting rules.
 */
export function provideFormatting(state: DocumentState): TextEdit[] {
	const { content } = formatGram(state.text);
	if (content === state.text) return [];

	const lines = state.text.split("\n");
	const lastLine = lines.length - 1;
	const lastChar = lines[lastLine]?.length ?? 0;
	const fullRange: Range = {
		start: { line: 0, character: 0 },
		end: { line: lastLine, character: lastChar },
	};

	return [{ range: fullRange, newText: content }];
}

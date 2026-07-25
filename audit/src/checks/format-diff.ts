import { formatGram, hasChanges, summarizeChanges } from "@gram-lang/format";
import type { FormatterChanges } from "@gram-lang/format";
import type { Finding, Snippet } from "../types";

function rankOf(changes: FormatterChanges): number {
	let n = 0;
	for (const [key, value] of Object.entries(changes)) {
		n += key === "eofNewline" ? (value ? 1 : 0) : (value as number);
	}
	return n;
}

export function checkFormatDiff(snippet: Snippet): Finding[] {
	try {
		const { changes } = formatGram(snippet.content);
		if (!hasChanges(changes)) return [];
		return [
			{
				snippetId: snippet.id,
				check: "format-diff",
				severity: "flag",
				summary: summarizeChanges(changes),
				rank: rankOf(changes),
			},
		];
	} catch (e) {
		return [
			{
				snippetId: snippet.id,
				check: "format-diff",
				severity: "info",
				summary: `formatGram threw: ${e instanceof Error ? e.message : String(e)}`,
			},
		];
	}
}

// Must run before any other format-diff findings are trusted: if the
// formatter itself changes something in the human-verified trusted corpus,
// the tool (or the formatter) has a bug and every other format-diff finding
// in this run is unreliable until that's resolved.
export function calibrateFormatter(trustedSnippets: Snippet[]): {
	ok: boolean;
	failures: Finding[];
} {
	const failures: Finding[] = [];
	for (const snippet of trustedSnippets) {
		failures.push(...checkFormatDiff(snippet));
	}
	return { ok: failures.length === 0, failures };
}

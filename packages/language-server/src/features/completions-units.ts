import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { UNIT_DICTIONARIES, TIME_DICTIONARIES } from "@gram-lang/i18n";

export function isInsideBraces(prefix: string): boolean {
	let depth = 0;
	for (let i = prefix.length - 1; i >= 0; i--) {
		if (prefix[i] === "}") depth++;
		else if (prefix[i] === "{") {
			if (depth === 0) return true;
			depth--;
		}
	}
	return false;
}

function hasNumberBeforeCursor(prefix: string): boolean {
	const braceIdx = prefix.lastIndexOf("{");
	if (braceIdx === -1) return false;
	return /\d/.test(prefix.slice(braceIdx));
}

/**
 * True when the brace the cursor sits in opens a timer (`~{`, `~_{`,
 * `~eggs{`, `~_baking{`): only time units make sense there.
 */
export function isInsideTimer(prefix: string): boolean {
	const braceIdx = prefix.lastIndexOf("{");
	if (braceIdx === -1) return false;
	return /~_?[^\s~@#^&{}()[\]]*(?:[ \t]+[^\s~@#^&{}()[\]]+)*$/.test(
		prefix.slice(0, braceIdx),
	);
}

/**
 * Time units, from `TIME_DICTIONARIES`: the canonical ones first (`min`
 * stands for the key `m`, which reads too but is not how Gram writes a
 * minute), then every abbreviation of every language.
 */
function timeUnitCompletions(): CompletionItem[] {
	const items: CompletionItem[] = [];
	const seen = new Set<string>();
	const add = (label: string, canonical: string, rank: number) => {
		if (seen.has(label)) return;
		seen.add(label);
		items.push({
			label,
			kind: CompletionItemKind.Unit,
			detail: canonical !== label ? `→ ${canonical}` : undefined,
			sortText: `${rank}${label}`,
		});
	};
	const canonicalLabel = (key: string) => (key === "m" ? "min" : key);
	for (const key of Object.keys(TIME_DICTIONARIES.en))
		add(canonicalLabel(key), canonicalLabel(key), 0);
	let rank = 1;
	for (const dict of Object.values(TIME_DICTIONARIES)) {
		for (const [key, aliases] of Object.entries(dict))
			for (const alias of aliases) add(alias, canonicalLabel(key), rank);
		rank++;
	}
	return items;
}

export function provideUnitCompletions(prefix: string): CompletionItem[] {
	if (!hasNumberBeforeCursor(prefix)) return [];
	if (isInsideTimer(prefix)) return timeUnitCompletions();

	const items: CompletionItem[] = [];
	const seen = new Set<string>();

	function add(label: string, canonical: string, sortPrefix: string) {
		if (seen.has(label)) return;
		seen.add(label);
		items.push({
			label,
			kind: CompletionItemKind.Unit,
			detail: canonical !== label ? `→ ${canonical}` : undefined,
			sortText: sortPrefix + label,
		});
	}

	// Canonical unit labels (from dictionary keys) — highest priority
	for (const canon of Object.keys(UNIT_DICTIONARIES.en)) {
		add(canon, canon, "0");
	}

	// FR aliases first (primary locale in Gram)
	for (const [canon, aliases] of Object.entries(UNIT_DICTIONARIES.fr)) {
		for (const alias of aliases) add(alias, canon, "1");
	}

	// EN aliases
	for (const [canon, aliases] of Object.entries(UNIT_DICTIONARIES.en)) {
		for (const alias of aliases) add(alias, canon, "2");
	}

	return items;
}

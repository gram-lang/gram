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

/**
 * True when the term the cursor is in starts with a number: the whole brace
 * for `{200`, the term after the operator in a sum (`{1 cup + 2`,
 * `{1 cup - 2`), so `{1 cup + ` waits for its number. A `-` between two
 * numbers is a range (`{1-2`), not a new term.
 */
function hasNumberBeforeCursor(prefix: string): boolean {
	const braceIdx = prefix.lastIndexOf("{");
	if (braceIdx === -1) return false;
	const inner = prefix.slice(braceIdx + 1);
	const term = inner.split(/\+|(?<=[^\d\s.,/-])\s*-|\s-\s/).pop() ?? inner;
	return /\d/.test(term);
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
 * The languages of a unit dictionary in the order completion ranks their
 * aliases: French first (Gram's primary locale), then English, then any
 * other, so time and quantity units rank the same way.
 */
function byLanguage<T>(dicts: Record<string, T>): T[] {
	const first = ["fr", "en"].filter((lang) => lang in dicts);
	const rest = Object.keys(dicts).filter((lang) => !first.includes(lang));
	return [...first, ...rest].map((lang) => dicts[lang] as T);
}

/**
 * Unit completions: the canonical labels first (rank 0), then the aliases of
 * each language in turn (rank 1, 2, …), each label offered once.
 */
function unitCompletions(
	canonicals: string[],
	dicts: Record<string, Record<string, string[]>>,
	canonicalLabel: (key: string) => string = (key) => key,
): CompletionItem[] {
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
	for (const key of canonicals)
		add(canonicalLabel(key), canonicalLabel(key), 0);
	byLanguage(dicts).forEach((dict, i) => {
		for (const [key, aliases] of Object.entries(dict))
			for (const alias of aliases) add(alias, canonicalLabel(key), i + 1);
	});
	return items;
}

/**
 * Time units, from `TIME_DICTIONARIES`: the canonical ones first (`min`
 * stands for the key `m`, which reads too but is not how Gram writes a
 * minute), then every abbreviation of every language.
 */
const timeUnitCompletions = (): CompletionItem[] =>
	unitCompletions(
		Object.keys(TIME_DICTIONARIES.en),
		TIME_DICTIONARIES,
		(key) => (key === "m" ? "min" : key),
	);

export function provideUnitCompletions(prefix: string): CompletionItem[] {
	if (!hasNumberBeforeCursor(prefix)) return [];
	if (isInsideTimer(prefix)) return timeUnitCompletions();
	return unitCompletions(Object.keys(UNIT_DICTIONARIES.en), UNIT_DICTIONARIES);
}

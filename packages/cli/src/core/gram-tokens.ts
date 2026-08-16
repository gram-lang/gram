import { slugify } from "@gram-lang/kitchen";

/**
 * Lexical scan for the `@ingredient` tokens a piece of .gram text *contains*,
 * independent of whether the parser kept them.
 *
 * This exists to answer one question the parser cannot: did anything the author
 * wrote fail to survive compilation? Comparing this list against the compiled
 * registry catches content that was silently swallowed — the motivating case
 * being an AI writing `@flour{} // TODO: unknown quantity, @sugar{}, @salt{}`,
 * where `//` comments to end of line and takes the next three ingredients with
 * it. That compiles cleanly, with no warning, and quietly loses ingredients.
 *
 * Deliberately mirrors the grammar's `simpleIngredient` and `composite` rules
 * (packages/parser/grammar.ohm) rather than approximating them: a token is
 *
 *     ("@" | "<@") modifier* refName alias? "{"      -- full
 *     ("@" | "<@") modifier* singleWordName          -- bare
 *
 * No PEG backtracking is needed here. `refName` cannot contain `{`, so a greedy
 * run of refName characters already stops exactly where a quantity could start.
 */

/** `modifier = "?" | "-" | "*" | "&" | "="` */
const MODIFIERS = new Set(["?", "-", "*", "&", "="]);

/** `syntaxChar = "{" | "}" | "[" | "]" | "(" | ")" | "<" | "|" | ":"` */
const SYNTAX_CHARS = new Set(["{", "}", "[", "]", "(", ")", "<", "|", ":"]);

/** `refSigil = "@" | "#" | "~" | "^" | "&"` */
const REF_SIGILS = new Set(["@", "#", "~", "^", "&"]);

/** `sentencePunct = "," | ";" | "!" | "?" | "."` */
const SENTENCE_PUNCT = new Set([",", ";", "!", "?", "."]);

/** `refName = (~(syntaxChar | refSigil | nl) any)+` */
function isRefNameChar(c: string): boolean {
	return !SYNTAX_CHARS.has(c) && !REF_SIGILS.has(c) && c !== "\n";
}

/** `singleWordName = (~(syntaxChar | space | nl | sentencePunct) any)+` */
function isSingleWordNameChar(c: string): boolean {
	return (
		!SYNTAX_CHARS.has(c) &&
		!SENTENCE_PUNCT.has(c) &&
		!/\s/.test(c) &&
		c !== "\n"
	);
}

/**
 * Blank out the comments a human (or the import prompt) wrote *on purpose*, so
 * their contents are not mistaken for lost ingredients.
 *
 * Only whole-line `//` comments and `/* *\/` blocks qualify. A `//` appearing
 * mid-sentence is exactly the failure this module exists to detect, so it is
 * left in place — the tokens it swallows must still be counted as written.
 * Replacing with spaces rather than deleting keeps every offset intact.
 */
function maskDeliberateComments(text: string): string {
	const blank = (m: string) => m.replace(/[^\n]/g, " ");
	return text
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/^[ \t]*\/\/[^\n]*/gm, blank);
}

export interface WrittenIngredient {
	/** The name as written, before slugification. */
	name: string;
	/** `slugify(name)` — the id the compiler would register it under. */
	id: string;
	/** 1-based line the token starts on, for error messages. */
	line: number;
	/**
	 * Whether this particular mention carried a non-empty quantity.
	 *
	 * `@salt{}` and a bare `@salt` are both false. Note that an empty quantity
	 * is perfectly valid Gram — "salt to taste" — so this is information, not a
	 * defect. See findUnquantifiedIngredients for the distinction that matters.
	 */
	quantified: boolean;
}

/**
 * Every `@ingredient` (and `<@parent`) token written in `text`, in source
 * order. Duplicates are kept: the caller decides whether repetition matters.
 */
export function findWrittenIngredients(text: string): WrittenIngredient[] {
	const src = maskDeliberateComments(text);
	const found: WrittenIngredient[] = [];
	let line = 1;
	let braceDepth = 0;

	for (let i = 0; i < src.length; i++) {
		const c = src[i] as string;
		if (c === "\n") {
			line++;
			continue;
		}
		if (c === "{") {
			braceDepth++;
			continue;
		}
		if (c === "}") {
			braceDepth = Math.max(0, braceDepth - 1);
			continue;
		}
		// An `@` inside a quantity is a *reference*, not a declaration:
		// `@sugar{50% @&flour}` mentions flour without introducing it, and
		// counting it as written would report a loss on a perfectly good recipe.
		if (c !== "@" || braceDepth > 0) continue;

		// `<@` (composite parent) and a bare `@` both introduce an ingredient.
		let p = i + 1;
		while (p < src.length && MODIFIERS.has(src[p] as string)) p++;

		// -- full: refName alias? "{"
		let end = p;
		while (end < src.length && isRefNameChar(src[end] as string)) end++;
		let afterAlias = end;
		if (src[afterAlias] === ":") {
			afterAlias++;
			while (
				afterAlias < src.length &&
				isRefNameChar(src[afterAlias] as string)
			)
				afterAlias++;
		}

		let name: string;
		let quantified = false;
		if (src[afterAlias] === "{" && end > p) {
			name = src.slice(p, end);
			const close = src.indexOf("}", afterAlias + 1);
			quantified =
				close > afterAlias &&
				src.slice(afterAlias + 1, close).trim().length > 0;
		} else {
			// -- bare: singleWordName
			let bareEnd = p;
			while (
				bareEnd < src.length &&
				isSingleWordNameChar(src[bareEnd] as string)
			)
				bareEnd++;
			if (bareEnd === p) continue; // a lone "@" is not an ingredient
			name = src.slice(p, bareEnd);
		}

		const trimmed = name.trim();
		if (!trimmed) continue;
		found.push({ name: trimmed, id: slugify(trimmed), line, quantified });
	}

	return found;
}

/**
 * Ingredients that carry no quantity anywhere in the recipe.
 *
 * "Anywhere" is the whole point. A second mention written `@&flour{}` is a
 * back-reference and correctly has no amount of its own; what matters is
 * whether the ingredient was ever given one. Only ingredients that were not
 * are listed, at the line they first appear on.
 *
 * This is deliberately NOT an error. `@salt{}` is idiomatic Gram for "to
 * taste", and the compiler rightly says nothing about it. But on an import —
 * a video especially, where amounts are shown rather than spoken and often
 * neither — the count is the single most useful quality signal there is: it
 * says how much of the recipe still has to be filled in by hand, and thus how
 * much the source was actually worth.
 */
export function findUnquantifiedIngredients(
	text: string,
): { name: string; line: number }[] {
	const written = findWrittenIngredients(text);
	const everQuantified = new Set(
		written.filter((w) => w.quantified).map((w) => w.id),
	);

	const seen = new Set<string>();
	const result: { name: string; line: number }[] = [];
	for (const w of written) {
		if (everQuantified.has(w.id) || seen.has(w.id)) continue;
		seen.add(w.id);
		result.push({ name: w.name, line: w.line });
	}
	return result;
}

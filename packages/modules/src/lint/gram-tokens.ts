import { type CompilationResult, slugify } from "@gram-lang/kitchen";
import { scanFrontmatter } from "./frontmatter-text";

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

/** `syntaxChar = "={" | "{" | "}" | "[" | "]" | "(" | ")" | "<" | "|" | ":"` */
const SYNTAX_CHARS = new Set(["{", "}", "[", "]", "(", ")", "<", "|", ":"]);

/** `refSigil = "@" | "#" | "~" | "^" | "&"` */
const REF_SIGILS = new Set(["@", "#", "~", "^", "&"]);

/** `sentencePunct = "," | ";" | "!" | "?" | "."` */
const SENTENCE_PUNCT = new Set([",", ";", "!", "?", "."]);

function isSyntaxCharAt(src: string, i: number): boolean {
	const c = src[i] as string;
	// A `=` ends a name only before `{`, where a target state starts (`@oil until ={translucent}`).
	return SYNTAX_CHARS.has(c) || (c === "=" && src[i + 1] === "{");
}

/** `refName = (~(syntaxChar | refSigil | nl) any)+` */
function isRefNameChar(src: string, i: number): boolean {
	const c = src[i] as string;
	return !isSyntaxCharAt(src, i) && !REF_SIGILS.has(c) && c !== "\n";
}

/** `singleWordName = (~(syntaxChar | space | nl | sentencePunct) any)+` */
function isSingleWordNameChar(src: string, i: number): boolean {
	const c = src[i] as string;
	return (
		!isSyntaxCharAt(src, i) &&
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
const blank = (m: string) => m.replace(/[^\n]/g, " ");

function maskDeliberateComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/^[ \t]*\/\/[^\n]*/gm, blank);
}

/**
 * Blank out the leading `---…---` block.
 *
 * The compiler reads frontmatter as YAML, never as recipe text, so an `@` in
 * there introduces nothing. Scanning it anyway turned an ordinary metadata
 * value into a phantom lost ingredient — and since a lost ingredient now
 * refuses the whole import, `author: 'contact@example.com'` or a channel
 * handle like `author: '@ChefJohn'` was enough to reject a perfectly good
 * recipe. Video imports write `author:` straight from YouTube, so this is not
 * hypothetical.
 *
 * Only the block at the very start counts; `---` further down is body text.
 */
function maskFrontmatter(text: string): string {
	// A closed block as the editor reads it (`scanFrontmatter`): line breaks
	// `\r\n` included, where the pattern below never matched and turned
	// `author: '@ChefJohn'` into a lost ingredient.
	const block = scanFrontmatter(text);
	if (block?.closed) {
		let end = 0;
		for (let line = 0; line <= block.endLine; line++) {
			const nl = text.indexOf("\n", end);
			end = nl === -1 ? text.length : nl + 1;
		}
		return blank(text.slice(0, end)) + text.slice(end);
	}
	const match = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
	if (!match) return text;
	return blank(match[0]) + text.slice(match[0].length);
}

/**
 * Blank out the `@use` directives: `@use "./base.gram" as &base` imports a
 * module, it does not introduce an ingredient called "use", and every file
 * that imports one reported it lost. Only the directive's own shape counts
 * (`@use "…" as`), at the start of a line, as the grammar reads it.
 */
function maskUseDirectives(text: string): string {
	return text.replace(/^[ \t]*@use[ \t]+"[^"\n]*"[ \t]+as\b[^\n]*/gm, blank);
}

/**
 * One `@ingredient` token found by `findWrittenIngredients`.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export interface WrittenIngredient {
	/** The name as written, before slugification. */
	name: string;
	/** `slugify(name)` — the id the compiler would register it under. */
	id: string;
	/** 1-based line the token starts on, for error messages. */
	line: number;
	/**
	 * UTF-16 offset of the token's `@` in the scanned text (same units as
	 * Ohm.js and LSP). A composite parent `<@` starts at its `@`, as in the AST.
	 */
	start: number;
	/**
	 * UTF-16 offset just past the token: after the closing `}` of its quantity,
	 * or after the name of a bare `@word`. Unlike an AST `loc`, a preparation
	 * `(…)` or a composite parent that follows is not included.
	 */
	end: number;
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
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export function findWrittenIngredients(text: string): WrittenIngredient[] {
	const src = maskDeliberateComments(maskUseDirectives(maskFrontmatter(text)));
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
		while (end < src.length && isRefNameChar(src, end)) end++;
		let afterAlias = end;
		if (src[afterAlias] === ":") {
			afterAlias++;
			while (afterAlias < src.length && isRefNameChar(src, afterAlias))
				afterAlias++;
		}

		let name: string;
		let quantified = false;
		let tokenEnd: number;
		if (src[afterAlias] === "{" && end > p) {
			name = src.slice(p, end);
			const close = src.indexOf("}", afterAlias + 1);
			quantified =
				close > afterAlias &&
				src.slice(afterAlias + 1, close).trim().length > 0;
			tokenEnd = close > afterAlias ? close + 1 : afterAlias + 1;
		} else {
			// -- bare: singleWordName
			let bareEnd = p;
			while (bareEnd < src.length && isSingleWordNameChar(src, bareEnd))
				bareEnd++;
			if (bareEnd === p) continue; // a lone "@" is not an ingredient
			name = src.slice(p, bareEnd);
			tokenEnd = bareEnd;
		}

		const trimmed = name.trim();
		if (!trimmed) continue;
		found.push({
			name: trimmed,
			id: slugify(trimmed),
			line,
			start: i,
			end: tokenEnd,
			quantified,
		});
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
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export function findUnquantifiedIngredients(
	text: string,
): { name: string; line: number }[] {
	return unquantifiedFrom(findWrittenIngredients(text));
}

/**
 * Same as findUnquantifiedIngredients, from an already-scanned list. Callers
 * that also need findWrittenIngredients for something else (e.g. cross-
 * checking against the compiled registry) should scan once and pass the
 * result here rather than have this re-scan the same text.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export function unquantifiedFrom(
	written: WrittenIngredient[],
): { name: string; line: number }[] {
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

/**
 * Ingredients that were written but did not survive compilation: every
 * scanned token whose id is missing from the compiled registry, at its first
 * mention (one entry per id, in source order).
 *
 * The motivating case is a `//` dropped mid-sentence, which comments out the
 * rest of the line and silently takes the ingredients after it. Only call it
 * on a recipe that compiled: on a parse failure there is no registry to
 * compare against, and guessing at lost content would only add noise.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export function lostFrom(
	compiled: Pick<CompilationResult, "registry">,
	written: WrittenIngredient[],
): WrittenIngredient[] {
	const registered = new Set(Object.keys(compiled.registry.ingredients));
	const seen = new Set<string>();
	const lost: WrittenIngredient[] = [];
	for (const w of written) {
		if (registered.has(w.id) || seen.has(w.id)) continue;
		seen.add(w.id);
		lost.push(w);
	}
	return lost;
}

import { getAST } from "@gram-lang/parser";

export interface FormatterChanges {
	lowercasedIds: number;
	spacesBeforeBrace: number;
	spacesInsideBraces: number;
	trailingZeros: number;
	quantityOperatorSpacing: number;
	temperatureSpacing: number;
	compositeSeparatorSpacing: number;
	arrowDeclarationSpacing: number;
	headerSpacing: number;
	tabsToSpaces: number;
	consecutiveBlankLines: number;
	trailingWhitespace: number;
	eofNewline: boolean;
}

export function hasChanges(changes: FormatterChanges): boolean {
	return (
		changes.lowercasedIds > 0 ||
		changes.spacesBeforeBrace > 0 ||
		changes.spacesInsideBraces > 0 ||
		changes.trailingZeros > 0 ||
		changes.quantityOperatorSpacing > 0 ||
		changes.temperatureSpacing > 0 ||
		changes.compositeSeparatorSpacing > 0 ||
		changes.arrowDeclarationSpacing > 0 ||
		changes.headerSpacing > 0 ||
		changes.tabsToSpaces > 0 ||
		changes.consecutiveBlankLines > 0 ||
		changes.trailingWhitespace > 0 ||
		changes.eofNewline
	);
}

export function summarizeChanges(changes: FormatterChanges): string {
	const parts: string[] = [];
	const p = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
	if (changes.lowercasedIds > 0)
		parts.push(`${p(changes.lowercasedIds, "ID")} lowercased`);
	if (changes.spacesBeforeBrace > 0)
		parts.push(`${p(changes.spacesBeforeBrace, "space")} before brace removed`);
	if (changes.spacesInsideBraces > 0)
		parts.push(`${p(changes.spacesInsideBraces, "brace")} interior trimmed`);
	if (changes.trailingZeros > 0)
		parts.push(`${p(changes.trailingZeros, "trailing zero")} removed`);
	if (changes.quantityOperatorSpacing > 0)
		parts.push(`${p(changes.quantityOperatorSpacing, "sum")} spacing fixed`);
	if (changes.temperatureSpacing > 0)
		parts.push(`${p(changes.temperatureSpacing, "temperature")} spacing fixed`);
	if (changes.compositeSeparatorSpacing > 0)
		parts.push(
			`${p(changes.compositeSeparatorSpacing, "composite separator")} normalized`,
		);
	if (changes.arrowDeclarationSpacing > 0)
		parts.push(
			`${p(changes.arrowDeclarationSpacing, "declaration")} spacing fixed`,
		);
	if (changes.headerSpacing > 0)
		parts.push(`${p(changes.headerSpacing, "header")} spacing normalized`);
	if (changes.tabsToSpaces > 0)
		parts.push(`${p(changes.tabsToSpaces, "tab")} converted to spaces`);
	if (changes.consecutiveBlankLines > 0)
		parts.push(
			`${p(changes.consecutiveBlankLines, "blank line group")} collapsed`,
		);
	if (changes.trailingWhitespace > 0)
		parts.push(
			`${p(changes.trailingWhitespace, "line")} trailing whitespace removed`,
		);
	if (changes.eofNewline) parts.push("EOF newline added");
	return parts.join(" · ");
}

/**
 * Gram's blanks, the only characters the formatter ever strips: a space or a
 * tab, as the grammar's `sp` rule says (`packages/parser/grammar.ohm`). Never
 * `trim()`/`trimEnd()`, which also strip a no-break space, U+3000 or U+FEFF:
 * the parser reads those as text, so a line holding only them is no blank
 * line, and stripping them split its step in two (#200).
 */
const TRAILING_BLANKS = /[ \t]+$/;
const LEADING_BLANKS = /^[ \t]+/;

function trimBlanks(text: string): string {
	return text.replace(LEADING_BLANKS, "").replace(TRAILING_BLANKS, "");
}

/** A line break, as the grammar's `nl` rule says: LF, CRLF or a lone CR. */
const LINE_BREAK = /\r\n|\r|\n/g;

// Splits `---\n...\n---\n` frontmatter from the recipe body. First line is
// exactly "---" (after a byte order mark the parser skips), closed by the
// next line that is exactly "---", trailing blanks aside. Character slicing
// (not a lines-array rebuild) guarantees `frontmatter + body === source`
// always, with no reconstruction edge cases.
function splitFrontmatter(source: string): {
	frontmatter: string;
	body: string;
} {
	const none = { frontmatter: "", body: source };
	const lineBreak = new RegExp(LINE_BREAK);
	let start = 0;
	let first = true;
	for (;;) {
		const match = lineBreak.exec(source);
		const end = match ? match.index : source.length;
		const next = match ? end + match[0].length : source.length;
		let line = source.slice(start, end).replace(TRAILING_BLANKS, "");
		if (first) line = line.replace(/^\uFEFF/, "");
		const isFence = line === "---";
		if (first) {
			if (!match || !isFence) return none;
			first = false;
		} else if (isFence) {
			return { frontmatter: source.slice(0, next), body: source.slice(next) };
		}
		// No closing "---" found: not well-formed frontmatter, so don't
		// swallow the rest of the file into an unterminated block.
		if (!match) return none;
		start = next;
	}
}

/** An operator between two terms of a sum, once spaced (` + `, ` - `). */
const SUM_OPERATOR = / [+-] /;

/** A target after the first character: `5% @&flour`, `1 / 100 g &dough`. */
const HAS_TARGET = /.(?:@&|&)/u;

/**
 * A decimal number whose decimals end in zeros (`1.50`, `2,0`), standing on
 * its own: not inside a longer number, nor part of a name (`v2.0`,
 * `chocolat-70.0`); a `-` before it is a range's or a sign's.
 */
const DECIMAL_WITH_ZEROS =
	/(?<![\p{L}\d.,_])(?<!\p{L}-)(\d+)([.,])(\d*?)(0+)(?![\d.,]\d)(?!\d)/gu;

/**
 * Removes the trailing decimal zeros of every number in a quantity's
 * braces, after a point or a comma (`1,50` → `1,5`, `2.0` → `2`). A comma
 * followed by exactly three digits (`1,000`) is left as written: it may be a
 * thousands separator, which the compiler flags (AMBIGUOUS_NUMBER), and
 * stripping it would hide the question. A target (`@&b`, `&dough`) is a
 * name and keeps its digits.
 */
function trimTrailingZeros(inner: string): {
	text: string;
	count: number;
} {
	const target = HAS_TARGET.exec(inner);
	const end = target ? target.index + 1 : inner.length;
	let count = 0;
	const amount = inner
		.slice(0, end)
		.replace(
			DECIMAL_WITH_ZEROS,
			(match, n: string, sep: string, digits: string, zeros: string) => {
				if (sep === "," && digits.length + zeros.length === 3) return match;
				count++;
				return digits ? `${n}${sep}${digits}` : n;
			},
		);
	return { text: amount + inner.slice(end), count };
}

/** What a brace belongs to, read from the AST (see `elementSpans`). */
type ElementKind =
	| "ingredient"
	| "timer"
	| "temperature"
	| "cookware"
	| "checkpoint"
	| "bindings";

/** An element of the recipe, where the parser found it in the source. */
interface ElementSpan {
	kind: ElementKind;
	start: number;
	end: number;
}

interface Located {
	type?: string;
	loc?: { start: number; end: number };
	[key: string]: unknown;
}

const KIND_OF: Record<string, ElementKind> = {
	Ingredient: "ingredient",
	Composite: "ingredient",
	Reference: "ingredient",
	Timer: "timer",
	Temperature: "temperature",
	Cookware: "cookware",
	Checkpoint: "checkpoint",
};

/**
 * Every element of the recipe, in source order: the spans rules 1-5 may
 * touch, and nothing else. A section title, a preparation, a comment or
 * plain text is no element, so a `@Word` or a `{ 1.0 }` in them stays as
 * written (#201). An ingredient's span stops where its composite parent
 * starts (`@a{1}<@b{2}`: two spans); the `~{…}` of a header or of an
 * `@use` is a timer's, and the `{ &a, &b }` of an `@use` is its bindings'.
 */
function elementSpans(
	node: unknown,
	source: string,
	spans: ElementSpan[] = [],
): ElementSpan[] {
	if (Array.isArray(node)) {
		for (const child of node) elementSpans(child, source, spans);
		return spans;
	}
	if (!node || typeof node !== "object") return spans;
	const n = node as Located;
	const kind = n.type ? KIND_OF[n.type] : undefined;
	if (kind && n.loc) {
		const composite = n.composite as Located | null | undefined;
		const end = composite?.loc ? composite.loc.start : n.loc.end;
		spans.push({ kind, start: n.loc.start, end });
		if (composite) elementSpans(composite, source, spans);
		return spans;
	}
	const retro = n.retroPlanning as Located | null | undefined;
	if (n.type === "ImportDecl" && n.loc) {
		// After the specifier's closing quote: the specifier may hold a `{`.
		const line = source.slice(n.loc.start, n.loc.end);
		const quote = line.indexOf('"', line.indexOf('"') + 1);
		spans.push({
			kind: "bindings",
			start: n.loc.start + quote + 1,
			end: retro?.loc ? retro.loc.start : n.loc.end,
		});
	}
	if (retro?.loc) {
		spans.push({ kind: "timer", start: retro.loc.start, end: retro.loc.end });
	}
	for (const [key, value] of Object.entries(n)) {
		if (key !== "retroPlanning" && key !== "loc") {
			elementSpans(value, source, spans);
		}
	}
	return spans;
}

/** The elements of `source`, or null when it does not parse. */
function parseElements(source: string): ElementSpan[] | null {
	try {
		return elementSpans(getAST(source), source).sort(
			(a, b) => a.start - b.start,
		);
	} catch {
		return null;
	}
}

/**
 * One space around each operator of a sum: a `+` between an amount and a
 * number, a `-` only after a unit (`1 cup-2 tbsp`), never between two
 * numbers, where it is a range (`1-2 cups`).
 */
function spaceSumOperators(inner: string): string {
	return inner
		.replace(/(?<=[\p{L}\d%.])[ \t]*\+[ \t]*(?=[\d\p{No}])/gu, " + ")
		.replace(/(?<=[\p{L}%])[ \t]*-[ \t]*(?=[\d\p{No}])/gu, " - ");
}

/**
 * Rules 1-5 on one element's span (`@Flour {500.0 g}(sifted)`, `~{1.50 h}`,
 * `={ ribbon stage }`). Its head runs up to its braces, or to its
 * preparation's `(` when it has no braces; only braces before any `(` are
 * the element's own, so a `{` in a preparation stays as written. No rule
 * crosses a line break (LF, CRLF or a lone CR, as for the parser): a brace
 * whose `}` is on another line is left alone.
 */
function formatElement(
	span: string,
	kind: ElementKind,
	changes: FormatterChanges,
): string {
	const open = span.search(/[{(]/);
	const hasBraces = open !== -1 && span[open] === "{";
	let head = open === -1 ? span : span.slice(0, open);
	const rest = open === -1 ? "" : span.slice(open);

	if (kind === "ingredient") {
		// Rule 1: Lowercase ingredient IDs (@Farine → @farine)
		head = head.replace(/(?<=@)([a-zA-Z][a-zA-Z0-9_-]*)/g, (match) => {
			const lower = match.toLowerCase();
			if (lower !== match) changes.lowercasedIds++;
			return lower;
		});
		// Rule 2: Remove space between @id and opening brace (@ing {10g} → @ing{10g})
		if (hasBraces) {
			head = head.replace(/(@[a-zA-Z][a-zA-Z0-9_-]*)[ \t]+$/, (_, id) => {
				changes.spacesBeforeBrace++;
				return id;
			});
		}
	}
	if (!hasBraces) return head + rest;

	const braces = /^\{([^{}\r\n]*)\}/.exec(rest);
	if (!braces) return head + rest;
	return `${head}{${formatBraces(braces[1] ?? "", kind, changes)}}${rest.slice(braces[0].length)}`;
}

/** Rules 3, 5, 4 and 4b, in that order, on an element's braces. */
function formatBraces(
	original: string,
	kind: ElementKind,
	changes: FormatterChanges,
): string {
	// Rule 3: Trim spaces inside braces ({ 10g } → {10g})
	let inner = trimBlanks(original);
	if (inner !== original) changes.spacesInsideBraces++;

	// A target state is words, and an `@use`'s bindings are names: only
	// rule 3 touches them.
	if (kind === "checkpoint" || kind === "bindings") return inner;

	// Rule 5: Remove space before ° in temperature quantities (handles
	// multiple temps per brace). Runs before rule 4, whose patterns allow no
	// space before the unit: in the other order `{160.0 °C}` only became
	// `{160.0°C}`, and a second run was needed to drop the zero.
	inner = inner.replace(/(\d+)[ \t]+°/g, (_m: string, n: string) => {
		changes.temperatureSpacing++;
		return `${n}°`;
	});

	// Rule 4: Remove trailing decimal zeros from every number in a quantity's
	// braces ({500.0g} → {500g}, {1.50 kg} → {1.5 kg}), whatever follows it:
	// a unit, a range's other bound ({1.50-2.50 cup}), a sum's next term, a
	// ratio's slash or a timer's unit (~{1.50 h}). See `trimTrailingZeros`.
	const zeros = trimTrailingZeros(inner);
	changes.trailingZeros += zeros.count;
	inner = zeros.text;

	// Rule 4b: A sum of quantities, in an ingredient's braces only (`@…{`,
	// `<@…{`, `&…{`; never a timer's `~{1h30-2h}` nor a temperature's):
	// one space around each operator (rule 4 has trimmed its terms). A
	// quantity relative to a target (`5% @&chocolat-70`) is never a sum:
	// spacing the `-` of its target's name would rename the target.
	if (kind === "ingredient" && !HAS_TARGET.test(inner)) {
		const spaced = spaceSumOperators(inner);
		if (SUM_OPERATOR.test(spaced) && spaced !== inner) {
			changes.quantityOperatorSpacing++;
			inner = spaced;
		}
	}
	return inner;
}

/**
 * The CLI (`gram format`, 9 rules, whole-body regexes) and the
 * language server (`format on save`, ~6 rules, line-by-line) used to be two
 * independent implementations with disjoint rule sets — a recipe formatted
 * by one and re-opened by the other could still show further changes,
 * defeating the point of a formatter (no fixed point between the two
 * surfaces). This is the single canonical implementation both now call:
 * every rule either tool had is here, exactly once.
 */
export function formatGram(source: string): {
	content: string;
	changes: FormatterChanges;
} {
	const changes: FormatterChanges = {
		lowercasedIds: 0,
		spacesBeforeBrace: 0,
		spacesInsideBraces: 0,
		trailingZeros: 0,
		quantityOperatorSpacing: 0,
		temperatureSpacing: 0,
		compositeSeparatorSpacing: 0,
		arrowDeclarationSpacing: 0,
		headerSpacing: 0,
		tabsToSpaces: 0,
		consecutiveBlankLines: 0,
		trailingWhitespace: 0,
		eofNewline: false,
	};

	// Rules 1-9 below operate on gram syntax (@ids, {quantities}, temperatures,
	// composites, declarations, headers) that only ever exists in the recipe
	// body — frontmatter is plain YAML. Running them over the whole source
	// used to silently rewrite frontmatter values,
	// e.g. lowercasing the domain of `author: Jean@Example.com`.
	// Order: the repairs (rules 6-8) first, then rules 1-5 on the elements
	// the parser finds in the repaired text, then rules 9-12.
	const { frontmatter, body: originalBody } = splitFrontmatter(source);
	let body = originalBody;

	// Rule 6 (from language-server): normalize composite separator spacing
	// (@ingA{} < @ingB{} → @ingA{}<@ingB{})
	body = body.replace(/ *< *@/g, (match) => {
		if (match !== "<@") changes.compositeSeparatorSpacing++;
		return "<@";
	});

	// Rule 7 (from language-server): normalize ->&name {} → ->&name{}
	// (handles single and multi-word names)
	body = body.replace(/->&([^{\r\n]+?)[ \t]+\{\}/g, (_, name) => {
		changes.arrowDeclarationSpacing++;
		return `->&${name}{}`;
	});

	// Rule 8 (from language-server): ensure exactly one space after a section
	// header's hashes (##Title, ##  Title → ## Title). Distinct from Rule 12
	// below (blank lines *before* a header) — this is the space *within* the
	// header line itself. Must match exactly "##" and not "###" (grammar.ohm's
	// `header = "##" sp+ title ...` — there is no single- or triple-hash
	// header form; Rule 12 below draws the same "##, not ###" line) — a
	// `{1,3}` quantifier here previously also matched a bare `#cookware`
	// reference at the start of a line (e.g. `#pan(20cm)`) and corrupted it
	// into `# pan(20cm)`, which the parser no longer recognizes as cookware
	// at all (found via the audit/ tool's calibration check against the
	// human-verified docs corpus, see cookware.md's `#pan`/`#ramekins` examples).
	body = body.replace(/^(##(?!#))[ \t]*(?=\S)/gm, (match, hashes: string) => {
		const normalized = `${hashes} `;
		if (match !== normalized) changes.headerSpacing++;
		return normalized;
	});

	// Rules 1-5 below touch the elements the parser finds, and only them:
	// they run after the repairs (rules 6-8) so that a `< @` the parser
	// rejects is already a composite. A file that still does not parse
	// keeps its text: the whitespace rules (9-12) are all it gets.
	const elements = parseElements(frontmatter + body);
	if (elements) {
		let formatted = "";
		let cursor = frontmatter.length;
		for (const { kind, start, end } of elements) {
			if (start < cursor) continue;
			formatted += (frontmatter + body).slice(cursor, start);
			formatted += formatElement(
				(frontmatter + body).slice(start, end),
				kind,
				changes,
			);
			cursor = end;
		}
		body = formatted + (frontmatter + body).slice(cursor);
	}

	// Rule 9 (from language-server): tabs → 4 spaces
	body = body.replace(/\t/g, () => {
		changes.tabsToSpaces++;
		return "    ";
	});

	// Rules 10-12 below are generic whitespace/newline hygiene, safe and
	// desired across the whole file — frontmatter included — so they run on
	// the recombined content rather than `body` alone.
	let content = frontmatter + body;

	// Rule 10: Trim trailing blanks line by line, and write every line break
	// as LF (a CRLF's or a lone CR's file comes out with LF only).
	content = content.replace(/[ \t]*(?:\r\n|\r|\n)|[ \t]+$/g, (match) => {
		if (match !== "\n") changes.trailingWhitespace++;
		return /[\r\n]$/.test(match) ? "\n" : "";
	});

	// Rule 11: Collapse 3+ consecutive newlines to 2 (exactly one blank line,
	// everywhere — steps, sections, headers alike). Gram's canonical style is
	// a single blank line between every step and/or section (see
	// CLAUDE.local.md's "Gram syntax gotcha" and packages/kitchen/tests/
	// fixtures/valid/*.gram) — never zero (that merges two lines into one
	// step, a semantic change the formatter must never make on its own) and
	// never two-or-more (purely cosmetic excess this rule removes). This used
	// to cap at 2 blank lines and then separately *promote* a single blank
	// line before a `##` header up to 2 (former Rule 12) — backwards from the
	// actual convention, caught by the audit/ tool's calibration check
	// flagging otherwise-correct, human-verified docs examples as
	// "non-canonical". Collapsing to 1 blank line uniformly here already
	// produces the right result before headers too, so the header-specific
	// promotion rule is gone; nothing needs promoting since 1 blank line is
	// now the target everywhere.
	content = content.replace(/\n{3,}/g, () => {
		changes.consecutiveBlankLines++;
		return "\n\n";
	});

	// Rule 12: Ensure single newline at EOF (rule 10 has left no blank at the
	// end of a line, nor any line break but LF)
	const trimmedEnd = content.replace(/\n+$/, "");
	const withEof = `${trimmedEnd}\n`;
	if (withEof !== content) changes.eofNewline = true;
	content = withEof;

	return { content, changes };
}

export interface FormatterChanges {
	lowercasedIds: number;
	spacesBeforeBrace: number;
	spacesInsideBraces: number;
	trailingZeros: number;
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

// Splits `---\n...\n---\n` frontmatter from the recipe body. First line is
// exactly "---", closed by the next line that is exactly "---". Character
// slicing (not a lines-array rebuild) guarantees `frontmatter + body ===
// source` always, with no reconstruction edge cases.
function splitFrontmatter(source: string): {
	frontmatter: string;
	body: string;
} {
	const firstLineEnd = source.indexOf("\n");
	const firstLine =
		firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
	if (firstLineEnd === -1 || firstLine.trimEnd() !== "---") {
		return { frontmatter: "", body: source };
	}

	let cursor = firstLineEnd + 1;
	while (cursor <= source.length) {
		const nextLineEnd = source.indexOf("\n", cursor);
		const line =
			nextLineEnd === -1
				? source.slice(cursor)
				: source.slice(cursor, nextLineEnd);
		if (line.trimEnd() === "---") {
			const boundary = nextLineEnd === -1 ? source.length : nextLineEnd + 1;
			return {
				frontmatter: source.slice(0, boundary),
				body: source.slice(boundary),
			};
		}
		if (nextLineEnd === -1) break;
		cursor = nextLineEnd + 1;
	}

	// No closing "---" found: not well-formed frontmatter, so don't swallow
	// the rest of the file into an unterminated block.
	return { frontmatter: "", body: source };
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
	const { frontmatter, body: originalBody } = splitFrontmatter(source);
	let body = originalBody;

	// Rule 1: Lowercase ingredient IDs (@Farine → @farine)
	body = body.replace(/(?<=@)([a-zA-Z][a-zA-Z0-9_-]*)/g, (match) => {
		const lower = match.toLowerCase();
		if (lower !== match) changes.lowercasedIds++;
		return lower;
	});

	// Rule 2: Remove space between @id and opening brace (@ing {10g} → @ing{10g})
	body = body.replace(/@([a-zA-Z][a-zA-Z0-9_-]*)\s+\{/g, (_, id) => {
		changes.spacesBeforeBrace++;
		return `@${id}{`;
	});

	// Rule 3: Trim spaces inside braces ({ 10g } → {10g})
	body = body.replace(/\{([^}]*)\}/g, (_, inner) => {
		const trimmed = inner.trim();
		if (trimmed !== inner) changes.spacesInsideBraces++;
		return `{${trimmed}}`;
	});

	// Rule 4: Remove trailing decimal zeros in quantities ({500.0g} → {500g}, {1.50g} → {1.5g})
	body = body.replace(/\{(\d+)\.0+([a-zA-Z°%]*)\}/g, (_, n, u) => {
		changes.trailingZeros++;
		return `{${n}${u}}`;
	});
	body = body.replace(/\{(\d+\.\d*[1-9])0+([a-zA-Z°%]*)\}/g, (_, n, u) => {
		changes.trailingZeros++;
		return `{${n}${u}}`;
	});

	// Rule 5: Remove space before ° in temperature quantities (handles multiple temps per brace)
	body = body.replace(/\{([^}]*)\}/g, (_, inner) => {
		const fixed = inner.replace(/(\d+)\s+°/g, (_m: string, n: string) => {
			changes.temperatureSpacing++;
			return `${n}°`;
		});
		return `{${fixed}}`;
	});

	// Rule 6 (from language-server): normalize composite separator spacing
	// (@ingA{} < @ingB{} → @ingA{}<@ingB{})
	body = body.replace(/ *< *@/g, (match) => {
		if (match !== "<@") changes.compositeSeparatorSpacing++;
		return "<@";
	});

	// Rule 7 (from language-server): normalize ->&name {} → ->&name{}
	// (handles single and multi-word names)
	body = body.replace(/->&([^{\n]+?)\s+\{\}/g, (_, name) => {
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

	// Rule 9 (from language-server): tabs → 4 spaces
	body = body.replace(/\t/g, () => {
		changes.tabsToSpaces++;
		return "    ";
	});

	// Rules 10-12 below are generic whitespace/newline hygiene, safe and
	// desired across the whole file — frontmatter included — so they run on
	// the recombined content rather than `body` alone.
	let content = frontmatter + body;

	// Rule 10: Trim trailing whitespace line by line
	content = content
		.split("\n")
		.map((line) => {
			const trimmed = line.trimEnd();
			if (trimmed !== line) changes.trailingWhitespace++;
			return trimmed;
		})
		.join("\n");

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

	// Rule 12: Ensure single newline at EOF
	const trimmedEnd = content.trimEnd();
	const withEof = `${trimmedEnd}\n`;
	if (withEof !== content) changes.eofNewline = true;
	content = withEof;

	return { content, changes };
}

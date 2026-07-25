import { describe, it, expect } from "bun:test";
import { formatGram, hasChanges, summarizeChanges } from "../src/index";

const emptyChanges = {
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

describe("formatGram", () => {
	it("lowercases ingredient IDs", () => {
		const { content, changes } = formatGram("Add @Farine{200g}.\n");
		expect(content).toBe("Add @farine{200g}.\n");
		expect(changes.lowercasedIds).toBe(1);
	});

	it("removes space between @id and opening brace", () => {
		const { content, changes } = formatGram("Add @flour {200g}.\n");
		expect(content).toBe("Add @flour{200g}.\n");
		expect(changes.spacesBeforeBrace).toBe(1);
	});

	it("trims spaces inside braces", () => {
		const { content, changes } = formatGram("Add @flour{ 200g }.\n");
		expect(content).toBe("Add @flour{200g}.\n");
		expect(changes.spacesInsideBraces).toBe(1);
	});

	it("removes trailing decimal zeros", () => {
		const { content, changes } = formatGram(
			"Add @flour{500.0g} and @egg{1.50}.\n",
		);
		expect(content).toBe("Add @flour{500g} and @egg{1.5}.\n");
		expect(changes.trailingZeros).toBe(2);
	});

	it("does not touch quantities without trailing zeros", () => {
		const { content, changes } = formatGram(
			"Add @flour{500g} and @egg{1.25}.\n",
		);
		expect(content).toBe("Add @flour{500g} and @egg{1.25}.\n");
		expect(changes.trailingZeros).toBe(0);
	});

	it("removes space before ° in temperature quantities", () => {
		const { content, changes } = formatGram("Bake at ~temp{180 °C}.\n");
		expect(content).toBe("Bake at ~temp{180°C}.\n");
		expect(changes.temperatureSpacing).toBe(1);
	});

	it("handles multiple temperatures in the same brace", () => {
		const { content, changes } = formatGram("Range ~temp{180 °C-200 °F}.\n");
		expect(content).toBe("Range ~temp{180°C-200°F}.\n");
		expect(changes.temperatureSpacing).toBe(2);
	});

	// Rules 6-9 below came from the language-server's formatter (Phase 3bis
	// unification) — previously applied only on format-on-save, never by
	// `gram format`.
	it("normalizes spacing around the composite separator (@a{} < @b{} → @a{}<@b{})", () => {
		const { content, changes } = formatGram(
			"Add @sugar yolks{3} < @eggs{3}.\n",
		);
		expect(content).toBe("Add @sugar yolks{3}<@eggs{3}.\n");
		expect(changes.compositeSeparatorSpacing).toBe(1);
	});

	it("does not touch an already-normalized composite separator", () => {
		const { content, changes } = formatGram("Add @sugar<@eggs{3}.\n");
		expect(content).toBe("Add @sugar<@eggs{3}.\n");
		expect(changes.compositeSeparatorSpacing).toBe(0);
	});

	it("normalizes ->&name {} → ->&name{}", () => {
		const { content, changes } = formatGram(
			"## Section ->&dough\n\nMix. ->&dough {}\n",
		);
		expect(content).toContain("->&dough{}");
		expect(changes.arrowDeclarationSpacing).toBe(1);
	});

	it("normalizes header spacing (##Title, ##  Title → ## Title)", () => {
		const { content, changes } = formatGram("##Prep\nStep.\n");
		expect(content).toBe("## Prep\nStep.\n");
		expect(changes.headerSpacing).toBe(1);

		const { content: content2, changes: changes2 } =
			formatGram("##   Prep\nStep.\n");
		expect(content2).toBe("## Prep\nStep.\n");
		expect(changes2.headerSpacing).toBe(1);
	});

	it("does not touch an already-normalized header", () => {
		const { content, changes } = formatGram("## Prep\nStep.\n");
		expect(content).toBe("## Prep\nStep.\n");
		expect(changes.headerSpacing).toBe(0);
	});

	it("does not mangle a bare #cookware reference at the start of a line", () => {
		const { content, changes } = formatGram(
			"## Prep\n\n#pan(20cm) heat up.\n",
		);
		expect(content).toBe("## Prep\n\n#pan(20cm) heat up.\n");
		expect(changes.headerSpacing).toBe(0);
	});

	it("converts tabs to 4 spaces in the body", () => {
		const { content, changes } = formatGram("Add\t@flour{200g}.\n");
		expect(content).toBe("Add    @flour{200g}.\n");
		expect(changes.tabsToSpaces).toBe(1);
	});

	it("trims trailing whitespace line by line", () => {
		const { content, changes } = formatGram("## Section   \nStep one.  \n");
		expect(content).toBe("## Section\nStep one.\n");
		expect(changes.trailingWhitespace).toBe(2);
	});

	it("collapses 3+ consecutive newlines to 2 (exactly one blank line)", () => {
		const { content, changes } = formatGram("Line one.\n\n\n\nLine two.\n");
		expect(content).toBe("Line one.\n\nLine two.\n");
		expect(changes.consecutiveBlankLines).toBe(1);
	});

	it("does not touch exactly 1 blank line (2 newlines)", () => {
		const { content, changes } = formatGram("Line one.\n\nLine two.\n");
		expect(content).toBe("Line one.\n\nLine two.\n");
		expect(changes.consecutiveBlankLines).toBe(0);
	});

	it("collapses 2 blank lines before a section header down to 1", () => {
		const { content, changes } = formatGram("Intro.\n\n\n## Section\nStep.\n");
		expect(content).toBe("Intro.\n\n## Section\nStep.\n");
		expect(changes.consecutiveBlankLines).toBe(1);
	});

	it("does not touch a section header that already has exactly 1 blank line", () => {
		const { content, changes } = formatGram("Intro.\n\n## Section\nStep.\n");
		expect(content).toBe("Intro.\n\n## Section\nStep.\n");
		expect(changes.consecutiveBlankLines).toBe(0);
	});

	it("collapses excess blank lines before a sub-section-looking (###) line too", () => {
		const { content, changes } = formatGram("Intro.\n\n\n### Sub\nStep.\n");
		expect(content).toBe("Intro.\n\n### Sub\nStep.\n");
		expect(changes.consecutiveBlankLines).toBe(1);
	});

	it("ensures a single newline at EOF when missing", () => {
		const { content, changes } = formatGram("Step one.");
		expect(content).toBe("Step one.\n");
		expect(changes.eofNewline).toBe(true);
	});

	it("collapses multiple trailing newlines at EOF to exactly one", () => {
		const { content, changes } = formatGram("Step one.\n\n\n");
		expect(content).toBe("Step one.\n");
		expect(changes.eofNewline).toBe(true);
	});

	it("reports no changes for already-clean content", () => {
		const clean = "## Section\n\nAdd @flour{200g}.\n";
		const { content, changes } = formatGram(clean);
		expect(content).toBe(clean);
		expect(hasChanges(changes)).toBe(false);
	});

	it("is idempotent: formatting already-formatted output produces no further changes", () => {
		const messy =
			"##Prep\nAdd @Flour {500.0g} and @Egg{ 1.50 }.  \n\n\n\n\n##Bake\nSet oven to ~temp{180 °C}. ->&dough {}\n";
		const first = formatGram(messy);
		const second = formatGram(first.content);
		expect(second.content).toBe(first.content);
		expect(hasChanges(second.changes)).toBe(false);
	});

	// Regression tests for the security/correctness audit (2026-07-22, finding
	// 0-b): rules meant for gram syntax (@ids, quantities, temperatures) used
	// to run over the whole file, silently rewriting frontmatter — e.g.
	// lowercasing the domain of an email address — with no fixed point between
	// the CLI's formatter and the language-server's (now unified, Phase 3bis).
	describe("frontmatter", () => {
		it("does not lowercase an email address in the frontmatter", () => {
			const input =
				"---\ntitle: Crepes\nauthor: Jean@Example.com\n---\n## Section\nAdd @Flour{200g}.\n";
			const { content } = formatGram(input);
			expect(content).toContain("author: Jean@Example.com");
			expect(content).toContain("@flour{200g}");
		});

		it("leaves frontmatter content byte-for-byte untouched by gram-syntax rules", () => {
			const input =
				"---\ntitle: Test\ntags: [A, B]\ndescription: 'Contains {braces} and @Words'\n---\n## S\nStep.\n";
			const { content } = formatGram(input);
			const frontmatterBlock = content.slice(0, content.indexOf("---\n## S"));
			expect(frontmatterBlock).toBe(
				"---\ntitle: Test\ntags: [A, B]\ndescription: 'Contains {braces} and @Words'\n",
			);
		});

		it("still trims trailing whitespace inside frontmatter", () => {
			const input = "---\ntitle: Test   \n---\n## S\nStep.\n";
			const { content } = formatGram(input);
			expect(content).toContain("title: Test\n");
		});

		it("is idempotent on a file with frontmatter", () => {
			const messy =
				"---\ntitle: Crepes\nauthor: Jean@Example.com\n---\n##   Prep  \nAdd @Flour {500.0g}.  \n";
			const first = formatGram(messy);
			const second = formatGram(first.content);
			expect(second.content).toBe(first.content);
			expect(hasChanges(second.changes)).toBe(false);
		});

		it("treats content as body (applies gram rules) when frontmatter has no closing delimiter", () => {
			const input = "---\ntitle: Test\n## S\nAdd @Flour{200g}.\n";
			const { content } = formatGram(input);
			expect(content).toContain("@flour{200g}");
		});
	});
});

describe("hasChanges", () => {
	it("is false when nothing changed", () => {
		expect(hasChanges(emptyChanges)).toBe(false);
	});

	it("is true when only the boolean eofNewline flag is set", () => {
		expect(hasChanges({ ...emptyChanges, eofNewline: true })).toBe(true);
	});

	it("is true when any numeric counter is non-zero", () => {
		expect(hasChanges({ ...emptyChanges, lowercasedIds: 1 })).toBe(true);
	});

	it("is true when only a new (Phase 3bis) counter is non-zero", () => {
		expect(hasChanges({ ...emptyChanges, headerSpacing: 1 })).toBe(true);
	});
});

describe("summarizeChanges", () => {
	it("returns an empty string when nothing changed", () => {
		expect(summarizeChanges(emptyChanges)).toBe("");
	});

	it("pluralizes counts correctly", () => {
		const changes = {
			...emptyChanges,
			lowercasedIds: 2,
			spacesBeforeBrace: 1,
		};
		const summary = summarizeChanges(changes);
		expect(summary).toContain("2 IDs lowercased");
		expect(summary).toContain("1 space before brace removed");
	});

	it("summarizes the Phase 3bis rules too", () => {
		const changes = {
			...emptyChanges,
			compositeSeparatorSpacing: 1,
			arrowDeclarationSpacing: 1,
			headerSpacing: 2,
			tabsToSpaces: 3,
		};
		const summary = summarizeChanges(changes);
		expect(summary).toContain("1 composite separator normalized");
		expect(summary).toContain("1 declaration spacing fixed");
		expect(summary).toContain("2 headers spacing normalized");
		expect(summary).toContain("3 tabs converted to spaces");
	});
});

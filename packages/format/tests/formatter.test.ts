import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { formatGram, hasChanges, summarizeChanges } from "../src/index";

const emptyChanges = {
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

	it("removes trailing decimal zeros after a decimal comma, keeping the comma", () => {
		const { content, changes } = formatGram(
			"Add @flour{500,0g} and @egg{1,50}.\n",
		);
		expect(content).toBe("Add @flour{500g} and @egg{1,5}.\n");
		expect(changes.trailingZeros).toBe(2);
	});

	it("leaves a comma followed by three digits as written ({1,000g} may mean a thousand)", () => {
		const src = "Add @flour{1,000g} and @salt{2,500g}.\n";
		const { content, changes } = formatGram(src);
		expect(content).toBe(src);
		expect(changes.trailingZeros).toBe(0);
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
		const { content, changes } = formatGram("## Prep\n\n#pan(20cm) heat up.\n");
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

describe("formatGram and sums of quantities", () => {
	const format = (step: string) => formatGram(`${step}\n`);

	it("puts one space around each operator of an ingredient's sum", () => {
		const { content, changes } = format(
			"Add @flour{1cup+1tbsp}, @sugar{1 cup-2 tbsp} and &dough{1 kg  +200 g}.",
		);
		expect(content).toBe(
			"Add @flour{1cup + 1tbsp}, @sugar{1 cup - 2 tbsp} and &dough{1 kg + 200 g}.\n",
		);
		expect(changes.quantityOperatorSpacing).toBe(3);
		expect(summarizeChanges(changes)).toContain("3 sums spacing fixed");
	});

	it("spaces a composite parent's sum too", () => {
		expect(format("Juice @juice{100 ml}<@oranges{1 lb+4 oz}.").content).toBe(
			"Juice @juice{100 ml}<@oranges{1 lb + 4 oz}.\n",
		);
	});

	it("never takes a range for a sum", () => {
		for (const step of [
			"Add @apples{1-2 cups}.",
			"Add @flour{1 cup + 1-2 tbsp}.",
			"Add @water{1.5-2l}.",
		]) {
			const { content, changes } = format(step);
			expect(content).toBe(`${step}\n`);
			expect(changes.quantityOperatorSpacing).toBe(0);
		}
	});

	it("leaves timers and temperatures alone", () => {
		for (const step of [
			"Bake ~{1h30-2h}.",
			"Rest ~dough{45min-1h}.",
			"Heat to ^{180°C+20°C}.",
		]) {
			expect(format(step).content).toBe(`${step}\n`);
		}
	});

	it("removes trailing zeros term by term, not a thousands comma", () => {
		const { content, changes } = format(
			"Add @flour{1.50 cup + 2.0 tbsp} and @sugar{1,000 g + 1 kg}.",
		);
		expect(content).toBe(
			"Add @flour{1.5 cup + 2 tbsp} and @sugar{1,000 g + 1 kg}.\n",
		);
		expect(changes.trailingZeros).toBe(2);
	});

	it("is idempotent", () => {
		const first = format(
			"Add @flour{1.50cup+2.0 tbsp} and @sugar{1 cup -2 tbsp}.",
		);
		const second = formatGram(first.content);
		expect(second.content).toBe(first.content);
		expect(hasChanges(second.changes)).toBe(false);
	});

	it("keeps the sum the parser reads, terms and signs", () => {
		const source =
			"## Section\n\nAdd @flour{1cup+1tbsp} and @sugar{1 cup-2 tbsp}.\n";
		const quantities = (text: string) => {
			const found: unknown[] = [];
			const walk = (node: unknown): void => {
				if (!node || typeof node !== "object") return;
				if (Array.isArray(node)) {
					node.forEach(walk);
					return;
				}
				const record = node as Record<string, unknown>;
				if (record.type === "CompoundQuantity") {
					const terms = record.terms as {
						minus?: boolean;
						value: { value: number } | null;
						unit: string | null;
					}[];
					found.push(
						terms.map((t) => ({
							minus: t.minus ?? false,
							value: t.value?.value,
							unit: t.unit,
						})),
					);
				}
				Object.values(record).forEach(walk);
			};
			walk(getAST(text));
			return found;
		};
		const before = quantities(source);
		expect(before).toHaveLength(2);
		expect(quantities(formatGram(source).content)).toEqual(before);
	});
});

describe("a temperature's note (1.5)", () => {
	it("keeps a glued note while fixing the braces", () => {
		expect(
			formatGram("## T\n\n^{160.0 °C}(chaleur tournante)\n").content,
		).toContain("^{160°C}(chaleur tournante)");
	});

	it("leaves the space before a parenthesis of prose", () => {
		expect(
			formatGram("## T\n\nCuire à ^{180°C} (four préchauffé).\n").content,
		).toContain("^{180°C} (four préchauffé).");
	});
});

describe("a temperature with a space and trailing zeros", () => {
	it("is fixed in a single run", () => {
		const { content, changes } = formatGram("## T\n\nBake at ^{160.0 °C}.\n");
		expect(content).toContain("^{160°C}");
		expect(changes.temperatureSpacing).toBe(1);
		expect(changes.trailingZeros).toBe(1);
		expect(formatGram(content).content).toBe(content);
	});

	it("keeps the zeros that matter", () => {
		expect(formatGram("## T\n\nHeat to ^{37.50 °C}.\n").content).toContain(
			"^{37.5°C}",
		);
	});
});

describe("a target state (1.5)", () => {
	const format = (line: string) => formatGram(`${line}\n`).content.trimEnd();

	it("only has the spaces inside its braces trimmed", () => {
		expect(format("Cuire jusqu'à ={ la nappe }.")).toBe(
			"Cuire jusqu'à ={la nappe}.",
		);
	});

	it("keeps its words as written: numbers, units, signs", () => {
		for (const line of [
			"Cuire jusqu'à ={180 °C à cœur}.",
			"Étaler jusqu'à ={1.0cm}.",
			"Abaisser jusqu'à ={2,50mm}.",
			"Battre @oeufs jusqu'à ={1 cup+1 tbsp}.",
			"Saler avec @sel jusqu'à ={goût}.",
		]) {
			expect(format(line)).toBe(line);
		}
	});

	it("keeps its note, glued or spaced, as written", () => {
		for (const line of [
			"Cuire jusqu'à ={la nappe}(la crème nappe la cuillère).",
			"Fouetter jusqu'au ={ruban} (environ 5 min).",
		]) {
			expect(format(line)).toBe(line);
		}
	});

	it("leaves the quantities around it formatted as before", () => {
		expect(
			format("Battre @sucre{80.0g} et @lait{1 cup+1 tbsp} jusqu'à ={ruban}."),
		).toBe("Battre @sucre{80g} et @lait{1 cup + 1 tbsp} jusqu'à ={ruban}.");
	});

	it("is a fixed point that still parses to the same target states", () => {
		const src = "## T\n\nCuire à ^{82.0 °C} jusqu'à ={ la nappe }(test).\n";
		const once = formatGram(src).content;
		expect(formatGram(once).content).toBe(once);
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		const step = (getAST(once).children[0] as any).children[0];
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		expect(
			step.children.find((c: any) => c.type === "Checkpoint"),
		).toMatchObject({ state: "la nappe", note: "test" });
	});
});

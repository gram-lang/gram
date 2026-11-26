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

	it("leaves braces the parser reads as text alone (#213)", () => {
		// A timer's text quantity: the compiler shows it as written.
		const result = formatGram("Range ~temp{180 °C-200 °F}.\n");
		expect(result.content).toBe("Range ~temp{180 °C-200 °F}.\n");
		expect(hasChanges(result.changes)).toBe(false);
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

	// Tabs are blanks to the parser (`invalidComposite`): the repair takes
	// them in one pass, before rule 9 turns them into spaces (#204).
	it("normalizes tabs around the composite separator in one pass", () => {
		for (const src of [
			"Add @yolks{3}\t<\t@eggs{3}.\n",
			"Add @yolks{3} \t< \t@eggs{3}.\n",
		]) {
			const { content, changes } = formatGram(src);
			expect(content).toBe("Add @yolks{3}<@eggs{3}.\n");
			expect(changes.compositeSeparatorSpacing).toBe(1);
			expect(changes.tabsToSpaces).toBe(0);
			expect(formatGram(content).content).toBe(content);
		}
	});

	// Kitchen flags `<` with any Unicode blank around it (SPACED_COMPOSITE
	// trims the text between the two ingredients): the repair glues those
	// too, a no-break space or an ideographic space as well as a space.
	it("normalizes Unicode horizontal blanks around the composite separator", () => {
		for (const src of [
			"Add @Yolks{3} < @Eggs{3}.\n",
			"Add @yolks{3} < @eggs{3}.\n",
			"Add @yolks{3}　<　@eggs{3}.\n",
		]) {
			const { content, changes } = formatGram(src);
			expect(content).toBe("Add @yolks{3}<@eggs{3}.\n");
			expect(changes.compositeSeparatorSpacing).toBe(1);
			expect(formatGram(content).content).toBe(content);
		}
	});

	// The repair runs before the parser finds the steps: a line break is
	// never a blank it takes, or it would merge two steps (or a comment).
	it("never glues a composite separator across a line break", () => {
		for (const [src, expected] of [
			["Add @yolks{3}\n< @eggs{3}.\n", "Add @yolks{3}\n<@eggs{3}.\n"],
			["Add @yolks{3} <\n@eggs{3}.\n", "Add @yolks{3} <\n@eggs{3}.\n"],
			[
				"Add @yolks{3}.\n\n<\u00a0@eggs{3}.\n",
				"Add @yolks{3}.\n\n<@eggs{3}.\n",
			],
		]) {
			expect(formatGram(src as string).content).toBe(expected as string);
		}
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

		// Found by the fuzz (#284): the parser reads a fenced block holding anything
		// but `key: value` lines as a step, so its comments and elements must
		// be kept as written, like in any other step.
		it("leaves a block comment inside a fenced block the parser reads as a step untouched", () => {
			const input =
				"---\n/* This \nis a block comment */\n---\n\n## Section\n\nStep.\n";
			const { content } = formatGram(input);
			expect(content).toContain("/* This \nis a block comment */");
			// The parser keeps the blank before the line break in the comment.
			expect(JSON.stringify(getAST(content))).toContain(
				'"value":"This \\nis a block comment"',
			);
		});

		it("formats the elements of a fenced block the parser reads as a step", () => {
			const input = "---\nAdd @Flour {500.0g}.\n---\n\nStep.\n";
			expect(formatGram(input).content).toContain("Add @flour{500g}.");
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

	it("never spaces the name of a relative quantity's target", () => {
		for (const step of [
			"Add @cacao{5% @&chocolat-70}.",
			"Add @salt{2% &dough-2}.",
			"Add @eggs{1 / 100 g @&crème-30%}.",
		]) {
			const first = format(step);
			expect(first.content).toBe(`${step}\n`);
			expect(first.changes.quantityOperatorSpacing).toBe(0);
			expect(formatGram(first.content).content).toBe(first.content);
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

describe("trailing zeros, the same rule for every quantity", () => {
	const format = (step: string) => formatGram(`## T\n\n${step}\n`).content;

	for (const [input, output] of [
		["@flour{1.50 cup + 1 tbsp}", "@flour{1.5 cup + 1 tbsp}"],
		["@flour{1.50 kg}", "@flour{1.5 kg}"],
		["@flour{1.50kg}", "@flour{1.5kg}"],
		["@flour{2.0 kg}", "@flour{2 kg}"],
		["@b{0.50 / 100 g @&a}", "@b{0.5 / 100 g @&a}"],
		["~{1.50 h}", "~{1.5 h}"],
		["@flour{1.50-2.50 cup+1 tbsp}", "@flour{1.5-2.5 cup + 1 tbsp}"],
		["@flour{1,50-2,0 kg}", "@flour{1,5-2 kg}"],
		["@flour{1 1/2-2.0 cups}", "@flour{1 1/2-2 cups}"],
	]) {
		it(`writes ${input} as ${output}, then leaves it`, () => {
			const once = format(input);
			expect(once).toContain(output);
			expect(format(output)).toBe(once);
			expect(hasChanges(formatGram(once).changes)).toBe(false);
		});
	}

	for (const kept of [
		"@flour{1,000 g}",
		"@flour{1,000-2,500 g}",
		"@flour{1.25 kg}",
		"@salt{2.0 g / 100 g @&chocolat-70.0}",
		"@x{v2.0 sachets}",
	]) {
		it(`keeps the zeros that may matter in ${kept}`, () => {
			expect(format(kept)).toContain(kept.replace("@salt{2.0 g", "@salt{2 g"));
		});
	}
});

describe("no rule crosses a line break (#197)", () => {
	for (const source of [
		// An ingredient with no amount, then text: not `@flour{200 g}`.
		"Add @flour\n{200 g}.\n",
		// A `{` left open on its line: `@r{` would no longer parse.
		"Mix @r\n{\n",
		// The header ends at its line; the step below stays a step.
		"## {\n}\n",
		// Two steps stay two steps.
		"~{5m}{\n\n~{2m}\n",
		"Shape ->&dough\n{}\n",
	]) {
		it(`leaves ${JSON.stringify(source)} as written`, () => {
			const result = formatGram(source);
			expect(result.content).toBe(source);
			expect(hasChanges(result.changes)).toBe(false);
		});
	}

	it("trims a space before the line break, not the line break", () => {
		expect(formatGram("Add @flour \n{200 g}.\n").content).toBe(
			"Add @flour\n{200 g}.\n",
		);
	});

	it("still formats the braces of each line", () => {
		expect(
			formatGram("Add @flour {200 g}\nand @salt{ 2.0 g }.\n").content,
		).toBe("Add @flour{200 g}\nand @salt{2 g}.\n");
	});
});

// #200: the formatter only strips what the parser reads as blank: spaces
// and tabs at the end of a line, and line breaks at the end of the file.
// Every line break comes out as LF.
describe("blanks and line breaks, as the parser reads them (#200)", () => {
	for (const char of ["\u00a0", "\u3000", "\ufeff"]) {
		it(`keeps a line of ${JSON.stringify(char)}, which is text`, () => {
			const source = `Mix.\n${char}\nBake.\n`;
			expect(formatGram(source).content).toBe(source);
			expect(formatGram(`Mix ${char}\n`).content).toBe(`Mix ${char}\n`);
		});
	}

	it("empties a line of spaces and tabs", () => {
		const { content, changes } = formatGram("Mix.\n \t \nBake.\n");
		expect(content).toBe("Mix.\n\nBake.\n");
		expect(changes.trailingWhitespace).toBe(1);
	});

	it("writes CRLF and lone CR line breaks as LF", () => {
		expect(formatGram("Mix. \r\n\r\nBake.\r\n").content).toBe(
			"Mix.\n\nBake.\n",
		);
		expect(formatGram("Mix\rwell.\r\rBake.\r").content).toBe(
			"Mix\nwell.\n\nBake.\n",
		);
	});

	it("keeps a byte order mark opening the file, and its frontmatter", () => {
		const { content } = formatGram(
			"\ufeff---\nauthor: Jean@Example.com\n---\nAdd @Flour.\n",
		);
		expect(content).toBe(
			"\ufeff---\nauthor: Jean@Example.com\n---\nAdd @flour.\n",
		);
	});

	it("finds a frontmatter written with lone CRs", () => {
		expect(
			formatGram("---\rauthor: Jean@Example.com\r---\rAdd @Flour.").content,
		).toBe("---\nauthor: Jean@Example.com\n---\nAdd @flour.\n");
	});

	it("keeps a closing --- followed by U+FEFF, which is no fence (#206)", () => {
		const source = "---\ntitle: Bread\n---\ufeff\nMix.\n";
		expect(formatGram(source).content).toBe(source);
	});

	it("leaves a no-break space inside braces", () => {
		expect(formatGram("Add @flour{\u00a0200 g}.\n").content).toBe(
			"Add @flour{\u00a0200 g}.\n",
		);
	});
});

// #201: rules 1-5 touch the elements the parser finds, never text: a
// section title, a preparation, a comment, plain text, a timer's name.
describe("rules 1-5 touch elements only (#201)", () => {
	for (const source of [
		"## Dough {1.0}\n\nMix.\n",
		"## @Dough\n\nMix.\n",
		"Add @egg{1}(beat {  } well).\n",
		"Heat the #pan(5@L).\n",
		"Wait { 1.0 } and see.\n",
		"Mix. // @Flour { 1.0 }\n",
		"~@F{}\n",
	]) {
		it(`leaves ${JSON.stringify(source)} as written`, () => {
			const result = formatGram(source);
			expect(result.content).toBe(source);
			expect(hasChanges(result.changes)).toBe(false);
		});
	}

	it("still formats every element on the same line", () => {
		expect(
			formatGram(
				"## Dough ~{ -1.0 d }\n\nAdd @Flour {500.0 g}(Sifted @L)<@Sugar{ 1.50 kg }, ~{ 1.50 h} at ^{ 180 °C}(fan) until @salt={ to taste }.\n",
			).content,
		).toBe(
			"## Dough ~{-1 d}\n\nAdd @flour{500 g}(Sifted @L)<@sugar{1.5 kg}, ~{1.5 h} at ^{180°C}(fan) until @salt={to taste}.\n",
		);
	});

	it("lowercases a reference's id, not the text braces after it", () => {
		expect(formatGram("Add &@Flour{ 5.0 % }.\n").content).toBe(
			"Add &@flour{ 5.0 % }.\n",
		);
	});

	it("formats an @use's bindings and offset, not its specifier", () => {
		expect(
			formatGram('@use "./b{ 1.0 }.gram" as {  &a , &b  } ~{ -1.0 d }\n')
				.content,
		).toBe('@use "./b{ 1.0 }.gram" as {&a , &b} ~{-1 d}\n');
	});

	it("repairs a file the parser rejects, then formats its elements", () => {
		expect(formatGram("Mix @Juice{ 1.0 } < @Lemon{ 2.0 }.\n").content).toBe(
			"Mix @juice{1}<@lemon{2}.\n",
		);
	});

	it("only repairs and cleans the blanks of a file that does not parse", () => {
		// Text after a header's `~{…}` is a parse error (`header_trailing`).
		expect(
			formatGram("##Dough ~{ -1.0 d } extra\n\nAdd @Flour{ 1.0 }.\t \n")
				.content,
		).toBe("## Dough ~{ -1.0 d } extra\n\nAdd @Flour{ 1.0 }.\n");
	});
});

// #213: rules 4 and 5 touch the numbers the parser reads, never a unit's
// text nor a quantity read as text, which the compiler keeps as written.
describe("rules 4 and 5 touch numbers only (#213)", () => {
	for (const source of [
		"Add @e{%1.0}.\n",
		"Add @egg{%1.50}.\n",
		"Heat ^{1.0\ufeff}.\n",
		"Heat ^{37.\ufeff50 °C}.\n",
		"Heat ^{160.0 °C/320.0 °F}.\n",
		"Wait ~{1.0\ufeff min}.\n",
	]) {
		it(`leaves ${JSON.stringify(source)} as written`, () => {
			const result = formatGram(source);
			expect(result.content).toBe(source);
			expect(hasChanges(result.changes)).toBe(false);
		});
	}

	// Found by the fuzz (#286): the compiler reads neither `1.0/5` nor `1/5.0`
	// as a duration, and `1/5` it does, so trimming changed a timer.
	for (const source of [
		"Bake for ~{1.0/5 min}.\n",
		"Bake for ~{1/5.0 min}.\n",
		"Add @x{1.50/2 g}.\n",
	]) {
		it(`leaves the fraction of ${JSON.stringify(source)} as written`, () => {
			const result = formatGram(source);
			expect(result.content).toBe(source);
			expect(hasChanges(result.changes)).toBe(false);
		});
	}

	it("leaves the fraction of a proportional timer, and trims its ratio", () => {
		expect(
			formatGram("Bake @b{100 g} for ~{1/5.0 min / 500.0 g @&b}.\n").content,
		).toBe("Bake @b{100 g} for ~{1/5.0 min / 500 g @&b}.\n");
		expect(
			formatGram("Bake @b{100 g} for ~{15.0 min / 500.0 g @&b}.\n").content,
		).toBe("Bake @b{100 g} for ~{15 min / 500 g @&b}.\n");
		expect(formatGram("Add @a{1.50 / 100.0 g @&b}.\n").content).toBe(
			"Add @a{1.5 / 100 g @&b}.\n",
		);
	});

	it("trims a number's zeros, not the unit text after it", () => {
		expect(formatGram("Add @e{1.50-2.0 %3.0}.\n").content).toBe(
			"Add @e{1.5-2 %3.0}.\n",
		);
	});

	it("still trims every number the parser reads", () => {
		expect(
			formatGram(
				"## T ~{-1.50 h}\n\nAdd @b{100 g}, @a{1.50 / 100.0 g @&b}, @c{5.0% @&b}, @d{1.0 g + 2.50 g} for ~{15.0 min / 500.0 g @&b} at ^{160.0-180.0 °C}.\n",
			).content,
		).toBe(
			"## T ~{-1.5 h}\n\nAdd @b{100 g}, @a{1.5 / 100 g @&b}, @c{5% @&b}, @d{1 g + 2.5 g} for ~{15 min / 500 g @&b} at ^{160-180°C}.\n",
		);
	});
});

// #218: rules 9-11 (tabs, trailing blanks, blank lines) leave alone the
// text the compiler keeps as written: an element, a step's action, a
// comment, a section title, a declaration.
describe("rules 9-11 leave an element's text alone (#218)", () => {
	for (const source of [
		"[a\tb] x\n",
		"Cook ={a\tb}.\n",
		"x /* a\tb */ y\n",
		"x // a\tb\n",
		"x /* a  \nb */ y\n",
		"x /* a\n\n\n\nb */ y\n",
		"Add @a\tb{1 g}.\n",
		"Add &a\tb{1 g}.\n",
		"Use #a\tb{}.\n",
		"Add @a(b\tc).\n",
		"## a\tb\n\nStep.\n",
		"## T ->&a\tb{}\n\nGo.\n",
	]) {
		it(`leaves ${JSON.stringify(source)} as written`, () => {
			const result = formatGram(source);
			expect(result.content).toBe(source);
			expect(hasChanges(result.changes)).toBe(false);
		});
	}

	it("still cleans the blanks around them", () => {
		expect(
			formatGram("\t[a\tb]\tAdd @a\tb{1 g} \t\n\n\n\nx /* a  \nb */ \t\n")
				.content,
		).toBe("    [a\tb]    Add @a\tb{1 g}\n\nx /* a  \nb */\n");
	});

	it("writes a comment's CRLF as LF", () => {
		expect(formatGram("x /* a\r\nb */ y\r\n").content).toBe("x /* a\nb */ y\n");
	});
});

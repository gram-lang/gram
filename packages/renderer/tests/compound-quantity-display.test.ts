import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toHTML, toMarkdown, toText } from "../src/index";
import { kitIngredients } from "../src/views/run-sheet/parts";

const SOURCE =
	"## Dough\n\nMix @flour{1 cup + 1 tbsp} with @sugar{1/2 cup - 2 tbsp}.\n\nAdd @milk{1 cup + 1-2 tbsp} and @butter{1 cup + 20 g}.\n\nAdd @flour{2 tbsp} and @oats{1.6 cup}.\n";

const build = (scaleFactor?: number) =>
	compile(getAST(SOURCE), scaleFactor ? { scaleFactor } : {});

const shoppingOf = (md: string) =>
	md.slice(md.indexOf("## Shopping List"), md.indexOf("## Instructions"));
const sectionOf = (md: string) =>
	md.slice(md.indexOf("**Ingredients**"), md.indexOf("1. "));

describe("sums of quantities, as written or worked out", () => {
	it("writes a step as the author wrote it when nothing is scaled", () => {
		const md = toMarkdown(build());
		expect(md).toContain("Mix **flour** (1 cup + 1 tbsp)");
		expect(md).toContain("**sugar** (1/2 cup − 2 tbsp)");
		expect(md).toContain("**milk** (1 cup + 1-2 tbsp)");
		expect(md).toContain("**butter** (1 cup + 20 g)");
		expect(md).not.toContain("17 tbsp");
	});

	it("works out a scaled step the way a cook measures it", () => {
		const md = toMarkdown(build(2));
		expect(md).toContain("Mix **flour** (2 cup + 2 tbsp)");
		expect(md).toContain("**sugar** (3/4 cup)");
		expect(md).toContain("**milk** (2 cup + 2-4 tbsp)");
		expect(md).toContain("**butter** (2 cup + 40 g)");
	});

	it("adds up the occurrences of a section", () => {
		const section = sectionOf(toMarkdown(build()));
		expect(section).toContain("- **flour** (1 cup + 3 tbsp)");
		// One occurrence keeps what was written.
		expect(section).toContain("- **sugar** (1/2 cup − 2 tbsp)");
		expect(section).toContain("- **oats** (1.6 cup)");
	});

	it("writes the shopping list in the units a cook buys, never as written spoons", () => {
		const list = shoppingOf(toMarkdown(build()));
		expect(list).toContain("**flour** (1 cup + 3 tbsp)");
		expect(list).toContain("**sugar** (6 tbsp)");
		expect(list).toContain("**milk** (1 cup + 1-2 tbsp)");
		// Not scaled: an amount that does not recompose exactly stays as is.
		expect(list).toContain("**oats** (1.6 cup)");
	});

	it("says the same thing in HTML and in text", () => {
		const html = toHTML(build(2));
		expect(html).toContain("(2 cup + 2 tbsp)");
		expect(toText(build(2))).toContain("2 cup + 2-4 tbsp");
	});

	it("shows the standardized mass of a sum once, next to its terms", () => {
		const analyzed = analyze(
			compile(getAST("## A\n\nMix @flour{1 lb + 200 g}.\n")),
			{
				flour: { name: "flour", physical: { density: 0.55 } },
			} as unknown as Record<string, IngredientData>,
		).result;
		const md = toMarkdown(analyzed);
		expect(md).toContain("Mix **flour** (1 lb + 200 g, 653.6 g)");
	});

	it("writes a sum Gram refused as it is, never worked out", () => {
		const md = toMarkdown(
			compile(getAST("## A\n\nMix @flour{1 cup + 10%}.\n"), {
				scaleFactor: 2,
			}),
		);
		expect(md).toContain("Mix **flour** (2 cup + 20%)");
	});

	it("brings in a spoon in the reader's spelling", () => {
		const md = toMarkdown(
			compile(getAST("## A\n\nMélanger @sel{1 càs}.\n"), { scaleFactor: 0.4 }),
			{ lang: "fr" },
		);
		expect(md).toContain("(1 1/4 càc)");
	});
});

describe("run sheet: what to take out", () => {
	it("adds up an ingredient asked twice into one line, with what it is made of", () => {
		const items = kitIngredients(build(), [0]);
		const flour = items.find((i) => i.name === "flour");
		expect(flour?.quantity).toBe("1 cup + 3 tbsp");
		expect(flour?.detail).toBe("1 cup + 1 tbsp + 2 tbsp");
		const butter = items.find((i) => i.name === "butter");
		expect(butter?.quantity).toBe("1 cup + 20 g");
	});

	it("keeps the plain sum of one unit, its unit said once", () => {
		const items = kitIngredients(
			compile(getAST("## A\n\nMix @flour{60 g}.\n\nAdd @flour{30 g}.\n")),
			[0],
		);
		expect(items[0]?.quantity).toBe("90 g");
		expect(items[0]?.detail).toBe("60 + 30");
	});
});

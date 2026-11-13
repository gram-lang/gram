import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML, toMarkdown, toText } from "../src/index";

const database = {
	milk: { name: "milk", physical: { density: 1.03 } },
} as unknown as Record<string, IngredientData>;

const source =
	"## Dough\n\nMix @flour{1.5kg}, @milk{1.25 cup}, @eggs{2.5-3} and @salt{1/2 tsp}.\n\nBake ~{1.5h} at ^{180.5°C}.\n";
const recipe = analyze(compile(getAST(source)), database).result;

describe("decimals in the reader's language", () => {
	it("writes a decimal comma in French, in every format", () => {
		for (const out of [
			toMarkdown(recipe, { lang: "fr" }),
			toText(recipe, { lang: "fr" }),
		]) {
			expect(out).toContain("1,5 kg");
			expect(out).toContain("1 1/4 cup");
			expect(out).toContain("2,5-3");
			expect(out).toContain("1,5 h");
			expect(out).toContain("180,5 °C");
			// A common fraction stays a fraction
			expect(out).toContain("1/2 tsp");
		}
		expect(toHTML(recipe, { lang: "fr" })).toContain("~304,6 g");
	});

	it("keeps the decimal point in English", () => {
		const md = toMarkdown(recipe, { lang: "en" });
		expect(md).toContain("1.5 kg");
		expect(md).toContain("2.5-3");
		expect(md).toContain("1.5 h");
	});

	it("keeps the point in what a script reads back (data attributes)", () => {
		const html = toHTML(recipe, { lang: "fr" });
		expect(html).toContain('data-value="1.5"');
		expect(html).toContain('data-value="180.5"');
		expect(html).toContain("1,5 h");
	});
});

describe("formatFraction", () => {
	it("writes the quantities of the recipe views in place of the default", () => {
		const formatFraction = (value: number) =>
			value === 0.5 ? "½" : value.toFixed(2);
		const md = toMarkdown(recipe, { formatFraction });
		expect(md).toContain("**salt** (½ tsp)");
		expect(md).toContain("**flour** (1.50 kg)");
		const html = toHTML(recipe, { formatFraction });
		expect(html).toContain("½ tsp");
	});
});

describe("fractions for spoons, cups and imperial measures", () => {
	const fractions = compile(
		getAST(
			"## A\n\nAdd @flour{1 3/4 cup}, @sugar{1.75 cup}, @salt{1 1/2 tsp} and @butter{2.5 tbsp}.\n\n## B\n\nAdd @flour{1 cup}, @salt{1.5 tsp}, @oats{1.6 cup} and @milk{1.5 l}.\n",
		),
	);

	it("writes 1 3/4 cup whether the recipe says 1 3/4 or 1.75", () => {
		const md = toMarkdown(fractions);
		expect(md).toContain("**sugar** (1 3/4 cup)");
		expect(md).toContain("**flour** (1 3/4 cup)");
		expect(md).toContain("**butter** (2 1/2 tbsp)");
		expect(md).not.toContain("1.8 cup");
	});

	it("writes a sum of the shopping list the same way (1 3/4 + 1 = 2 3/4)", () => {
		const md = toMarkdown(fractions);
		const list = md.slice(0, md.indexOf("## Instructions"));
		expect(list).toContain("**flour** (2 3/4 cup)");
		expect(list).toContain("**salt** (3 tsp)");
	});

	it("keeps decimals when no common fraction is near, and for metric units", () => {
		const md = toMarkdown(fractions, { lang: "fr" });
		expect(md).toContain("**oats** (1,6 cup)");
		expect(md).toContain("**milk** (1,5 l)");
		expect(md).not.toContain("1 1/2 l");
	});

	it("writes the same fractions in the run sheet and the plain text", () => {
		const text = toText(fractions);
		expect(text).toContain("1 3/4 cup");
		expect(text).toContain("2 1/2 tbsp");
	});
});

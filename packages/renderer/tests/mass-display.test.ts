import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML, toMarkdown, toText } from "../src/index";

const database = {
	sugar: { name: "sugar", physical: { density: 0.85 } },
	milk: { name: "milk", physical: { density: 1.03 } },
	flour: { name: "flour", physical: { density: 0.59 } },
} as unknown as Record<string, IngredientData>;

function analyzed(source: string) {
	return analyze(compile(getAST(source)), database).result;
}

describe("the standardized mass next to a written quantity", () => {
	it("is not repeated for a quantity already in kilograms or milligrams", () => {
		const md = toMarkdown(
			analyzed("## Syrup\n\nBoil @sugar{3kg} with @salt{500mg}.\n"),
		);
		expect(md).toContain("**sugar** (3 kg)");
		expect(md).not.toContain("3000 g");
		expect(md).toContain("**salt** (500 mg)");
	});

	it("is still shown for a volume, the weight it tells being new", () => {
		const text = toText(analyzed("## Custard\n\nWarm @milk{500ml}.\n"));
		expect(text).toContain("500 ml, ≈515 g");
	});
});

describe("kilograms and liters: what you buy, not what you weigh", () => {
	const source =
		"## Dough\n\nMix @flour{1500g}, @water{2250ml} and @sugar{3kg}.\n\n## Filling\n\nAdd @flour{2400g}.\n";
	const recipe = analyzed(source);

	it("writes the shopping list in kg and l from 1000 g or 1000 ml", () => {
		const md = toMarkdown(recipe);
		const list = md.slice(
			md.indexOf("## Shopping List"),
			md.indexOf("## Instructions"),
		);
		expect(list).toContain("**flour** (3.9 kg)");
		expect(list).toContain("**water** (2.25 l)");
		expect(list).toContain("**sugar** (3 kg)");
		const text = toText(recipe);
		expect(text).toMatch(/flour +3\.9 kg/);
	});

	it("keeps the steps and the ingredients of a section in grams", () => {
		const md = toMarkdown(recipe);
		const steps = md.slice(md.indexOf("## Instructions"));
		expect(steps).toContain("**flour** (1500 g)");
		expect(steps).toContain("**flour** (2400 g)");
		expect(steps).toContain("**water** (2250 ml)");
		expect(steps).not.toContain("3.9 kg");
		expect(steps).not.toContain("2.25 l");
	});

	it("writes the HTML shopping list in kg, the section lists in grams", () => {
		const html = toHTML(recipe);
		const list = html.slice(
			html.indexOf('class="prep-accordion shopping-list"'),
			html.indexOf(
				"</details>",
				html.indexOf('class="prep-accordion shopping-list"'),
			),
		);
		expect(list).toContain('<span class="kit-mass">3.9 kg</span>');
		expect(list).toContain('<span class="kit-mass">2.25 l</span>');
		const rest = html.slice(
			html.indexOf(
				"</details>",
				html.indexOf('class="prep-accordion shopping-list"'),
			),
		);
		expect(rest).toContain('<span class="kit-mass">1500 g</span>');
	});

	it("writes a total weight of 1000 g or more in kg, under it in g", () => {
		// The water has no density in this database: the total is a lower bound.
		const html = toHTML(recipe);
		expect(html).toContain('<span class="mass-value">&gt;6.9kg</span>');
		expect(html).toMatch(/section-meta-mass[^>]*>.*?<\/svg> 2\.4kg/s);
		expect(toHTML(analyzed("## Dough\n\nMix @flour{400g}.\n"))).toContain(
			'<span class="mass-value">400g</span>',
		);
	});
});

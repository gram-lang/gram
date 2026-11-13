import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML } from "../src/index";
import { tooltipCardAttrs } from "../src/shared/tooltip-card";

/** The plain-text tooltip of the step element named `name`. */
function tooltipOf(html: string, name: string): string | undefined {
	const steps = html.slice(html.indexOf('<ol class="steps"'));
	const re = new RegExp(`data-name="${name}"[^>]*?data-tooltip="([^"]*)"`);
	return steps.match(re)?.[1];
}

describe("the tooltip card of a step element", () => {
	const db = {
		sugar: { name: "sugar", physical: { density: 0.85 } },
	} as unknown as Record<string, IngredientData>;
	const source =
		"## Section\n\nMix @flour{250 g}, @sugar{2 tbsp}(sifted), @?vanilla{1 pod} and @yolks{6}<@eggs{6} in #molds{12}.\n";
	const { result } = analyze(compile(getAST(source)), db);

	it("explains an estimated mass, which the step text marks with ~", () => {
		expect(tooltipOf(toHTML(result), "sugar")).toBe(
			"Mass: ~25.1 g (average density)\nPreparation: sifted",
		);
	});

	it("does not repeat a quantity already in grams as its mass", () => {
		expect(tooltipOf(toHTML(result, { hideStepQty: true }), "flour")).toBe(
			"Quantity: 250 g",
		);
	});

	it("marks an optional ingredient with a badge and names the parent of a part", () => {
		const html = toHTML(result);
		expect(tooltipOf(html, "vanilla")).toBe("Optional");
		expect(tooltipOf(html, "yolks")).toBe("Taken from: 6 eggs");
	});

	it("counts cookware as in its list", () => {
		expect(tooltipOf(toHTML(result), "molds")).toBe("Quantity: ×12");
	});

	it("follows the colon of the reader's language", () => {
		expect(tooltipOf(toHTML(result, { lang: "fr" }), "sugar")).toContain(
			"Masse : ~25,1 g",
		);
	});

	it("carries an escaped HTML card next to the plain text", () => {
		const attrs = tooltipCardAttrs(
			{
				title: "<b>",
				rows: [{ label: "Quantity", value: "2" }],
				badges: ["Optional"],
			},
			": ",
		);
		expect(attrs).toContain('data-tooltip="Quantity: 2\nOptional"');
		expect(attrs).toContain("data-tooltip-html=");
		expect(attrs).not.toContain("<b>");
		expect(attrs).toContain("&amp;lt;b&amp;gt;");
	});

	it("has nothing to show without rows, badges or subtitle", () => {
		expect(tooltipCardAttrs({ title: "pan", rows: [] }, ": ")).toBe("");
	});
});

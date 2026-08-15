import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze, NUTRIENTS } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { getDictionary } from "@gram-lang/i18n";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";
import type { NutritionBasis } from "../src/types";

const database: Record<string, IngredientData> = {
	flour: {
		name: "Flour",
		nutrition: {
			calories: 364,
			protein: 10,
			carbs: 76,
			fat: 1,
			sat_fat: 0.2,
			sugar: 0.3,
			sodium: 2,
		},
	},
};

function analyzed(frontmatter: string) {
	const source = `---\ntitle: Cake\n${frontmatter}---\n\n## Section\n\nMix @flour{200g}.\n`;
	return analyze(compile(getAST(source)), database).result;
}

const portioned = analyzed("portions: 4\n");
const unportioned = analyzed("");

describe("nutritionBasis", () => {
	it("defaults to per portion when the recipe declares one", () => {
		// 728 kcal over 4 portions.
		expect(toMarkdown(portioned)).toContain("182");
		expect(toMarkdown(portioned)).toContain("Per portion");
	});

	it("defaults to the whole recipe otherwise, not to per-100 g", () => {
		// Per-100 g is available here, but switching unportioned recipes onto it
		// by default would silently change every existing output.
		const md = toMarkdown(unportioned);
		expect(md).toContain("Whole recipe");
		expect(md).toContain("728");
	});

	it("renders the basis the caller asks for, in every static backend", () => {
		for (const render of [toMarkdown, toPrintHTML]) {
			const out = render(portioned, { nutritionBasis: "per100g" });
			expect(out).toContain("Per 100 g");
			expect(out).toContain("364");
		}
	});

	it("falls back rather than rendering nothing for a basis the recipe lacks", () => {
		const md = toMarkdown(unportioned, { nutritionBasis: "perPortion" });
		expect(md).toContain("Whole recipe");
	});

	it("states the raw-mass caveat alongside a per-100 g figure", () => {
		const md = toMarkdown(portioned, { nutritionBasis: "per100g" });
		expect(md).toContain("200 g of raw ingredients");
	});

	it("marks an incomplete mass as a lower bound", () => {
		// `sugar` has no entry at all, so part of the mass can't be resolved and
		// the density derived from it is an over-estimate, not an under-estimate.
		const partial = analyze(
			compile(getAST("## S\n\nMix @flour{200g} and @sugar{2 cups}.\n")),
			database,
		).result;
		const md = toMarkdown(partial, { nutritionBasis: "per100g" });
		expect(md).toMatch(/[>~]\d+ g of raw ingredients/);
	});
});

describe("interactive HTML basis switch", () => {
	const html = toHTML(portioned, { interactiveNutrition: true });

	it("emits every basis with a radio control and no script", () => {
		for (const key of ["perPortion", "per100g", "total"]) {
			expect(html).toContain(`data-basis="${key}"`);
		}
		expect(html).toContain('type="radio"');
		expect(html).not.toContain("<script");
	});

	it("pre-selects the basis a static render would have shown", () => {
		const perPortionRadio = html.slice(
			html.indexOf('id="nut-basis-recipe-perPortion"'),
		);
		expect(perPortionRadio.slice(0, 200)).toContain("checked");
		expect(html).not.toContain('data-basis="per100g" checked');
	});

	it("scopes the radio group to renderId so two recipes can share a page", () => {
		const a = toHTML(portioned, { interactiveNutrition: true, renderId: "a" });
		expect(a).toContain('name="nut-basis-a"');
	});

	it("renders a single basis when the caller pins one", () => {
		const pinned = toHTML(portioned, {
			interactiveNutrition: true,
			nutritionBasis: "total",
		});
		expect(pinned).not.toContain('type="radio"');
		expect(pinned).toContain('data-basis="total"');
		expect(pinned).not.toContain('data-basis="per100g"');
	});
});

describe("nutrient rows", () => {
	it("keeps every NUTRIENTS key translatable in every locale", () => {
		// The six hand-written nutrient lists this table replaced had drifted
		// apart; nothing but this test ties the table to the locale files.
		for (const lang of ["en", "fr"]) {
			const t = getDictionary(lang);
			for (const nutrient of NUTRIENTS) {
				expect(t.renderer.nutrients[nutrient.key]).toBeTruthy();
			}
		}
	});

	it("shows fat subtypes, which used to be dropped before reaching a renderer", () => {
		expect(toMarkdown(unportioned)).toContain("of which saturates");
	});

	it("agrees on the nutrient set across all three backends", () => {
		const outputs = [
			toMarkdown(portioned),
			toHTML(portioned),
			toPrintHTML(portioned),
		];
		const t = getDictionary("en");
		for (const nutrient of NUTRIENTS) {
			const label = t.renderer.nutrients[nutrient.key];
			const present = outputs.map((out) => out.includes(label));
			// Either every backend shows it or none does — print used to silently
			// omit sugars while the other two showed it.
			expect(new Set(present).size).toBe(1);
		}
	});

	it("localizes labels instead of leaving them English", () => {
		const fr = toMarkdown(portioned, { lang: "fr" });
		expect(fr).toContain("Glucides");
		expect(fr).toContain("Par portion");
		expect(fr).not.toContain("Carbohydrates");
	});
});

describe("display condition parity", () => {
	it("shows the warnings panel in print too, not just html/markdown", () => {
		// Print used to require calories > 0, so a recipe whose ingredients are
		// all unknown printed nothing at all — not even the reason.
		const unknown = analyze(
			compile(getAST("## S\n\nAdd @salt{5g}.\n")),
			{},
		).result;
		expect(toPrintHTML(unknown)).toContain("Incomplete data");
	});
});

// Type-level: every basis the option accepts is one availableBases can return.
const _allBases: NutritionBasis[] = ["auto", "total", "perPortion", "per100g"];
void _allBases;

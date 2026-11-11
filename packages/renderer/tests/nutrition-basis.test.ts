import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze, NUTRIENTS } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { getDictionary } from "@gram-lang/i18n";
import { toHTML, toMarkdown, toPrintHTML, toText } from "../src/index";
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
	it("shows per 100 g then per portion by default, in every format, as the HTML table does", () => {
		// 364 kcal per 100 g; 728 kcal over 4 portions.
		for (const out of [toMarkdown(portioned), toText(portioned)]) {
			expect(out).toContain("Per 100 g");
			expect(out.indexOf("Per 100 g")).toBeLessThan(out.indexOf("Per portion"));
			expect(out).toContain("364 kcal");
			expect(out).toContain("182 kcal");
			expect(out).toContain("%RI*");
			expect(out).toContain("Whole recipe: 3046 kJ / 728 kcal");
		}
		expect(toMarkdown(portioned)).toContain(
			"| **Energy** | 1523 kJ / 364 kcal | 761 kJ / 182 kcal | 9% |",
		);
	});

	it("shows per 100 g and the whole recipe under it when there are no portions", () => {
		for (const out of [toMarkdown(unportioned), toText(unportioned)]) {
			expect(out).toContain("Per 100 g");
			expect(out).not.toContain("Per portion");
			expect(out).not.toContain("%RI");
			expect(out).toContain("Whole recipe: 3046 kJ / 728 kcal");
		}
	});

	it("renders the pinned basis alone, in every format", () => {
		for (const out of [
			toMarkdown(portioned, { nutritionBasis: "perPortion" }),
			toText(portioned, { nutritionBasis: "perPortion" }),
		]) {
			expect(out).toContain("Per portion");
			expect(out).not.toContain("Per 100 g");
			expect(out).toContain("Whole recipe: 3046 kJ / 728 kcal");
		}
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

	it("states the before-cooking caveat alongside a per-100 g figure", () => {
		const md = toMarkdown(portioned, { nutritionBasis: "per100g" });
		expect(md).toContain("Based on 200 g of ingredients, before cooking");
	});

	it("says the mass is only the part with data when coverage is partial", () => {
		// `basis.mass` counts only what contributed macros. Saying "based on
		// 200 g of ingredients" here would suggest the recipe weighs 200 g when
		// the salt in it is unaccounted for.
		const partial = analyze(
			compile(getAST("## S\n\nMix @flour{200g} and @salt{5g}.\n")),
			database,
		).result;
		expect(partial.metrics.nutrition?.coverage).toBeLessThan(1);
		const md = toMarkdown(partial, { nutritionBasis: "per100g" });
		expect(md).toContain("with nutrition data, before cooking");
		expect(md).not.toContain("Based on 200 g of ingredients,");
	});

	it("marks an unresolvable mass as a lower bound", () => {
		// `sugar` has no entry at all, so part of the mass can't be resolved and
		// the density derived from it is an over-estimate, not an under-estimate.
		const partial = analyze(
			compile(getAST("## S\n\nMix @flour{200g} and @sugar{2 cups}.\n")),
			database,
		).result;
		const md = toMarkdown(partial, { nutritionBasis: "per100g" });
		expect(md).toMatch(/[>~]\d+ g/);
	});
});

describe("HTML nutrition table", () => {
	const html = toHTML(portioned);
	const head = (out: string) =>
		out.slice(out.indexOf("<thead>"), out.indexOf("</thead>"));
	const pillOf = (out: string) => {
		const from = out.slice(out.indexOf('class="hero-item hero-nutrition"'));
		return from.slice(0, from.indexOf("</a>"));
	};

	it("shows per 100 g then per portion, side by side, without a switch or a script", () => {
		const h = head(html);
		expect(h.indexOf("Per 100 g")).toBeGreaterThan(-1);
		expect(h.indexOf("Per 100 g")).toBeLessThan(h.indexOf("Per portion"));
		expect(html).not.toContain('type="radio"');
		expect(html).not.toContain("<script");
	});

	it("starts with the energy in kcal and kJ, and puts the whole recipe under the table", () => {
		// Flour is 364 kcal per 100 g; 728 kcal over 4 portions.
		expect(html).toContain(
			'<tr class="nut-energy"><th scope="row">Energy</th><td><span class="nut-kcal">364 kcal</span><span class="nut-kj">1523 kJ</span></td><td><span class="nut-kcal">182 kcal</span><span class="nut-kj">761 kJ</span></td><td class="nut-ri">9%</td></tr>',
		);
		expect(head(html)).not.toContain("Whole recipe");
		expect(html).toContain("Whole recipe: 3046 kJ / 728 kcal");
	});

	it("adds the share of the reference intake of a portion", () => {
		// 50 g of flour per portion: 0.5 g of fat, 0.7% of 70 g → 1%.
		expect(head(html)).toContain("%RI");
		expect(html).toMatch(
			/<th scope="row">Fat<\/th><td>1 g<\/td><td>0\.5 g<\/td><td class="nut-ri">1%<\/td>/,
		);
		expect(head(toHTML(unportioned))).not.toContain("%RI");
	});

	it("shows salt, not sodium", () => {
		expect(html).toContain('<th scope="row">Salt</th>');
		expect(html).not.toContain(">Sodium<");
	});

	it("renders the pinned basis alone", () => {
		const pinned = toHTML(portioned, { nutritionBasis: "total" });
		expect(head(pinned)).toContain("Whole recipe");
		expect(head(pinned)).not.toContain("Per portion");
		expect(head(pinned)).not.toContain("%RI");
		expect(pillOf(pinned)).toContain("728 kcal");
	});

	it("links the hero bar's pill to the table", () => {
		const a = toHTML(portioned, { renderId: "a" });
		expect(a).toContain('id="a-nutrition"');
		expect(a).toContain('href="#a-nutrition"');
		expect(pillOf(a)).toContain("182 kcal");
		expect(pillOf(a)).toContain("per portion");
		expect(pillOf(a)).not.toContain("data-tooltip-html");
	});

	it("shows the pill per 100 g, not for the whole recipe, when there are no portions", () => {
		expect(pillOf(toHTML(unportioned))).toContain("364 kcal");
		expect(pillOf(toHTML(unportioned))).toContain("per 100 g");
	});

	it("shows no pill when there is nothing to total", () => {
		const unknown = analyze(
			compile(getAST("## S\n\nAdd @salt{5g}.\n")),
			{},
		).result;
		expect(toHTML(unknown)).not.toContain("hero-nutrition");
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

	it("nests sub-macros under their parent in the HTML table", () => {
		expect(toHTML(portioned)).toContain(
			'<tr class="is-nested"><th scope="row">of which saturates</th>',
		);
	});

	it("promotes a sub-macro whose parent is absent rather than dropping it", () => {
		const orphan: any = {
			title: "T",
			sections: [],
			shopping_list: [],
			meta: {},
			metrics: {
				nutrition: {
					total: { calories: 10, sat_fat: 2 },
					coverage: 1,
					isEstimate: false,
				},
			},
		};
		expect(toHTML(orphan)).toContain("of which saturates");
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

describe("robustness against partial payloads", () => {
	it("renders a nutrition block that carries warnings but no totals", () => {
		// The renderer's input is the analyzer's JSON as it arrives, and this
		// shape used to render as zeroes. Reaching into `total` unguarded made
		// it throw instead.
		const partial: any = {
			title: "T",
			sections: [],
			shopping_list: [],
			meta: {},
			metrics: {
				nutrition: {
					coverage: 0,
					isEstimate: false,
					warnings: [{ code: "MISSING_INGREDIENT", message: "salt" }],
				},
			},
		};
		expect(() => toMarkdown(partial)).not.toThrow();
		expect(() => toHTML(partial)).not.toThrow();
		expect(() => toPrintHTML(partial)).not.toThrow();
		expect(toHTML(partial)).toContain("nutrition-panel");
		expect(toPrintHTML(partial)).toContain("Incomplete data");
	});
});

// Type-level: every basis the option accepts is one availableBases can return.
const _allBases: NutritionBasis[] = ["auto", "total", "perPortion", "per100g"];
void _allBases;

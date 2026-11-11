import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML } from "../src/index";

const database = {
	flour: { name: "flour", physical: { density: 0.59 } },
	eggs: { name: "eggs", physical: { unit_weight: 50 } },
} as unknown as Record<string, IngredientData>;

function render(source: string, lang?: string) {
	const { result } = analyze(compile(getAST(source)), database);
	return toHTML(result, { lang });
}

/** The rich tooltip of the hero bar's mass. */
function heroMass(html: string): string {
	const start = html.indexOf('class="hero-item hero-mass');
	expect(start).toBeGreaterThan(-1);
	return html.slice(start, html.indexOf("</div>\n  </div>", start));
}

describe("the tooltip of a mass, in the HTML recipe", () => {
	it("explains an estimated and incomplete total: how each mass was found, and which are missing", () => {
		const html = render(
			"## Dough\n\nMix @flour{250ml}, @sugar{100g}, @eggs{2} and @pepper{}.\n",
		);
		const hero = heroMass(html);

		// The figure only: the status is the prefix, the words are in the tooltip
		expect(hero).toContain('<span class="mass-value">&gt;');
		expect(hero).not.toContain("(Incomplete)");
		expect(hero).toContain("Ingredient mass, before cooking");

		// Both reasons, even though the status keeps only "incomplete"
		expect(hero).toContain("<strong>Estimated</strong>");
		expect(hero).toMatch(
			/flour <span class="timing-detail-type">\(average density\)<\/span>/,
		);
		expect(hero).toMatch(
			/eggs <span class="timing-detail-type">\(average unit weight\)<\/span>/,
		);
		expect(hero).toContain("~147.5 g");
		expect(hero).toContain("~100 g");
		expect(hero).not.toMatch(/sugar <span/);

		expect(hero).toContain("<strong>Incomplete</strong>");
		expect(hero).toMatch(/pepper<\/span><span class="timing-val">\?<\/span>/);
		expect(hero).toContain("Give these a weight in grams");
	});

	it("shows the title only when every mass is known", () => {
		const hero = heroMass(
			render("## Dough\n\nMix @sugar{100g} and @butter{50g}.\n"),
		);
		expect(hero).toContain('<span class="mass-value">150g</span>');
		expect(hero).toContain("Ingredient mass, before cooking");
		expect(hero).not.toContain("timing-divider");
	});

	it("gives a section's badge the same tooltip, from its own ingredients", () => {
		const html = render(
			"## Dough\n\nMix @flour{250ml} and @sugar{100g}.\n\n## Filling\n\nAdd @pepper{} to @butter{50g}.\n",
		);
		const badges =
			html.match(
				/<small class="section-meta-badge section-meta-mass[\s\S]*?<\/small>/g,
			) ?? [];
		expect(badges).toHaveLength(2);
		expect(badges[0]).toContain("has-rich-tooltip");
		expect(badges[0]).not.toContain("data-tooltip");
		expect(badges[0]).toContain("Mass of this section&#039;s ingredients");
		expect(badges[0]).toContain("flour");
		expect(badges[0]).not.toContain("pepper");
		expect(badges[1]).toContain("&gt;50g");
		expect(badges[1]).toContain("pepper");
		expect(badges[1]).not.toContain("flour");
	});

	it("speaks the reader's language", () => {
		const hero = heroMass(
			render("## Pâte\n\nMélanger @flour{250ml} et @pepper{}.\n", "fr"),
		);
		expect(hero).toContain("Masse des ingrédients, avant cuisson");
		expect(hero).toContain("densité moyenne");
		expect(hero).toContain("<strong>Incomplète</strong>");
	});
});

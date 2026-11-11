import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toPrintHTML } from "../src/index";

// The hero bar's portions: the number, its word, and, once the recipe is
// scaled, the factor and (interactive) a way back. The scale factor is
// stamped by hand, as the scaler would leave it on the compiled recipe.
function recipe(portions: number, scaleFactor?: number) {
	const result = compile(
		getAST(
			`---\nportions: ${portions}\n---\n\n## Pâte\n\nMix @flour{200%g}.\n`,
		),
	);
	if (scaleFactor !== undefined) Object.assign(result, { scaleFactor });
	return result;
}

function hero(html: string): string {
	const match = html.match(
		/<div class="hero-item hero-portions">[\s\S]*?\n {2}<\/div>/,
	);
	return match?.[0] ?? "";
}

describe("hero portions", () => {
	it("shows the number, its word and an icon, with nothing of the scale", () => {
		const html = hero(toHTML(recipe(4)));
		expect(html).toContain("gicon-users");
		expect(html).toContain("<strong>4</strong> portions");
		expect(html).not.toContain("scale-factor-badge");
	});

	it("offers a pencil to change the portions, in the language, never on paper", () => {
		const html = hero(toHTML(recipe(4), { lang: "fr" }));
		expect(html).toContain('data-gram-action="edit-portions"');
		expect(html).toContain('aria-label="Modifier les portions"');
		expect(html).toContain("gicon-pencil-simple");
		const paper = toPrintHTML(recipe(4));
		expect(paper).not.toContain("edit-portions");
	});

	it("puts the word in the plural form of the language", () => {
		expect(hero(toHTML(recipe(1), { lang: "en" }))).toContain(
			"<strong>1</strong> portion<",
		);
		expect(hero(toHTML(recipe(6), { lang: "fr" }))).toContain(
			"<strong>6</strong> portions",
		);
		expect(hero(toHTML(recipe(1.5), { lang: "fr" }))).toContain(
			"<strong>1.5</strong> portion<",
		);
	});

	it("shows the factor of a scaled recipe, in the language's numbers", () => {
		const html = hero(toHTML(recipe(6, 1.5), { lang: "fr" }));
		expect(html).toContain('class="scale-factor-badge"');
		expect(html).toContain("×1,5");
	});

	it("offers no reset on an interactive recipe that is not scaled", () => {
		const html = hero(toHTML(recipe(4), { interactiveScaling: true }));
		expect(html).toContain('class="portions-unit">portions<');
		expect(html).not.toContain('data-scale-action="set-factor"');
		expect(html).not.toContain("scale-factor-badge");
	});

	it("offers a reset naming the original portions once scaled", () => {
		const html = hero(toHTML(recipe(6, 1.5), { interactiveScaling: true }));
		expect(html).toContain('data-base-portions="4"');
		expect(html).toContain('data-scale-action="set-factor" data-value="1"');
		expect(html).toContain('aria-label="Original recipe (4 portions)"');
		expect(html).toContain("×1.5");
	});

	it("labels the stepper's controls and keeps them from submitting a form", () => {
		const html = hero(toHTML(recipe(4), { interactiveScaling: true }));
		expect(html).toContain('type="button" class="scale-btn minus"');
		expect(html).toContain('aria-label="Decrease portions"');
		expect(html).toContain('aria-label="Increase portions"');
		expect(html).toContain('aria-label="Edit portions directly"');
		expect(html).toContain('inputmode="decimal"');
	});

	it("disables − at one portion", () => {
		const one = hero(toHTML(recipe(1), { interactiveScaling: true }));
		expect(one).toMatch(/class="scale-btn minus"[^>]*disabled/);
		const four = hero(toHTML(recipe(4), { interactiveScaling: true }));
		expect(four).not.toMatch(/class="scale-btn minus"[^>]*disabled/);
	});

	it("groups what the recipe makes apart from the portions", () => {
		const result = compile(
			getAST(
				"---\nportions: 4\nmakes: 1 tart\n---\n\n## Dough\n\nMix @flour{200g}.\n",
			),
		);
		const html = toHTML(result);
		expect(html).toMatch(
			/hero-portions[\s\S]*<div class="hero-facts">\s*<div class="hero-item hero-yield">/,
		);
	});
});

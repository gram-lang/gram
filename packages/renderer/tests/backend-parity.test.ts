import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";
import type { RendererOptions } from "../src/types";

// Phase 11 closure criterion (audit 2026-07-22, renderer I-4/P-1): html.ts,
// markdown.ts and print.ts now share a single `renderRecipe` traversal
// (../src/traversal.ts) instead of each hand-rolling document assembly, so a
// new section can no longer be silently wired into one backend and forgotten
// in the others the way Phase 9's `hideStepQty` was. This test replaces
// hide-step-qty-parity.test.ts with broader structural coverage: it still
// pins the hideStepQty behavior, but also exercises the option matrix more
// widely and pins today's documented content-completeness gaps (deferred to
// Phase 12, see plan doc) so an accidental change shows up as a failing test
// instead of a silent diff.

describe("renderer backend structural parity (Phase 11)", () => {
	const source = `---
title: Test Recipe
portions: 4
---

## Prep

Mix @flour{200g} with @water{100ml}. // a helpful note

->&mix{}

## Cook

Heat @oil{10ml} in a #pan{}. Cook for ~{10min}.
`;
	const compiled = compile(getAST(source));

	const optionMatrix: RendererOptions[] = [
		{},
		{ hideStepQty: true },
		{ interactiveScaling: true },
		{ bakersMathOnly: true },
		{ lang: "fr" },
	];

	for (const options of optionMatrix) {
		it(`all three backends render without throwing (options=${JSON.stringify(options)})`, () => {
			expect(() => toHTML(compiled, options)).not.toThrow();
			expect(() => toMarkdown(compiled, options)).not.toThrow();
			expect(() => toPrintHTML(compiled, options)).not.toThrow();
		});
	}

	it("all three backends emit shopping list before instructions, in a fixed order", () => {
		for (const render of [toHTML, toMarkdown, toPrintHTML] as const) {
			const out = render(compiled);
			const shoppingIdx = out.search(/shopping|🛒/i);
			const instructionsIdx = out.search(/instructions|👨‍🍳/i);
			expect(shoppingIdx).toBeGreaterThanOrEqual(0);
			expect(instructionsIdx).toBeGreaterThan(shoppingIdx);
		}
	});

	// hideStepQty regression, folded in from the retired hide-step-qty-parity.test.ts
	function stepLine(md: string): string {
		return md.trimEnd().split("\n").at(-1) ?? "";
	}

	it("markdown: hides the plaintext quantity in step text when set", () => {
		const c = compile(
			getAST("## Section\n\nMix @flour{200g} with @water{100ml}.\n"),
		);
		const shown = toMarkdown(c);
		const hidden = toMarkdown(c, { hideStepQty: true });

		expect(stepLine(shown)).toBe(
			"1. Mix **flour** (200 g) with **water** (100 ml).",
		);
		expect(stepLine(hidden)).toBe("1. Mix **flour** with **water**.");
	});

	it("markdown: still shows the quantity in the section ingredients list", () => {
		const c = compile(
			getAST("## Section\n\nMix @flour{200g} with @water{100ml}.\n"),
		);
		const hidden = toMarkdown(c, { hideStepQty: true });

		expect(hidden).toContain("**Ingredients**");
		expect(hidden).toContain("(200 g)");
	});

	it("html/print: write the quantity in the step text, as Markdown does, and keep the tooltip", () => {
		const c = compile(
			getAST("## Section\n\nMix @flour{200g} with @water{100ml}.\n"),
		);
		for (const out of [toHTML(c), toPrintHTML(c)]) {
			expect(out).toContain('<span class="step-quantity">(200 g)</span>');
			expect(out).toContain('data-tooltip="200 g"');
		}
	});

	describe("the standardized mass next to the quantity as written", () => {
		const analyzed = analyze(
			compile(
				getAST("## Dough\n\nMix @flour{250ml}, @sugar{100g} and @eggs{2}.\n"),
			),
			{
				flour: { name: "flour", physical: { density: 0.59 } },
				sugar: { name: "sugar", physical: { density: 0.85 } },
				eggs: { name: "eggs", physical: { unit_weight: 50 } },
			} as unknown as Record<string, IngredientData>,
		).result;

		it("is written in the step text, in HTML, print and Markdown", () => {
			for (const out of [toHTML(analyzed), toPrintHTML(analyzed)]) {
				expect(out).toContain(
					'<span class="step-quantity">(250 ml, ~147.5 g)</span>',
				);
				expect(out).toContain('<span class="step-quantity">(2, ~100 g)</span>');
			}
			expect(toMarkdown(analyzed)).toContain(
				"**flour** (250 ml, ~147.5 g), **sugar** (100 g) and **eggs** (2, ~100 g)",
			);
		});

		it("is left out for a quantity already in grams, the badge too", () => {
			const html = toHTML(analyzed);
			expect(html).toContain('<span class="step-quantity">(100 g)</span>');
			expect(html).not.toContain(">100g</span>");
		});

		it("is in the Markdown ingredient list", () => {
			expect(toMarkdown(analyzed)).toContain("- **flour** (250 ml, ~147.5 g)");
		});

		it("is not shown when the masses are not standardized", () => {
			const raw = analyze(
				compile(getAST("## Dough\n\nMix @flour{250ml}.\n")),
				{
					flour: { name: "flour", physical: { density: 0.59 } },
				} as unknown as Record<string, IngredientData>,
				{ enableMassStandardization: false },
			).result;
			expect(toMarkdown(raw)).toContain("**flour** (250 ml)");
			expect(toHTML(raw)).not.toContain("mass-badge");
		});
	});

	it("html/print: hideStepQty leaves the quantity out of the step text, in the tooltip only", () => {
		const c = compile(
			getAST("## Section\n\nMix @flour{200g} with @water{100ml}.\n"),
		);
		for (const out of [
			toHTML(c, { hideStepQty: true }),
			toPrintHTML(c, { hideStepQty: true }),
		]) {
			expect(out).not.toContain('class="step-quantity"');
			expect(out).toContain('data-tooltip="200 g"');
		}
	});

	// Phase 12: the 4 content-completeness gaps identified in Phase 11 (see
	// plan doc) have now been converged across all three backends, on
	// explicit user decision. Declaration placement (the 5th divergence
	// investigated in Phase 11) was explicitly left backend-specific — no
	// test needed since it was never covered before either.
	describe("Phase 12: converged content across backends", () => {
		const database: Record<string, IngredientData> = {
			bacon: {
				name: "Bacon",
				physical: { density: 1 },
				nutrition: { calories: 541, protein: 37, carbs: 1.4, fat: 42 },
			},
		};
		const nutritionSource = "## Section\n\nCook @bacon{100g}.\n";
		const { result: analyzed } = analyze(
			compile(getAST(nutritionSource)),
			database,
		);

		it("all three backends render nutrition data", () => {
			expect(toHTML(analyzed)).toContain("nutrition-panel");
			expect(toPrintHTML(analyzed)).toContain("nutrition");
			expect(toMarkdown(analyzed)).toContain("Calories");
		});

		it("all three backends accumulate footnotes instead of rendering comments inline", () => {
			const c = compile(
				getAST("## Section\n\nMix @flour{200g}. // a helpful note\n"),
			);
			expect(toHTML(c)).toContain("recipe-notes");
			expect(toMarkdown(c)).toContain("[^note-1]: a helpful note");
			expect(toPrintHTML(c)).toContain('class="notes"');
		});

		it("all three backends show the gross-mass note when purchasing mass differs from net mass", () => {
			// "1 avocado" (unit_weight 200g, yield 0.7) -> net mass (in the bowl)
			// 140g, purchasing mass (whole fruit, incl. peel/pit) 200g.
			const avocadoDb: Record<string, IngredientData> = {
				avocado: {
					name: "Avocado",
					physical: { density: 0.93, unit_weight: 200, yield: 0.7 },
				},
			};
			const { result } = analyze(
				compile(getAST("## Section\n\nSlice @avocado{1}.\n")),
				avocadoDb,
			);

			expect(toHTML(result)).toContain("gross-mass");
			expect(toMarkdown(result)).toContain("200g gross");
			expect(toPrintHTML(result)).toContain("gross-mass");
		});

		it("all three backends cluster mixed-unit entries with a warning instead of two separate lines", () => {
			// Same ingredient in two incompatible units (mass vs. volume) with no
			// density available to merge them -> analyzer flags both `multiUnit`.
			const { result } = analyze(
				compile(
					getAST(
						"## Melt\n\nMelt @butter{100g} in a pan.\n\n## Whip\n\nWhip @butter{1 cup} until fluffy.\n",
					),
				),
				{},
			);

			expect(toHTML(result)).toContain("mixed-units-badge");
			expect(toMarkdown(result)).toContain("Mixed units");
			expect(toPrintHTML(result)).toContain("mixed-units-badge");
		});
	});
});

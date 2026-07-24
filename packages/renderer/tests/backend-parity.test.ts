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

	it("html/print: accept hideStepQty without throwing, quantity stays available via tooltip", () => {
		const c = compile(
			getAST("## Section\n\nMix @flour{200g} with @water{100ml}.\n"),
		);
		const html = toHTML(c, { hideStepQty: true });
		const print = toPrintHTML(c, { hideStepQty: true });

		expect(html).toContain('data-tooltip="200 g"');
		expect(print).toContain('data-tooltip="200 g"');
	});

	// Content-completeness gaps: pinned as documented, typed no-ops (see
	// traversal.ts's RenderBackend + each backend's renderNutrition/
	// renderFootnotes comments) rather than accidental omissions. Extending
	// any of these to another backend is an explicit Phase 12 decision — if
	// one of these assertions starts failing, that decision has been made and
	// this test should be updated deliberately, not silently.
	describe("documented content-completeness gaps (Phase 12 decisions, not yet made)", () => {
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

		it("html and print render a nutrition panel; markdown does not", () => {
			expect(toHTML(analyzed)).toContain("nutrition-panel");
			expect(toPrintHTML(analyzed)).toContain("nutrition");
			expect(toMarkdown(analyzed)).not.toContain("Calories");
		});

		it("only html accumulates footnotes; markdown/print render inline comments instead", () => {
			const c = compile(
				getAST("## Section\n\nMix @flour{200g}. // a helpful note\n"),
			);
			expect(toHTML(c)).toContain("recipe-notes");
			expect(toMarkdown(c)).not.toContain("recipe-notes");
			expect(toPrintHTML(c)).not.toContain("recipe-notes");
		});
	});
});

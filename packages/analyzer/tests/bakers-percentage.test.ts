import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import type { IngredientData } from "../src/types";

// Regression test for the audit (2026-07-22, analyzer finding I1/§5(c)):
// `node.type === "ingredient"` was always false (kitchen never sets `.type`
// on a plain ingredient token), so Baker's Percentage was silently computed
// for `sections[].ingredients` and `shopping_list` but never propagated to
// the same ingredient's inline mention inside step text — a badge the
// renderer is fully able to display, just never received the data for.

const database: Record<string, IngredientData> = {
	flour: { name: "Flour", physical: { density: 1 } },
	water: { name: "Water", physical: { density: 1 } },
};

describe("Baker's Percentage propagation to inline step mentions", () => {
	it("sets bakersPercentage on an ingredient's inline step-content token, not just its section/shopping-list entries", () => {
		const source = "## Section\n\nMix @*flour{200g} with @water{100g}.\n";
		const compiled = compile(getAST(source));
		const { result } = analyze(compiled, database, { enableBakersMath: true });

		const step = result.sections[0]!.steps[0] as any;
		const flourToken = step.content.find((c: any) => c && c.id === "flour");
		const waterToken = step.content.find((c: any) => c && c.id === "water");

		expect(flourToken.bakersPercentage).toBe(100);
		expect(waterToken.bakersPercentage).toBe(50);

		// Consistent with the section-level entry for the same ingredient.
		const sectionFlour = result.sections[0]!.ingredients.find(
			(i: any) => i.id === "flour",
		) as any;
		expect(sectionFlour.bakersPercentage).toBe(flourToken.bakersPercentage);
	});
});

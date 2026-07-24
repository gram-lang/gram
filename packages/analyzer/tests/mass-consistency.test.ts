import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import type { IngredientData } from "../src/types";

// Regression tests for the audit (2026-07-22, analyzer finding B6/I10): the
// section-level pass computed `normalizedMass` inline without ever calling
// round2() on it, while the same usage's contribution to the shopping list
// went through round2() during aggregation — so the *same physical
// quantity* ended up with two different values in one analyzed output
// (measured: 250.78328000000002 in `sections[]`, 250.78 in `shopping_list`).
// A composite's children had the same duplicated-and-diverged sequence.
//
// Closure per the plan: an invariant that a section usage's normalizedMass
// always matches its shopping-list counterpart at the same _usageId, so any
// future reintroduction of a third, unrounded code path fails a test instead
// of silently shipping two numbers for one ingredient.

const database: Record<string, IngredientData> = {
	flour: { name: "Flour", physical: { density: 0.53 } },
	"lemon-juice": { name: "Lemon Juice", physical: { density: 0.53 } },
};

describe("normalizedMass consistency between sections and shopping_list", () => {
	it("rounds a plain ingredient's mass the same way in both places (db-001 scenario)", () => {
		const compiled = compile(getAST("## Section\n\nMix @flour{2 cups}.\n"));
		const { result } = analyze(compiled, database);

		const sectionUsage = result.sections[0]!.ingredients[0]! as any;
		const shoppingItem = result.shopping_list.find(
			(i: any) => i.id === "flour",
		) as any;

		// The raw physical computation (2 * 236.588mL * 0.53 g/mL) is
		// 250.78328 exactly — neither value should be that unrounded number.
		expect(sectionUsage.normalizedMass).toBe(250.78);
		expect(shoppingItem.normalizedMass).toBe(250.78);
		expect(sectionUsage.normalizedMass).toBe(shoppingItem.normalizedMass);
	});

	it("keeps a composite child's mass consistent with its own standardization, not a separately-rounded copy", () => {
		const compiled = compile(
			getAST(
				"## Section\n\nAdd @lemon zest{1}<@lemon.\n\nAdd @lemon juice{2 cups}<@lemon{1}.\n",
			),
		);
		const { result } = analyze(compiled, database);

		const composite = result.shopping_list.find(
			(i: any) => i.type === "composite",
		) as any;
		const juiceChild = composite.usage.find((u: any) => u.id === "lemon-juice");

		// Same db-001 numbers (2 cups of density-0.53 lemon juice): the
		// child's own standardized mass must be the rounded value the
		// composite total is actually built from, not a value diverging
		// from what's displayed.
		expect(juiceChild.normalizedMass).toBe(250.78);
	});

	it("propagates the same rounded value into the inline step-text token via _usageId sync", () => {
		const compiled = compile(getAST("## Section\n\nMix @flour{2 cups}.\n"));
		const { result } = analyze(compiled, database);

		const step = result.sections[0]!.steps[0] as any;
		const token = step.content.find((c: any) => c && c.id === "flour");

		expect(token.normalizedMass).toBe(250.78);
	});
});

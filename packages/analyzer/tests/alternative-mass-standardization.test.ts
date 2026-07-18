import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import type { IngredientData } from "../src/types";

// An alternative group's options are mutually exclusive ("egg OR tofu") — the
// group itself has no single mass, only whichever option is actually bought.
// analyze() previously had a dedicated branch for composite entries but none
// for alternatives, so every option silently stayed unstandardized: no
// normalizedMass in the shopping list, the section ingredient list, or the
// inline step-text mention, and calculateMassMetrics's own pre-existing
// "pick options[0] as the representative" fallback (metrics.ts) found nothing
// to pick — downgrading the whole recipe's massStatus to "incomplete" and
// adding the literal string "alternative" to missingMassIngredients.
const database: Record<string, IngredientData> = {
	flour: { name: "Flour", physical: { density: 0.55 } },
	egg: { name: "Egg", physical: { unit_weight: 50 } },
	tofu: { name: "Tofu", physical: { density: 1.0 } },
};

const source =
	"## Prep\n[Mix] @flour{200g} the @egg{2}|@tofu{200g} and stir.\n";
const compiled = compile(getAST(source));
const { result: analyzed, missingIngredients } = analyze(compiled, database);

describe("mass standardization for alternative ingredient groups", () => {
	it("standardizes each option in the shopping list independently, not the group as a whole", () => {
		const alt = analyzed.shopping_list.find(
			(item: any) => item.type === "alternative",
		) as any;
		expect(alt).toBeDefined();
		expect(alt.normalizedMass).toBeUndefined();

		const [eggOpt, tofuOpt] = alt.options;
		expect(eggOpt.normalizedMass).toBe(100); // 2 × 50g unit_weight
		expect(eggOpt.conversionMethod).toBe("unit_weight");
		expect(eggOpt.isEstimate).toBe(true);
		expect(tofuOpt.normalizedMass).toBe(200); // 200g, direct
		expect(tofuOpt.conversionMethod).toBe("physical");
		expect(tofuOpt.isEstimate).toBe(false);
	});

	it("standardizes each option in the section ingredient list the same way", () => {
		const alt = analyzed.sections[0]!.ingredients.find(
			(item: any) => item.type === "alternative",
		) as any;
		expect(alt.options[0].normalizedMass).toBe(100);
		expect(alt.options[1].normalizedMass).toBe(200);
	});

	it("syncs normalizedMass back into the inline step-text alternative mention too", () => {
		const step = analyzed.sections[0]!.steps[0] as any;
		const alt = step.content.find(
			(node: any) => node && node.type === "alternative",
		);
		expect(alt.options[0].normalizedMass).toBe(100);
		expect(alt.options[1].normalizedMass).toBe(200);
	});

	it("counts the first option toward the recipe's total mass and no longer reports 'alternative' as missing", () => {
		// calculateMassMetrics already picked options[0] as the representative
		// for an alternative group — it just had no normalizedMass to find
		// before this fix. flour (200) + egg option (100) = 300.
		expect(analyzed.metrics.totalMass).toBe(300);
		expect(analyzed.metrics.massStatus).toBe("estimated");
		expect(analyzed.metrics.missingMassIngredients).toEqual([]);
	});

	it("does not report the alternative wrapper's own literal id as a missing ingredient", () => {
		expect(missingIngredients).not.toContain("alternative");
	});
});

describe("composite mass standardization is unaffected (regression)", () => {
	it("still sums composite children into the parent's normalizedMass", () => {
		const compositeDb: Record<string, IngredientData> = {
			lemon: { name: "Lemon", physical: { unit_weight: 60 } },
		};
		const compositeSource =
			"## S\nX @lemon zest{5g}<@lemon.\n\nY @lemon juice{100g}<@lemon{2}.\n";
		const compositeCompiled = compile(getAST(compositeSource));
		const { result } = analyze(compositeCompiled, compositeDb);
		const composite = result.shopping_list.find(
			(item: any) => item.type === "composite",
		) as any;
		expect(composite.normalizedMass).toBe(105);
		expect(composite.usage[0].normalizedMass).toBe(5);
		expect(composite.usage[1].normalizedMass).toBe(100);
	});
});

import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML, toPrintHTML } from "../src/index";

// Regression tests for the audit (2026-07-22, renderer findings I-1 and I-2),
// found only once the renderer's `data` parameter was typed instead of `any`
// (finding I-6) — TypeScript flagged both dead/wrong property accesses at
// compile time, exactly as the audit predicted.

describe("nutrition panel warnings (I-1)", () => {
	it("renders nutrition panel when warnings are present even with 0 calories", () => {
		// "salt" isn't in the database at all -> MISSING_INGREDIENT warning,
		// calories stay at 0 -> the exact case the surrounding condition
		// ("Show if we have calories OR if we have warnings") was written for.
		const source = "## Section\n\nAdd @salt{5g}.\n";
		const compiled = compile(getAST(source));
		const { result } = analyze(compiled, {});
		const html = toHTML(result);

		expect(html).toContain("nutrition-panel");
	});
});

describe("print nutrition panel sodium unit (I-2)", () => {
	const database: Record<string, IngredientData> = {
		bacon: {
			name: "Bacon",
			physical: { density: 1 },
			nutrition: {
				calories: 541,
				protein: 37,
				carbs: 1.4,
				fat: 42,
				sodium: 1717,
			},
		},
	};

	it("renders sodium in milligrams, not grams", () => {
		const source = "## Section\n\nCook @bacon{100g}.\n";
		const compiled = compile(getAST(source));
		const { result } = analyze(compiled, database);
		const printHtml = toPrintHTML(result);

		// Units are now spaced, driven by NUTRIENTS' `unit` field.
		expect(printHtml).toContain("1717 mg");
		expect(printHtml).not.toContain("1717 g");
	});
});

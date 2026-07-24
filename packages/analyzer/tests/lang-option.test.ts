import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import type { IngredientData } from "../src/types";

// Audit 2026-07-22, i18n finding F-04/F-07/F-08/F-09, Phase 17: `analyze()`'s
// `lang` option threads through to every internal `standardizeMass` call
// (section ingredients, shopping-list composites/alternatives). This is an
// integration-level check that the option is accepted end-to-end and doesn't
// change results for non-colliding units — see mass_standardization.test.ts
// for why no test can demonstrate actual disambiguation today (no live
// collision exists between the en/fr unit dictionaries).

describe("analyze() lang option", () => {
	const database: Record<string, IngredientData> = {
		miel: { name: "Miel", physical: { density: 1.42 } },
	};

	it("standardizes a French-only unit correctly whether or not lang is passed", () => {
		const source = "## Section\n\nAdd @miel{1 tasse}.\n";
		const compiled = compile(getAST(source));

		const withLang = analyze(compiled, database, { lang: "fr" });
		const withoutLang = analyze(compiled, database, {});

		const miel = (list: typeof withLang.result.shopping_list) =>
			list.find((i) => "id" in i && i.id === "miel") as
				| { normalizedMass?: number }
				| undefined;

		expect(miel(withLang.result.shopping_list)?.normalizedMass).toBeCloseTo(
			355,
		);
		expect(miel(withoutLang.result.shopping_list)?.normalizedMass).toBe(
			miel(withLang.result.shopping_list)?.normalizedMass,
		);
	});

	it("accepts the option without throwing when omitted entirely", () => {
		const source = "## Section\n\nAdd @flour{200g}.\n";
		const compiled = compile(getAST(source));
		expect(() => analyze(compiled, {})).not.toThrow();
	});
});

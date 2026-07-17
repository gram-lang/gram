import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown } from "../src/index";

// Regression test for the bug where a French (or any non-English) recipe's
// shopping list displayed English ingredient names. `@gram-lang/analyzer`'s
// aggregateShoppingList() rewrites shopping_list[].id to a canonical English
// id (e.g. "flour") for grouping purposes, while preserving the recipe's own
// name (e.g. "Farine") in shopping_list[].name. The renderer must display
// that preserved name instead of re-deriving one from the (now-mismatched)
// registry lookup on the canonical id.
const source = "## Préparation\nMélanger @farine{200g} et @beurre{50g}.\n";
const compiled = compile(getAST(source));

const aggregatedShoppingList = [
	{ id: "flour", name: "Farine", qty: 200, unit: "g", normalizedMass: 200 },
	{ id: "butter", name: "Beurre", qty: 50, unit: "g", normalizedMass: 50 },
];

const analyzed = { ...compiled, shopping_list: aggregatedShoppingList };

describe("shopping list ingredient name localization", () => {
	it("HTML shopping list shows the recipe's own name, not the canonical English id", () => {
		const html = toHTML(analyzed);
		expect(html).toContain("Farine");
		expect(html).toContain("Beurre");
		expect(html).not.toMatch(/>flour</);
		expect(html).not.toMatch(/>butter</);
	});

	it("Markdown shopping list shows the recipe's own name, not the canonical English id", () => {
		const md = toMarkdown(analyzed);
		expect(md).toContain("Farine");
		expect(md).toContain("Beurre");
		expect(md).not.toMatch(/\*\*flour\*\*/);
		expect(md).not.toMatch(/\*\*butter\*\*/);
	});
});

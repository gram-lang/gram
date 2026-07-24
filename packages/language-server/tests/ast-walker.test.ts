import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	collectIntermediates,
	collectReferences,
	collectIngredients,
} from "../src/utils/ast-walker";

// Regression tests for the audit (2026-07-22, parser finding I3): these
// walkers assumed every top-level `RecipeAST.children` entry was a
// `SectionAST` and read `.children`/`.intermediateDecl` off it
// unconditionally. That's false whenever a document has no `## Section`
// header (implicit content) or has leading blocks before the first header —
// a bare top-level Step silently produced nothing, and a bare top-level
// Comment crashed (`.children` doesn't exist on `CommentAST`).

describe("ast-walker robustness on non-Section top-level content", () => {
	it("does not throw on a headerless recipe with a leading comment", () => {
		const ast = getAST("// just a note\nMix @flour{200g}.\n");
		expect(() => collectIngredients(ast)).not.toThrow();
		expect(() => collectReferences(ast)).not.toThrow();
		expect(() => collectIntermediates(ast)).not.toThrow();
	});

	it("still finds ingredients inside a bare top-level step (no section header)", () => {
		const ast = getAST("Mix @flour{200g}.\n");
		const ingredients = collectIngredients(ast);
		expect(ingredients.map((i) => i.name)).toEqual(["flour"]);
	});

	it("still finds references inside a bare top-level step", () => {
		const ast = getAST("Use &ghost.\n");
		const refs = collectReferences(ast);
		expect(refs.map((r) => r.name)).toEqual(["ghost"]);
	});

	it("still finds ingredients and intermediates for a real section, unaffected by the fix", () => {
		const ast = getAST(
			"## Batter ->&batter\n\nMix @flour{200g}.\n\n## Cooking\n\nPour &batter into a #pan.\n",
		);
		expect(collectIngredients(ast).map((i) => i.name)).toEqual(["flour"]);
		expect(collectReferences(ast).map((r) => r.name)).toEqual(["batter"]);
		expect(collectIntermediates(ast).map((d) => d.decl.name)).toEqual([
			"batter",
		]);
	});
});

import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// Regression tests for the audit (2026-07-22, kitchen finding F-012):
// `detectCycles` (src/graph.ts) is a correct DFS cycle detector, but it was
// only ever fed ingredient-formula dependencies (`@x{50% @&y}`) — never the
// language's other, more prominent dependency mechanism: section-level
// `->&produced` / `&consumed` intermediates. An indirect cycle between two
// intermediates (`&a -> &b -> &a`) went through completely undetected.

describe("indirect intermediate cycle detection", () => {
	const source = `## Make Batter ->&batter

Mix @flour{200g}. Needs &glaze to finish.

## Make Glaze ->&glaze

Mix @sugar{100g}. Needs &batter to finish.
`;

	it("flags every intermediate involved in an indirect cycle (&a -> &b -> &a)", () => {
		const result = compile(getAST(source));

		const circular = result.warnings.filter(
			(w) => w.code === "CIRCULAR_REFERENCE",
		);
		const names = circular.map((w) => (w as { item: string }).item).sort();

		expect(names).toEqual(["batter", "glaze"]);
	});

	it("does not flag a normal, acyclic intermediate dependency", () => {
		const acyclicSource = `## Batter ->&batter

Mix @flour{200g}.

## Cooking

Pour &batter into a #pan and cook.
`;
		const result = compile(getAST(acyclicSource));

		const circular = result.warnings.filter(
			(w) => w.code === "CIRCULAR_REFERENCE",
		);
		expect(circular).toEqual([]);
	});
});

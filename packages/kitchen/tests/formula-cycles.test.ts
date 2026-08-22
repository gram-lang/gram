import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import type { ShoppingListItem } from "../src/types";

// Regression test for the v0.0 preliminary fix ahead of the module-imports
// RFC (.notes/plan-ajout-imports-recettes.md, §C.5/§F.2): `detectCycles`
// (src/graph.ts) used to build a single graph across every section, even
// though `resolveRelativeQuantities` only ever looks at the current section.
// Two sections that each resolve fine on their own, but whose same-named
// ingredients form a cycle when read together, produced a false positive.
// Fixed by building one graph per section and unioning the results.

describe("per-section formula cycle detection", () => {
	it("does not flag a formula cycle that only exists across two sections", () => {
		const source = `## Pastry

Mix @flour{50% @&water}.

## Glaze

Brush with @water{70% @&flour}.
`;
		const result = compile(getAST(source));

		const circularItems = (
			result.shopping_list.filter(
				(item): item is ShoppingListItem => "variableParts" in item,
			) as ShoppingListItem[]
		).filter((item) => item.variableParts?.some((p) => p.includes("Circular")));

		expect(circularItems).toEqual([]);
	});
});

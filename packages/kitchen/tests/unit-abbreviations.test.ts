import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// Issue #24: `{1/2 c.à.s}` used to silently drop its quantity and truncate the
// ingredient name to its first word, so distinct ingredients merged into one
// shopping-list entry. The grammar-level regressions live in
// @gram-lang/parser; this covers what the cook sees in the shopping list.
describe("dotted unit abbreviations in the shopping list", () => {
	const source = `---
title: 'T'
---

## Sucre

@sucre a{1/2 c.à.s} puis @sucre b{1 c.à.c}.

@sucre c{1 c. à s.} et @sucre d{1 c.à.s.}.

@sucre e{1 c.a.s} et @sucre f{1 càs}.
`;

	it("keeps six distinct ingredients, each with its quantity", () => {
		const list = compile(getAST(source)).shopping_list;
		expect(list.map((i) => i.id).sort()).toEqual([
			"sucre-a",
			"sucre-b",
			"sucre-c",
			"sucre-d",
			"sucre-e",
			"sucre-f",
		]);
		for (const item of list) {
			expect(item.qty).toBeDefined();
			expect(item.unit).toBeDefined();
		}
	});

	it("emits no warning for a recognised abbreviation", () => {
		expect(compile(getAST(source)).warnings).toEqual([]);
	});
});

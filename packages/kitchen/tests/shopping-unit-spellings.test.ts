import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import type { CompositeItem, ShoppingListItem } from "../src/shopping";

// The shopping list grouped an ingredient by its unit as written, so `cup`
// and `cups` (or `c.à.s` and `tbsp`) gave two entries flagged as mixed
// units, which also refused the ingredient as a `--target`.
function listOf(body: string): ShoppingListItem[] {
	const source = `---\ntitle: 'T'\n---\n\n## Section\n\n${body}\n`;
	return compile(getAST(source)).shopping_list as ShoppingListItem[];
}

describe("shopping list: spellings of one unit", () => {
	it("adds up a singular and a plural spelling in one entry", () => {
		const list = listOf("@flour{1 cup} then @flour{2 cups}.");
		const flour = list.filter((i) => i.id === "flour");
		expect(flour).toHaveLength(1);
		expect(flour[0]?.qty).toBe(3);
		expect(flour[0]?.unit).toBe("cup");
		expect(flour[0]?.multiUnit).toBeUndefined();
	});

	it("adds up two abbreviations of one unit", () => {
		const list = listOf("@sucre{1 c.à.s} puis @sucre{2 tbsp}.");
		const sucre = list.filter((i) => i.id === "sucre");
		expect(sucre).toHaveLength(1);
		expect(sucre[0]?.qty).toBe(3);
		expect(sucre[0]?.unit).toBe("c.à.s");
	});

	it("still keeps different units apart", () => {
		const list = listOf("@flour{1 cup} then @flour{20 g}.");
		const flour = list.filter((i) => i.id === "flour");
		expect(flour).toHaveLength(2);
		expect(flour.every((i) => i.multiUnit)).toBe(true);
	});

	it("adds up the spellings of a composite child's unit", () => {
		const list = listOf(
			"@zeste{1 tsp}<@citron{1} puis @zeste{1 teaspoons}<@citron{1}.",
		);
		const parent = list.find((i) => i.id === "citron") as
			| CompositeItem
			| undefined;
		const zest = parent?.usage?.filter((u) => u.id === "zeste") ?? [];
		expect(zest).toHaveLength(1);
		expect(zest[0]?.qty).toBe(2);
	});
});

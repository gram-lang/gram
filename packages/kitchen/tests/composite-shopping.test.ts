import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// The user-visible half of the `<@&parent` parser fix. The grammar-level
// regression lives in @gram-lang/parser's grammar-edge-cases.test.ts; this
// covers what the cook actually sees — the shopping list.
//
// The MAX rule means two draws from one parent buy one parent. Before the fix,
// writing the second draw as `<@&unwaxed lemon{}` truncated the parent to a
// phantom ingredient named "&unwaxed", which slugified to a different id and
// so escaped the MAX aggregation: the list said to buy the same lemon twice,
// and no warning fired.
describe("composite parents in the shopping list", () => {
	const ids = (source: string) =>
		compile(getAST(source))
			.shopping_list.map((i) => i.id)
			.sort();

	it("collapses two draws from the same parent into one purchase", () => {
		const source = `---
title: 'T'
---

[Zest] The @zest{1}<@lemon{1} and the @juice{1}<@lemon{1}.
`;
		expect(ids(source)).toEqual(["lemon"]);
	});

	it("collapses when the second draw marks the parent as already introduced", () => {
		const source = `---
title: 'T'
---

[Zest] The @zest{1}<@lemon{1} and the @juice{1}<@&lemon{}.
`;
		expect(ids(source)).toEqual(["lemon"]);
	});

	it("collapses a MULTI-WORD parent marked as already introduced", () => {
		const source = `---
title: 'T'
---

[Zest] The @zest{1}<@unwaxed lemon{1} and the @juice{1}<@&unwaxed lemon{}.
`;
		expect(ids(source)).toEqual(["unwaxed-lemon"]);
	});

	it("never leaves a reference sigil in an ingredient's display name", () => {
		const source = `---
title: 'T'
---

[Zest] The @zest{1}<@unwaxed lemon{1} and the @juice{1}<@&unwaxed lemon{}.
`;
		const names = compile(getAST(source)).shopping_list.map((i) => i.name);
		expect(names.filter((n) => n.includes("&"))).toEqual([]);
	});
});

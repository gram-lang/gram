import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode } from "../src/warnings";

// A bare/generic composite child name (`@juice`) slugifies to the same
// registry id no matter which parent it's drawn from. If a recipe attaches
// it to two different parents, both usages silently collapse onto one
// database entry (same nutrition/mass profile) unless flagged.
describe("composite child attached to conflicting parents", () => {
	it("warns when the same child id resolves to two different parents", () => {
		const source = `---
title: 'T'
---

[Zest] The @juice{1}<@lemon{1} and the @juice{1}<@orange{1}.
`;
		const result = compile(getAST(source));
		const conflict = result.warnings.find(
			(w) => w.code === WarningCode.COMPOSITE_PARENT_CONFLICT,
		);
		expect(conflict).toBeDefined();
		expect(conflict?.message).toContain("juice");
		expect(conflict?.message).toContain("lemon");
		expect(conflict?.message).toContain("orange");
	});

	it("does not warn when the same child stays attached to the same parent", () => {
		const source = `---
title: 'T'
---

[Zest] The @zest{1}<@lemon{1} and the @juice{1}<@lemon{1}.
`;
		const result = compile(getAST(source));
		const conflict = result.warnings.find(
			(w) => w.code === WarningCode.COMPOSITE_PARENT_CONFLICT,
		);
		expect(conflict).toBeUndefined();
	});

	it("does not warn when composite children use full, disambiguated names", () => {
		const source = `---
title: 'T'
---

[Juice] The @lemon juice{1}<@lemon{1} and the @orange juice{1}<@orange{1}.
`;
		const result = compile(getAST(source));
		const conflict = result.warnings.find(
			(w) => w.code === WarningCode.COMPOSITE_PARENT_CONFLICT,
		);
		expect(conflict).toBeUndefined();
	});
});

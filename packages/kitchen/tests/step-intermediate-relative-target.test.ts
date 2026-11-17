import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, WarningCode } from "../src/index";

// An intermediate declared by a step (`Mix … ->&dough.`) was never known to
// a share of it: `@salt{2% &dough}` raised VARIABLE_NOT_FOUND and was marked
// as a ghost, while one declared by a section title was found.
const codes = (source: string) =>
	compile(getAST(source)).warnings.map((w) => w.code);

describe("a share of an intermediate declared by a step", () => {
	const source =
		"## Dough\n\nMix @flour{500 g} ->&dough.\n\n## Bake\n\nCut &dough{200 g} and add @salt{2% &dough}.\n";

	it("finds its target", () => {
		expect(codes(source)).toEqual([]);
		const salt = compile(getAST(source)).sections[1]?.ingredients.find(
			(i) => i.id === "salt",
		);
		expect(salt?.formula).toMatchObject({ target: "dough", isGhost: false });
	});

	it("is the same as for one declared by a section title", () => {
		expect(
			codes(
				"## Dough ->&dough\n\nMix @flour{500 g}.\n\n## Bake\n\nCut &dough{200 g} and add @salt{2% &dough}.\n",
			),
		).toEqual(codes(source));
	});

	it("still refuses a share written before the declaration", () => {
		expect(
			codes(
				"## Dough\n\nAdd @salt{2% &dough}.\n\nMix @flour{500 g} ->&dough.\n",
			),
		).toContain(WarningCode.VARIABLE_NOT_FOUND);
	});
});

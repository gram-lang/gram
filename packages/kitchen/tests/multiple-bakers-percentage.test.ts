import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode } from "../src/warnings";

const bakersWarnings = (source: string) =>
	compile(getAST(source)).warnings.filter(
		(w) => w.code === WarningCode.MULTIPLE_BAKERS_PERCENTAGE,
	);

// A recipe has one baker's-percentage base (#198): a second one used to make
// compile() throw, so the editor lost every other diagnostic.
describe("more than one baker's-percentage base (*)", () => {
	const source = `## Dough

[Mix] @*flour{500 g} and @*rye{100 g}.

[Add] @water{350 g}.
`;

	it("compiles, with a warning on the second base", () => {
		const warnings = bakersWarnings(source);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.item).toBe("rye");
		expect(warnings[0]?.message).toContain("flour");
	});

	it("keeps the first ingredient marked as the only base", () => {
		const result = compile(getAST(source));
		const marked = result.shopping_list
			.filter((i) => i.modifiers?.includes("bakers_percentage"))
			.map((i) => i.id);
		expect(marked).toEqual(["flour"]);
		const rye = result.sections[0]?.ingredients.find((i) => i.id === "rye");
		expect(rye?.modifiers).toBeUndefined();
	});

	it("still compiles the rest of the recipe", () => {
		const result = compile(getAST(source));
		expect(result.shopping_list.map((i) => i.id)).toEqual([
			"flour",
			"rye",
			"water",
		]);
	});

	it("warns once per extra ingredient, across sections", () => {
		expect(
			bakersWarnings(`## A

Mix @*flour{500 g} and @*rye{100 g}.

## B

Add @*rye{50 g} and @*spelt{50 g}.
`).map((w) => w.item),
		).toEqual(["rye", "spelt"]);
	});

	it("accepts the same ingredient marked twice: it is the same base", () => {
		expect(
			bakersWarnings(`Mix @*flour{400 g}.

Dust with @*flour{100 g}.
`),
		).toEqual([]);
	});
});

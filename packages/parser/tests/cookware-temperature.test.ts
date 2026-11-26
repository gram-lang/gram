import { describe, expect, it } from "bun:test";
import { GramParseError, getAST } from "../src/index";

const errorOf = (source: string): GramParseError => {
	try {
		getAST(source);
	} catch (e) {
		if (e instanceof GramParseError) return e;
		throw e;
	}
	throw new Error("expected a parse error");
};

// `#oven{180°C}`: a temperature in cookware braces. The error says where a
// temperature goes (`^oven{180°C}`), rather than only that cookware takes no unit.
describe("a temperature in cookware braces", () => {
	it("points to ^name{…} with the cookware's own name", () => {
		const e = errorOf("## Bake\n\nPreheat the #oven{180°C}.\n");
		expect(e.message).toContain(
			"Invalid quantity '{180°C}' for cookware 'oven'",
		);
		expect(e.message).toContain("^oven{180°C}");
		expect(e.offset).toBe("## Bake\n\nPreheat the #oven".length);
	});

	it("reads °F, spaces, and a multi-word name", () => {
		expect(
			errorOf("## Cuire\n\nPréchauffer le #four{180 °F}.\n").message,
		).toContain("^four{180 °F}");
		expect(
			errorOf("## Bake\n\nHeat the #dutch oven{220 ° C}.\n").message,
		).toContain("^dutch oven{220 ° C}");
	});

	it("keeps the usual message for any other unit", () => {
		const e = errorOf("## Prep\n\nUse a #casserole{grande} here.\n");
		expect(e.message).toBe(
			"Gram Syntax Error: Invalid quantity '{grande}' for cookware 'casserole'. Expected a number only, with no unit (cookware quantities take no unit), e.g. {2}.",
		);
		expect(errorOf("## Prep\n\nUse a #pan{20cm}.\n").message).not.toContain(
			"^",
		);
	});
});

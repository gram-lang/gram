import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { analyze } from "../src/index";

describe("analyze leaves the compiled result alone", () => {
	const source =
		"## Dough\n\nMix @flour{500 g}, @*butter{2} and @salt{2% @&butter}.\n";

	it("gives the same warnings when run twice on the same result", () => {
		const compiled = compile(getAST(source));
		const before = structuredClone(compiled.warnings);
		const first = analyze(compiled, {}).result.warnings;
		const second = analyze(compiled, {}).result.warnings;
		expect(first.map((w) => w.code)).toContain(
			"RELATIVE_QUANTITY_UNKNOWN_MASS",
		);
		expect(second).toEqual(first);
		expect(compiled.warnings).toEqual(before);
	});
});

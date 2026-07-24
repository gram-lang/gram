import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown } from "../src/index";

// Regression test for the audit (2026-07-22, renderer finding, discovered during
// Phase 9): `item.formula?.is_partial` in `formatters/element.ts` was read in 3
// places but never written anywhere in kitchen/analyzer (only `.isGhost` exists
// on `Usage["formula"]`), so those branches were dead and were removed as part
// of Phase 10's cleanup. This pins the real, always-reachable behavior for a
// formula-derived ("relative quantity") ingredient, so a future reintroduction
// of a similarly dead branch would have to actually change this output.

describe("relative-quantity ingredient rendering (formula, not is_partial)", () => {
	const source = "## Section\n\nMix @flour{250g} and @water{60% @&flour}.\n";
	const compiled = compile(getAST(source));

	it("renders the formula as plain quantity text in HTML, not a formula-qty warning badge", () => {
		const html = toHTML(compiled);

		expect(html).not.toContain("formula-qty");
		expect(html).toContain('data-tooltip="60% of flour"');
	});

	it("renders the formula as plain quantity text in Markdown", () => {
		const md = toMarkdown(compiled);

		expect(md).toContain("**water** (60% of flour)");
	});
});

import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src";

const span = (text: string, loc?: { start: number; end: number }) =>
	loc ? text.slice(loc.start, loc.end) : undefined;

describe("warnings on an anchor", () => {
	it("point at the anchor, not at the whole section", () => {
		for (const [anchor, code] of [
			["~{-1:30}", "INVALID_DURATION"],
			["~{-2 bananas}", "INVALID_UNIT"],
			["~{la veille}", "MISSING_UNIT"],
			["~{-1,000h}", "AMBIGUOUS_NUMBER"],
			["~{-9999999d}", "DURATION_OUT_OF_RANGE"],
		] as const) {
			const text = `## Pâte ${anchor}\n\nMélanger.\n\nPétrir longuement.\n`;
			const warning = compile(getAST(text)).warnings.find(
				(w) => w.code === code,
			);
			expect(span(text, warning?.loc)).toBe(anchor);
		}
	});
});

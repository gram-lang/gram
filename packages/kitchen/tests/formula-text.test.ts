import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// A shopping entry Gram could not count (a share, a ratio waiting for its
// target or whose target is missing) is written from the values the parser
// read, never from the source spelling: `gram format` trims `1.50` to `1.5`
// and respaces `15g/ L`, and the compiled recipe must not change (#225).
// The decimal separator stays the author's.

const entries = (body: string): string[] =>
	compile(getAST(`## Prep\n\n${body}\n`)).shopping_list.flatMap(
		(entry) => entry.variable_entries ?? [],
	);

describe("an unresolved ratio's shopping entry (#225)", () => {
	for (const [body, entry] of [
		["Add @a{1.0/&b}.", "(1 / &b ❓)"],
		["Add @a{1.50 / 100.0 g @&b}.", "(1.5 / 100 g @&b ❓)"],
		["Add @a{1,50 / 100 g @&b}.", "(1,5 / 100 g @&b ❓)"],
		["Add @a{1.0-2.0 / 100 g @&b}.", "(1-2 / 100 g @&b ❓)"],
		["Add @a{15 g / 1 L @&b}.", "(15 g / L @&b ❓)"],
		["Add @a{1 / @&b}.", "(1 / @&b ❓)"],
		["Add @a{1 1/2 / 100 g @&b}.", "(1 1/2 / 100 g @&b ❓)"],
		["Add @a{½ / 100 g @&b}.", "(½ / 100 g @&b ❓)"],
		["Add @b{1 pinch}.\n\nAdd @a{1.0 / 100 g @&b}.", "1 / 100 g @&b"],
	] as const) {
		it(`writes ${JSON.stringify(body)} as ${JSON.stringify(entry)}`, () => {
			expect(entries(body)).toContain(entry);
		});
	}

	it("is the same before and after the source is respaced", () => {
		expect(entries("Add @a{1.50 / 100.0 g @&b}.")).toEqual(
			entries("Add @a{1.5 / 100 g @&b}."),
		);
		expect(entries("Add @a{15g/ L @&b}.")).toEqual(
			entries("Add @a{15 g / L @&b}."),
		);
	});
});

describe("an unresolved share's shopping entry", () => {
	it("keeps the author's decimal comma", () => {
		expect(entries("Add @a{12,50% @&b}.")).toEqual(["(12,5% of b ❓)"]);
	});

	it("writes a point when the author did", () => {
		expect(entries("Add @a{12.50% @&b}.")).toEqual(["(12.5% of b ❓)"]);
		expect(entries("Add @a{5.0% &b}.")).toEqual(["(5% of b ❓)"]);
	});
});

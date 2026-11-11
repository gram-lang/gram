import { describe, expect, it } from "bun:test";
import printBase from "../src/shared/print.css" with { type: "text" };
import tokens from "../src/shared/tokens.css" with { type: "text" };

// A view printed like its screen version (the recipe, the run sheet) is set
// in the fonts of the screen: the print base declares the same tokens, with
// the same values, since the screen stylesheet is not on the printed page.
function token(css: string, name: string): string | undefined {
	const value = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];
	return value?.replace(/\s+/g, " ").trim();
}

describe("print fonts", () => {
	for (const name of ["--gram-font-sans", "--gram-font-mono"]) {
		it(`${name} is the same on paper as on screen`, () => {
			expect(token(tokens, name)).toBeDefined();
			expect(token(printBase, name)).toBe(token(tokens, name));
		});
	}
});

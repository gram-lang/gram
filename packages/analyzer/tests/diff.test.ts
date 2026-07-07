import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { diffRecipes } from "../src/diff";

const compileRecipe = (src: string) => compile(getAST(src));

describe("diffRecipes — temperature ranges", () => {
	it("detects a range change even when the average stays the same ({2-3} -> {1-4})", () => {
		const a = compileRecipe("## Section\nBake at ^{200-300C}.\n");
		const b = compileRecipe("## Section\nBake at ^{100-400C}.\n");

		const { temperatures } = diffRecipes(a, b);
		expect(temperatures).toHaveLength(1);
		expect(temperatures[0]?.change).toBe("changed");
		expect(temperatures[0]?.from?.range).toEqual({ min: 200, max: 300 });
		expect(temperatures[0]?.to?.range).toEqual({ min: 100, max: 400 });
	});

	it("reports no change when both value and range are identical", () => {
		const a = compileRecipe("## Section\nBake at ^{200-300C}.\n");
		const b = compileRecipe("## Section\nBake at ^{200-300C}.\n");

		const { temperatures } = diffRecipes(a, b);
		expect(temperatures).toHaveLength(0);
	});
});

describe("diffRecipes — duplicate section titles", () => {
	it("does not lose the first section's tokens when two sections share a title", () => {
		const a = compileRecipe(
			"## Filling\nWhisk at ^{160C}.\n\n## Filling\nBake at ^{180C}.\n",
		);
		const b = compileRecipe(
			"## Filling\nWhisk at ^{170C}.\n\n## Filling\nBake at ^{180C}.\n",
		);

		const { temperatures } = diffRecipes(a, b);
		// Only the first (unnamed, positionally-matched) temperature changed
		// (160 -> 170); the second (180 -> 180) did not. Both must be visible
		// to matchTokenPairs — if the first section's tokens were overwritten
		// instead of accumulated, this change would be invisible or mispaired.
		expect(temperatures).toHaveLength(1);
		expect(temperatures[0]?.from?.value).toBe(160);
		expect(temperatures[0]?.to?.value).toBe(170);
	});
});

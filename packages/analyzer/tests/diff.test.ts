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

	// Regression test for the audit (2026-07-22, finding B3): the exact same
	// overwrite-instead-of-accumulate bug as above, but in diffSections
	// itself rather than extractTokensByType — a section title used to be
	// keyed through a plain Map.set, so the first of two same-titled
	// sections silently vanished from the section-level diff.
	it("does not lose the first section's own delta in diffSections when two sections share a title", () => {
		const a = compileRecipe(
			"## Filling\nOne step here.\n\n## Filling\nBake at ^{180C}.\n",
		);
		const b = compileRecipe(
			"## Filling\nOne step here.\n\nAnother step.\n\n## Filling\nBake at ^{180C}.\n",
		);

		const { sections } = diffRecipes(a, b);
		expect(sections).toHaveLength(1);
		expect(sections[0]?.title).toBe("Filling");
		expect(sections[0]?.fromStepCount).toBe(1);
		expect(sections[0]?.toStepCount).toBe(2);
	});
});

// Regression tests for the audit (2026-07-22, finding B2): composite and
// alternative groups were excluded from diffIngredients entirely, so a
// quantity change inside either produced `hasChanges: false` — a diff tool
// asserting "nothing changed" is worse than no diff tool at all.
describe("diffRecipes — composites and alternatives are diffable (finding B2)", () => {
	const compositeSource = (zestQty: string, juiceQty: string) => `
Add @lemon zest{${zestQty}}<@lemon.

Add @lemon juice{100ml}<@lemon{${juiceQty}}.
`;

	it("detects a quantity change on a composite parent's own total", () => {
		const a = compileRecipe(compositeSource("1", "2"));
		const b = compileRecipe(compositeSource("1", "7"));

		const result = diffRecipes(a, b);
		expect(result.hasChanges).toBe(true);
		const lemon = result.ingredients.find((d) => d.id === "lemon");
		expect(lemon?.change).toBe("changed");
		expect(lemon?.fromQty).toBe(2);
		expect(lemon?.toQty).toBe(7);
	});

	it("detects a quantity change on a composite's nested child, even when the parent's total is unaffected", () => {
		// juice{2} stays the max, so the parent's own total (2) doesn't
		// change — only the nested zest child does (1 -> 1.5).
		const a = compileRecipe(compositeSource("1", "2"));
		const b = compileRecipe(compositeSource("1.5", "2"));

		const result = diffRecipes(a, b);
		expect(result.hasChanges).toBe(true);
		const lemon = result.ingredients.find((d) => d.id === "lemon");
		expect(lemon).toBeUndefined(); // parent total genuinely unchanged
		const zest = result.ingredients.find((d) => d.id === "lemon-zest");
		expect(zest?.change).toBe("changed");
		expect(zest?.fromQty).toBe(1);
		expect(zest?.toQty).toBe(1.5);
	});

	it("detects a quantity change on either option inside an alternative group", () => {
		const a = compileRecipe("Add @egg{2}|@tofu{200g}.\n");
		const b = compileRecipe("Add @egg{9}|@tofu{900g}.\n");

		const result = diffRecipes(a, b);
		expect(result.hasChanges).toBe(true);
		expect(result.ingredients.find((d) => d.id === "egg")?.toQty).toBe(9);
		expect(result.ingredients.find((d) => d.id === "tofu")?.toQty).toBe(900);
	});
});

// Regression test for the audit (2026-07-22, finding B3): matchTokenPairs
// used to key named tokens through a plain `Map.set`, so two same-named
// timers in one section had the first silently overwritten and vanish from
// the diff (distinct from the section-title duplication above — this is a
// duplicate *token name within* a single section).
describe("diffRecipes — same-named tokens within a single section (finding B3)", () => {
	it("does not lose the first timer's change when two timers share a name", () => {
		const a = compileRecipe("Wait ~oven{10min}.\n\nWait ~oven{20min}.\n");
		const b = compileRecipe("Wait ~oven{15min}.\n\nWait ~oven{20min}.\n");

		const { timers } = diffRecipes(a, b);
		expect(timers).toHaveLength(1);
		expect(timers[0]?.from).toBe("10 min");
		expect(timers[0]?.to).toBe("15 min");
	});
});

// Generative-style sweep for the audit's stated closure criterion (2026-07-22,
// §4.1 finding 6-bis): "a test that mutates a random field in the compiled
// JSON and requires hasChanges === true" — enumerated here over every shape
// of Usage the shopping list can hold, rather than hand-picking the two
// cases the audit happened to find, per the report's own "class not site"
// principle.
describe("diffRecipes — every quantity mutation is visible (finding 6-bis)", () => {
	const baseSource = `
Add @flour{500g}.

Add @lemon zest{1}<@lemon.

Add @lemon juice{100ml}<@lemon{2}.

Add @egg{2}|@tofu{200g}.
`;
	const base = compileRecipe(baseSource);

	const mutations: Record<string, string> = {
		"plain ingredient": baseSource.replace("flour{500g}", "flour{999g}"),
		"composite parent total": baseSource.replace("lemon{2}", "lemon{77}"),
		"composite nested child": baseSource.replace("zest{1}", "zest{9}"),
		"alternative option A": baseSource.replace("egg{2}", "egg{99}"),
		"alternative option B": baseSource.replace("tofu{200g}", "tofu{999g}"),
	};

	for (const [label, mutatedSource] of Object.entries(mutations)) {
		it(`detects a mutation of: ${label}`, () => {
			const mutated = compileRecipe(mutatedSource);
			expect(diffRecipes(base, mutated).hasChanges).toBe(true);
		});
	}
});

// module-imports RFC §F.0.2: a spliced-in module section always lands at the
// head of `sections[]`, so title/position-keyed diffing must ignore it —
// otherwise adding a single `@use` line would look like the whole recipe's
// sections shifted. `CompilationResult.modules` isn't produced by compile()
// itself (only by @gram-lang/modules' finalizeComposed after composing) —
// stamped by hand here, the same way the renderer's module-badge tests do,
// to exercise diffRecipes in isolation from the whole compose pipeline.
describe("diffRecipes — module-imports RFC §F.0.2", () => {
	const moduleInfo = (overrides: Partial<Record<string, unknown>> = {}) => ({
		binding: "pate",
		uri: "./bases/pate.gram",
		title: "Pate",
		mode: "inline" as const,
		...overrides,
	});

	it("does not treat a newly-added module section as the host's own sections shifting", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe(
			"## Pate\n\nMix @flour{200g}.\n\n## Montage\n\nUse the base.\n",
		);
		b.sections[0]!.module = moduleInfo();

		const { sections } = diffRecipes(a, b);
		expect(sections).toEqual([]);
	});

	it("ignores a module section's own preparations/temperatures/timers", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe(
			"## Pate\n\nBake @flour{200g} at ^{180C} for ~{10min}.\n\n## Montage\n\nUse the base.\n",
		);
		b.sections[0]!.module = moduleInfo();

		const result = diffRecipes(a, b);
		expect(result.preparations).toEqual([]);
		expect(result.temperatures).toEqual([]);
		expect(result.timers).toEqual([]);
	});

	it("reports a newly-added import in the modules delta", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe("## Montage\nUse the base.\n");
		b.modules = [moduleInfo({ scaleFactor: 1 }) as never];

		const { modules } = diffRecipes(a, b);
		expect(modules).toEqual([
			{
				uri: "./bases/pate.gram",
				change: "added",
				toBinding: "pate",
				toFactor: 1,
			},
		]);
	});

	it("reports a removed import in the modules delta", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe("## Montage\nUse the base.\n");
		a.modules = [moduleInfo({ scaleFactor: 1 }) as never];

		const { modules } = diffRecipes(a, b);
		expect(modules).toEqual([
			{
				uri: "./bases/pate.gram",
				change: "removed",
				fromBinding: "pate",
				fromFactor: 1,
			},
		]);
	});

	it("reports a changed scale factor for the same import", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe("## Montage\nUse the base.\n");
		a.modules = [moduleInfo({ scaleFactor: 1 }) as never];
		b.modules = [moduleInfo({ scaleFactor: 2 }) as never];

		const { modules, hasChanges } = diffRecipes(a, b);
		expect(hasChanges).toBe(true);
		expect(modules).toEqual([
			{
				uri: "./bases/pate.gram",
				change: "changed",
				fromBinding: "pate",
				toBinding: "pate",
				fromFactor: 1,
				toFactor: 2,
			},
		]);
	});

	it("reports no module delta when nothing about the import changed", () => {
		const a = compileRecipe("## Montage\nUse the base.\n");
		const b = compileRecipe("## Montage\nUse the base.\n");
		a.modules = [moduleInfo({ scaleFactor: 1 }) as never];
		b.modules = [moduleInfo({ scaleFactor: 1 }) as never];

		expect(diffRecipes(a, b).modules).toEqual([]);
	});
});

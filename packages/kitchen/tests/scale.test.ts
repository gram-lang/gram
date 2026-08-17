import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import {
	resolveScaleFactor,
	applyScale,
	InvalidFactorError,
	IngredientNotFoundError,
	NestedOnlyTargetError,
	AlternativeTargetError,
	FixedIngredientError,
	RelativeTargetError,
	AmbiguousMultiUnitError,
	NonNumericTargetError,
	UnitMismatchError,
} from "../src/scale";
import type { CompilationResult } from "../src/types";

function compileRecipe(src: string): CompilationResult {
	return compile(getAST(src));
}

describe("resolveScaleFactor — factor mode", () => {
	it("accepts a positive finite factor", () => {
		expect(resolveScaleFactor(null, { type: "factor", value: 2 })).toEqual({
			factor: 2,
			resolvedFrom: "factor",
		});
	});

	it.each([
		0,
		-1,
		NaN,
		Infinity,
	])("rejects non-positive/non-finite factor %p", (value) => {
		expect(() => resolveScaleFactor(null, { type: "factor", value })).toThrow(
			InvalidFactorError,
		);
	});
});

describe("resolveScaleFactor — target mode", () => {
	const recipe = compileRecipe(`
[Mix] Add @*flour{500g}, @water{70% @&flour}, @salt{10g}.
Add @flour{2 cups} for dusting.
Heat @=oil{50ml} in a pan.
Add @garnish{a pinch}.
Add @butter{100g}|@margarine{100g}.
Add @lemon zest{1}<@lemon.
Add @lemon juice{100ml}<@lemon{2}.
`);

	it("computes a factor from a simple numeric ingredient", () => {
		const res = resolveScaleFactor(recipe, {
			type: "target",
			id: "salt",
			qty: 20,
			unit: "g",
		});
		expect(res.factor).toBe(2);
		expect(res.resolvedFrom).toBe("target");
		expect(res.targetId).toBe("salt");
	});

	it("slugifies the requested id before lookup (case/spacing tolerant)", () => {
		const res = resolveScaleFactor(recipe, {
			type: "target",
			id: "Salt",
			qty: 20,
			unit: "g",
		});
		expect(res.factor).toBe(2);
	});

	it("converts compatible units via the injected convertUnit", () => {
		const convertUnit = (value: number, from: string, to: string) => {
			if (from === "kg" && to === "g") return value * 1000;
			return null;
		};
		const res = resolveScaleFactor(
			recipe,
			{ type: "target", id: "salt", qty: 0.02, unit: "kg" },
			convertUnit,
		);
		expect(res.factor).toBe(2);
		expect(res.unitConverted).toBe(true);
	});

	it("throws UnitMismatchError when units differ and no converter is given", () => {
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: "salt",
				qty: 0.02,
				unit: "kg",
			}),
		).toThrow(UnitMismatchError);
	});

	it("throws UnitMismatchError across incompatible physical families when the converter has no density to bridge with", () => {
		const convertUnit = () => null; // e.g. no density available for this ingredient
		expect(() =>
			resolveScaleFactor(
				recipe,
				{ type: "target", id: "salt", qty: 1, unit: "ml" },
				convertUnit,
			),
		).toThrow(UnitMismatchError);
	});

	it("bridges mass <-> volume when the injected converter resolves a density — the engine itself has no notion of density", () => {
		// Simulates what a density-aware converter (e.g. @gram-lang/analyzer's convertUnit
		// bound to an ingredient's density) would return: 12g of salt at a fictional
		// density of 1.2 g/mL is 10mL, matching the recipe's 10g.
		const convertUnit = (value: number, from: string, to: string) => {
			if (from === "ml" && to === "g") return value * 1.2;
			return null;
		};
		const res = resolveScaleFactor(
			recipe,
			{ type: "target", id: "salt", qty: 10, unit: "ml" },
			convertUnit,
		);
		expect(res.factor).toBe(1.2);
		expect(res.unitConverted).toBe(true);
	});

	it("throws IngredientNotFoundError for an unknown id, listing available ids", () => {
		try {
			resolveScaleFactor(recipe, {
				type: "target",
				id: "sugar",
				qty: 10,
				unit: "g",
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(IngredientNotFoundError);
			expect((err as IngredientNotFoundError).availableIds).toContain("salt");
			expect((err as IngredientNotFoundError).availableIds).toContain("lemon"); // composite parent is now a valid target
			expect((err as IngredientNotFoundError).availableIds).not.toContain(
				"lemon-zest",
			); // nested-only child is not
		}
	});

	it("throws FixedIngredientError for an @= protected ingredient", () => {
		try {
			resolveScaleFactor(recipe, {
				type: "target",
				id: "oil",
				qty: 100,
				unit: "ml",
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(FixedIngredientError);
			expect((err as FixedIngredientError).reason).toBe("protected");
		}
	});

	it('throws NonNumericTargetError for a quantity-less/text ingredient (e.g. "a pinch")', () => {
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: "garnish",
				qty: 1,
				unit: null,
			}),
		).toThrow(NonNumericTargetError);
	});

	it("throws RelativeTargetError for a formula-derived ingredient", () => {
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: "water",
				qty: 300,
				unit: "g",
			}),
		).toThrow(RelativeTargetError);
	});

	it("throws AmbiguousMultiUnitError when the ingredient is split across incompatible units", () => {
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: "flour",
				qty: 1,
				unit: "kg",
			}),
		).toThrow(AmbiguousMultiUnitError);
	});

	it("computes a factor from a composite (sub-recipe) parent total", () => {
		// "lemon" needs 2 total (max of zest:1, juice-cost:2) — a well-defined
		// absolute quantity, same as any other aggregated ingredient.
		const res = resolveScaleFactor(recipe, {
			type: "target",
			id: "lemon",
			qty: 6,
			unit: null,
		});
		expect(res.factor).toBe(3);
	});

	it("throws NestedOnlyTargetError for an ingredient only used inside a composite, and its suggested fix (scale the parent) actually works", () => {
		let parentId: string | undefined;
		try {
			resolveScaleFactor(recipe, {
				type: "target",
				id: "lemon-zest",
				qty: 3,
				unit: null,
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(NestedOnlyTargetError);
			parentId = (err as NestedOnlyTargetError).parentId;
			expect(parentId).toBe("lemon");
		}
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: parentId!,
				qty: 6,
				unit: null,
			}),
		).not.toThrow();
	});

	it("throws AlternativeTargetError for an ingredient inside an alternative group", () => {
		try {
			resolveScaleFactor(recipe, {
				type: "target",
				id: "butter",
				qty: 200,
				unit: "g",
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(AlternativeTargetError);
			expect((err as AlternativeTargetError).siblingIds).toEqual(["margarine"]);
		}
	});

	it("throws InvalidFactorError for a zero-quantity reference ingredient", () => {
		const zeroRecipe = compileRecipe(`Add @salt{0g}.`);
		expect(() =>
			resolveScaleFactor(zeroRecipe, {
				type: "target",
				id: "salt",
				qty: 10,
				unit: "g",
			}),
		).toThrow(InvalidFactorError);
	});

	it("throws InvalidFactorError for a non-positive requested target quantity", () => {
		expect(() =>
			resolveScaleFactor(recipe, {
				type: "target",
				id: "salt",
				qty: -5,
				unit: "g",
			}),
		).toThrow(InvalidFactorError);
	});
});

describe("applyScale", () => {
	const recipe = compileRecipe(`---
portions: 2
---
[Mix] Add @flour{500g} and @salt{10g}.
Heat @=oil{50ml} in a pan.
`);

	it("is pure: never mutates the original CompilationResult", () => {
		const snapshot = JSON.parse(JSON.stringify(recipe));
		applyScale(recipe, 2);
		expect(recipe).toEqual(snapshot);
	});

	it("scales quantities, skips fixed ingredients, and updates portions + scaleFactor", () => {
		const scaled: any = applyScale(recipe, 2);
		const flour = scaled.shopping_list.find((i: any) => i.id === "flour");
		const oil = scaled.shopping_list.find((i: any) => i.id === "oil");
		expect(flour.qty).toBe(1000);
		expect(oil.qty).toBe(50); // fixed, unchanged
		expect(scaled.meta.portions).toBe("4"); // frontmatter values parse as strings
		expect(scaled.scaleFactor).toBe(2);
	});

	it("returns the same reference for a factor of 1 (no-op)", () => {
		expect(applyScale(recipe, 1)).toBe(recipe);
	});

	it("re-applying a different factor always starts from the same original (no compounding)", () => {
		const scaledA: any = applyScale(recipe, 2);
		const scaledB: any = applyScale(recipe, 3);
		const flourA = scaledA.shopping_list.find((i: any) => i.id === "flour");
		const flourB = scaledB.shopping_list.find((i: any) => i.id === "flour");
		expect(flourA.qty).toBe(1000);
		expect(flourB.qty).toBe(1500);
	});

	// Regression test, corrected (audit 2026-07-22, finding F-010): the
	// previous version of this test called `applyScale(recipe, 2)` where
	// `recipe` came from `compileRecipe()` — i.e. already passed through
	// `compile()`'s own `cleanObject()`, which rebuilds every object fresh
	// with no identity table. By that point section.ingredients and the
	// step's inline token are no longer the same object, so the test passed
	// without ever exercising the WeakSet dedup guard it claimed to cover —
	// a "regression test" that could not fail. The shared reference only
	// exists *inside* compile(), before its own cleanObject() call, which is
	// exactly what `compile(ast, { scaleFactor })` exercises.
	it("scales a section ingredient's qty by the factor exactly once, not squared, even though it shares an object reference with its inline step token", () => {
		const ast = getAST(`
[Mix] Add @flour{500g} and @salt{10g}.
Heat @=oil{50ml} in a pan.
`);
		const scaled: any = compile(ast, { scaleFactor: 2 });
		const sectionFlour = scaled.sections[0].ingredients.find(
			(i: any) => i.id === "flour",
		);
		expect(sectionFlour.qty).toBe(1000); // 500 * 2, not 500 * 2 * 2

		const stepToken = scaled.sections[0].steps[0].content.find(
			(t: any) => t && t.id === "flour",
		);
		expect(stepToken.qty).toBe(1000);
	});

	// Regression test for the audit (2026-07-22, finding F-001): applyScale()
	// never touched `cookware` explicitly, and only scaled it "by accident"
	// through a shared object reference that compile()'s own cleanObject()
	// call destroys — so these two supposedly-equivalent entry points
	// silently diverged on cookware. Verified: previously
	// `applyScale(compile(ast), 3).cookware[0].qty` stayed at 2 while
	// `compile(ast, { scaleFactor: 3 }).cookware[0].qty` was 6.
	describe("parity with compile({ scaleFactor })", () => {
		const cookwareSource = `
[Mix] Use #pan{2} and @flour{500g}.
`;

		it("scales top-level cookware the same way through both entry points", () => {
			const ast = getAST(cookwareSource);
			const viaCompile: any = compile(ast, { scaleFactor: 3 });
			const viaApplyScale: any = applyScale(compile(getAST(cookwareSource)), 3);

			expect(viaApplyScale.cookware).toEqual(viaCompile.cookware);
			expect(viaCompile.cookware[0].qty).toBe(6);
			expect(viaApplyScale.cookware[0].qty).toBe(6);
		});

		it("scales section-level cookware the same way through both entry points", () => {
			const ast = getAST(cookwareSource);
			const viaCompile: any = compile(ast, { scaleFactor: 3 });
			const viaApplyScale: any = applyScale(compile(getAST(cookwareSource)), 3);

			expect(viaApplyScale.sections[0].cookware).toEqual(
				viaCompile.sections[0].cookware,
			);
		});

		it("produces the same full result through both entry points for a mixed ingredient/cookware recipe", () => {
			const ast = getAST(cookwareSource);
			const viaCompile = compile(ast, { scaleFactor: 3 });
			const viaApplyScale = applyScale(compile(getAST(cookwareSource)), 3);

			expect(viaApplyScale).toEqual(viaCompile);
		});

		// Same class of bug as F-001 above, found while building `scaleAst`
		// for the module-imports RFC (.notes/plan-ajout-imports-recettes.md,
		// Phase D.3) and its own compile(scaleAst(ast,f)) vs
		// applyScale(compile(ast),f) equivalence test: an alternative group
		// (`@a|@b`) has no `.qty` of its own, only its `.options[]` do, and a
		// composite child's own `composite.quantity` (how much of the parent
		// it draws) is a field `mutateUsage` never looked at — both silently
		// stayed unscaled by `applyScale(compile(ast), f)` once cleanObject()
		// had already broken the shared references the section/shopping-list
		// walks were relying on.
		const altCompositeSource = `## Section

@butter{100g}|@margarine{80g}.

@egg-yolks{2}<@eggs{3}.
`;

		it("scales an alternative group's options the same way through both entry points", () => {
			const ast = getAST(altCompositeSource);
			const viaCompile: any = compile(ast, { scaleFactor: 3 });
			const viaApplyScale: any = applyScale(
				compile(getAST(altCompositeSource)),
				3,
			);

			expect(viaApplyScale.sections[0].ingredients).toEqual(
				viaCompile.sections[0].ingredients,
			);
			const altOptions = viaApplyScale.sections[0].ingredients[0].options;
			expect(altOptions[0].qty).toBe(300);
			expect(altOptions[1].qty).toBe(240);
		});

		it("scales a composite child's own parent-quantity the same way through both entry points", () => {
			const ast = getAST(altCompositeSource);
			const viaCompile: any = compile(ast, { scaleFactor: 3 });
			const viaApplyScale: any = applyScale(
				compile(getAST(altCompositeSource)),
				3,
			);

			expect(viaApplyScale.sections[0].ingredients).toEqual(
				viaCompile.sections[0].ingredients,
			);
			const yolks = viaApplyScale.sections[0].ingredients[1];
			expect(yolks.qty).toBe(6);
			expect(yolks.composite.quantity).toBe(9);
		});
	});

	// Regression test found while typing scaleQty (utils.ts) instead of `any`
	// as part of the Phase 10bis strict-typing pass: scaling a fraction
	// quantity kept `type: "fraction"` but set the (non-optional, per
	// QuantityValueAST) `numerator`/`denominator` fields to `undefined` —
	// producing a structurally malformed value (`{type:"fraction", value:1}`,
	// no numerator/denominator at all) once JSON-serialized.
	it("turns a scaled fraction into a clean 'single' value instead of a malformed fraction", () => {
		const ast = getAST(`## Section\n\nMix @flour{1/2 cup}.\n`);
		const scaled: any = applyScale(compile(ast), 2);
		const flour = scaled.sections[0].ingredients[0];

		expect(flour.qty).toEqual({ type: "single", value: 1 });
	});

	// Regression tests for the audit (2026-07-22, kitchen finding F-015): the
	// scale *factor* was validated (isPositiveFinite in scale/engine.ts,
	// CompilerOptionsSchema), but the *product* of a quantity and a valid,
	// finite, positive factor never was, and wasn't rounded either.
	describe("overflow and rounding (F-015)", () => {
		it("throws InvalidFactorError instead of silently producing Infinity/null on overflow", () => {
			const recipe = compileRecipe(`## Section\n\nAdd @flour{500g}.\n`);
			expect(() => applyScale(recipe, 1e308)).toThrow(InvalidFactorError);
		});

		it("rounds scaled quantities to 2 decimals instead of leaking float noise", () => {
			const recipe = compileRecipe(`## Section\n\nAdd @flour{100g}.\n`);
			const scaled: any = applyScale(recipe, 1.1);
			const flour = scaled.shopping_list.find((i: any) => i.id === "flour");
			// Raw `100 * 1.1` is `110.00000000000001` in IEEE 754 float.
			expect(flour.qty).toBe(110);
		});

		it("scales a composite parent's total through scaleQty (rounded), not a raw multiplication", () => {
			const recipe = compileRecipe(
				`## Section\n\nSeparate @egg yolks{3}<@eggs{3} from the whites.\n`,
			);
			const scaled: any = applyScale(recipe, 1.1);
			const composite = scaled.shopping_list.find(
				(i: any) => i.type === "composite",
			);
			// Raw `3 * 1.1` is `3.3000000000000003` in IEEE 754 float.
			expect(composite.qty).toBe(3.3);
		});
	});
});

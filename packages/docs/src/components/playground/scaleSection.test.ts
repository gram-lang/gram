import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import {
	type ScaleState,
	type UnitListState,
	isScaleModified,
	knownUnits,
	matchingUnits,
	parseScaleQuantity,
	factorForPortions,
	scaleBadgeTitle,
	targetChange,
	unitKey,
} from "./scaleSection";

const en = getDictionary("en");
const shoppingList = [
	{ id: "flour", name: "Flour", qty: 200, unit: "g" },
	{ id: "salt", name: "Salt" },
];
const state = (extra: Partial<ScaleState> = {}): ScaleState => ({
	shoppingList,
	scaleTargetId: null,
	scaleTargetQty: null,
	scaleTargetUnit: "",
	...extra,
});

describe("the scale section's dot", () => {
	it("is off at 100% of the whole recipe", () => {
		expect(isScaleModified(state())).toBe(false);
		expect(isScaleModified(state({ scaleFactorString: "100" }))).toBe(false);
	});

	it("is on for another percentage or an ingredient as the target", () => {
		expect(isScaleModified(state({ scaleFactorString: "150" }))).toBe(true);
		expect(isScaleModified(state({ scaleTargetId: "flour" }))).toBe(true);
	});

	it("says the scale in a few words", () => {
		expect(scaleBadgeTitle(state({ scaleFactorString: "150" }), en)).toBe(
			`${en.playground.options.scaleGlobal}: 150%`,
		);
		expect(scaleBadgeTitle(state(), en)).toBe(
			`${en.playground.options.scaleGlobal}: 100%`,
		);
		expect(
			scaleBadgeTitle(
				state({
					scaleTargetId: "flour",
					scaleTargetQty: 300,
					scaleTargetUnit: "g",
				}),
				en,
			),
		).toBe(`${en.playground.badges.byIngredient}: Flour (300 g)`);
		// An ingredient that left the shopping list is named by its id.
		expect(
			scaleBadgeTitle(
				state({ scaleTargetId: "gone", scaleTargetQty: null }),
				en,
			),
		).toBe(`${en.playground.badges.byIngredient}: gone`);
	});
});

describe("the quantity a cook types", () => {
	it("reads numbers, decimals and fractions", () => {
		expect(parseScaleQuantity("300")).toBe(300);
		expect(parseScaleQuantity("1.5")).toBe(1.5);
		expect(parseScaleQuantity("3/4")).toBe(0.75);
	});

	it("gives nothing for what it cannot read", () => {
		for (const text of ["", "abc", "1/0", "1/", "/2", "1/2/3", "a/b"]) {
			expect(parseScaleQuantity(text)).toBeNull();
		}
	});
});

describe("choosing the ingredient to scale by", () => {
	it("takes its unit and its quantity", () => {
		expect(targetChange("flour", shoppingList)).toEqual({
			id: "flour",
			unit: "g",
			qty: 200,
		});
	});

	it("takes no quantity from an ingredient that has none", () => {
		expect(targetChange("salt", shoppingList)).toEqual({
			id: "salt",
			unit: "",
			qty: null,
		});
	});

	it("only clears the target when the choice is emptied, or the ingredient is unknown", () => {
		expect(targetChange("", shoppingList)).toEqual({ id: null });
		expect(targetChange("ghost", shoppingList)).toEqual({ id: "ghost" });
		expect(targetChange("flour", undefined)).toEqual({ id: "flour" });
	});
});

describe("the units offered under the field", () => {
	it("knows the mass and the volume units, each once", () => {
		expect(knownUnits).toContain("g");
		expect(knownUnits).toContain("ml");
		expect(new Set(knownUnits).size).toBe(knownUnits.length);
	});

	it("offers them all for an empty field", () => {
		expect(matchingUnits(["g", "kg", "ml"], "")).toEqual(["g", "kg", "ml"]);
		expect(matchingUnits(["g", "kg", "ml"], "   ")).toEqual(["g", "kg", "ml"]);
	});

	it("puts the units that start with what is typed before those that contain it", () => {
		expect(matchingUnits(["tbsp", "cup", "kg", "g", "mg"], "g")).toEqual([
			"g",
			"kg",
			"mg",
		]);
		expect(matchingUnits(["cup", "tbsp", "tsp"], "TS")).toEqual(["tsp"]);
		expect(matchingUnits(["g", "kg"], "zz")).toEqual([]);
	});
});

describe("the keys in the unit list", () => {
	const closed: UnitListState = { open: false, highlighted: -1 };
	const open = (highlighted: number): UnitListState => ({
		open: true,
		highlighted,
	});

	it("opens the list on the first or the last unit with the arrows", () => {
		expect(unitKey("ArrowDown", closed, 5)).toEqual({
			open: true,
			highlighted: 0,
			preventDefault: true,
		});
		expect(unitKey("ArrowUp", closed, 5)).toEqual({
			open: true,
			highlighted: 4,
			preventDefault: true,
		});
	});

	it("moves in the list, and stops at its ends", () => {
		expect(unitKey("ArrowDown", open(1), 5).highlighted).toBe(2);
		expect(unitKey("ArrowDown", open(4), 5).highlighted).toBe(4);
		expect(unitKey("ArrowUp", open(3), 5).highlighted).toBe(2);
		expect(unitKey("ArrowUp", open(0), 5).highlighted).toBe(0);
	});

	it("stays where it is, and still holds the arrow back, when no unit matches", () => {
		expect(unitKey("ArrowDown", open(-1), 0)).toEqual({
			open: true,
			highlighted: -1,
			preventDefault: true,
		});
		expect(unitKey("ArrowUp", open(-1), 0).preventDefault).toBe(true);
	});

	it("picks the highlighted unit with Enter", () => {
		expect(unitKey("Enter", open(2), 5)).toEqual({
			open: true,
			highlighted: 2,
			preventDefault: true,
			select: 2,
		});
	});

	it("applies the scale and closes the list with Enter when no unit is highlighted", () => {
		for (const [s, count] of [
			[open(-1), 5],
			[closed, 5],
			[open(0), 0],
		] as const) {
			const result = unitKey("Enter", s, count);
			expect(result.submit).toBe(true);
			expect(result.open).toBe(false);
			expect(result.select).toBeUndefined();
			expect(result.preventDefault).toBe(false);
		}
	});

	it("closes the list with Escape, holding the key back only when it was open", () => {
		expect(unitKey("Escape", open(1), 5)).toEqual({
			open: false,
			highlighted: 1,
			preventDefault: true,
		});
		expect(unitKey("Escape", closed, 5).preventDefault).toBe(false);
	});

	it("closes the list with Tab and lets the focus go", () => {
		expect(unitKey("Tab", open(1), 5)).toEqual({
			open: false,
			highlighted: 1,
			preventDefault: false,
		});
	});

	it("ignores the other keys", () => {
		expect(unitKey("a", open(1), 5)).toEqual({
			open: true,
			highlighted: 1,
			preventDefault: false,
		});
	});
});

describe("factorForPortions", () => {
	it("turns a count of portions into the overall scale", () => {
		expect(factorForPortions(6, 4)).toBe("150");
		expect(factorForPortions(3, 8)).toBe("37.5");
		expect(factorForPortions(4, 4)).toBe("100");
		expect(factorForPortions(1, 3)).toBe("33.33");
	});

	it("gives nothing for a count that is no count, or a recipe with no portions", () => {
		expect(factorForPortions(0, 4)).toBeNull();
		expect(factorForPortions(Number.NaN, 4)).toBeNull();
		expect(factorForPortions(6, null)).toBeNull();
	});
});

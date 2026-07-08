import { describe, it, expect } from "bun:test";
import {
	parseRef,
	parseScaleArg,
	getScaleWarnings,
	buildScaleComparison,
} from "../src/services/scaler";

describe("parseRef", () => {
	it("parses a value with a unit", () => {
		expect(parseRef("farine=300g")).toEqual({
			id: "farine",
			value: 300,
			unit: "g",
		});
	});

	it("parses a value without a unit", () => {
		expect(parseRef("eggs=3")).toEqual({ id: "eggs", value: 3, unit: null });
	});

	it("trims whitespace around id and value", () => {
		expect(parseRef(" farine = 300g ")).toEqual({
			id: "farine",
			value: 300,
			unit: "g",
		});
	});

	it("throws when there is no '=' separator", () => {
		expect(() => parseRef("farine300g")).toThrow(/Invalid ref syntax/);
	});

	it("throws when the value is not numeric", () => {
		expect(() => parseRef("farine=abc")).toThrow(/Cannot parse quantity/);
	});

	it("throws for a zero quantity", () => {
		expect(() => parseRef("farine=0g")).toThrow(/Invalid quantity/);
	});

	it("throws for a negative quantity (rejected by the numeric regex itself)", () => {
		expect(() => parseRef("farine=-5g")).toThrow(/Cannot parse quantity/);
	});
});

describe("parseScaleArg", () => {
	it("recognizes ref mode when '=' is present", () => {
		expect(parseScaleArg("farine=300g")).toEqual({
			type: "ref",
			raw: "farine=300g",
		});
	});

	it("recognizes factor mode for a plain number", () => {
		expect(parseScaleArg("1.5")).toEqual({ type: "factor", value: 1.5 });
	});

	it("throws for a non-numeric factor", () => {
		expect(() => parseScaleArg("abc")).toThrow(/Invalid --scale value/);
	});

	it("throws for a zero or negative factor", () => {
		expect(() => parseScaleArg("0")).toThrow(/Invalid --scale value/);
		expect(() => parseScaleArg("-2")).toThrow(/Invalid --scale value/);
	});
});

describe("getScaleWarnings", () => {
	it("returns no warnings for a normal factor and zero time", () => {
		expect(getScaleWarnings(2, 0)).toEqual([]);
	});

	it("warns on extreme scale factor below 0.1", () => {
		const warnings = getScaleWarnings(0.05, 0);
		expect(warnings.some((w) => w.includes("Extreme scale factor"))).toBe(true);
	});

	it("warns on extreme scale factor above 20", () => {
		const warnings = getScaleWarnings(25, 0);
		expect(warnings.some((w) => w.includes("Extreme scale factor"))).toBe(true);
	});

	it("does not warn at the boundary values 0.1 and 20", () => {
		expect(getScaleWarnings(0.1, 0)).toEqual([]);
		expect(getScaleWarnings(20, 0)).toEqual([]);
	});

	it("warns that cooking times are not adjusted when totalTimeMinutes > 0", () => {
		const warnings = getScaleWarnings(2, 45);
		expect(warnings.some((w) => w.includes("Cooking times"))).toBe(true);
	});

	it("can return both warnings at once", () => {
		const warnings = getScaleWarnings(30, 45);
		expect(warnings).toHaveLength(2);
	});
});

describe("buildScaleComparison", () => {
	it("pairs original and scaled items by id and unit", () => {
		const original = [{ id: "flour", name: "Flour", unit: "g", qty: 200 }];
		const scaled = [{ id: "flour", name: "Flour", unit: "g", qty: 400 }];
		const result = buildScaleComparison(original, scaled);
		expect(result).toEqual([
			{
				id: "flour",
				name: "Flour",
				unit: "g",
				originalQty: 200,
				scaledQty: 400,
			},
		]);
	});

	it("does not collide items sharing an id but with different units", () => {
		const original = [
			{ id: "milk", name: "Milk", unit: "g", qty: 500 },
			{ id: "milk", name: "Milk", unit: "cup", qty: 2 },
		];
		const scaled = [
			{ id: "milk", name: "Milk", unit: "g", qty: 1000 },
			{ id: "milk", name: "Milk", unit: "cup", qty: 4 },
		];
		const result = buildScaleComparison(original, scaled);
		expect(result).toEqual([
			{
				id: "milk",
				name: "Milk",
				unit: "g",
				originalQty: 500,
				scaledQty: 1000,
			},
			{ id: "milk", name: "Milk", unit: "cup", originalQty: 2, scaledQty: 4 },
		]);
	});

	it("marks items without a numeric quantity as nonScalable", () => {
		const original = [
			{ id: "salt", name: "Salt", unit: null, qty: "to taste" },
		];
		const result = buildScaleComparison(original, []);
		expect(result).toEqual([
			{ id: "salt", name: "Salt", unit: null, nonScalable: true },
		]);
	});

	it("excludes composite and alternative items from both lists", () => {
		const original = [
			{ id: "flour", name: "Flour", unit: "g", qty: 200 },
			{ id: "eggs", name: "Eggs", type: "composite", qty: 3 },
			{ id: "butter", name: "Butter or oil", type: "alternative", qty: 50 },
		];
		const result = buildScaleComparison(original, []);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("flour");
	});

	it("leaves scaledQty undefined when no matching scaled item exists", () => {
		const original = [{ id: "flour", name: "Flour", unit: "g", qty: 200 }];
		const result = buildScaleComparison(original, []);
		expect(result[0]?.scaledQty).toBeUndefined();
		expect(result[0]?.originalQty).toBe(200);
	});
});

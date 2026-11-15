import { describe, it, expect } from "bun:test";
import {
	formatTerm,
	formatTerms,
	isTermValue,
	mergeTerms,
	QuantityOverflowError,
	round2,
	scaleTerms,
	scaleTermValue,
	type Term,
	termsTotal,
	termValueNumber,
} from "../src/quantity";

const range = (min: number, max: number, text?: string) => ({
	type: "range" as const,
	value: (min + max) / 2,
	range: { min, max },
	...(text !== undefined && { text }),
});

describe("termValueNumber", () => {
	it("reads a number, a single, a fraction and the middle of a range", () => {
		expect(termValueNumber(3)).toBe(3);
		expect(termValueNumber({ type: "single", value: 2 })).toBe(2);
		expect(
			termValueNumber({
				type: "fraction",
				value: 0.5,
				numerator: 1,
				denominator: 2,
				text: "1/2",
			}),
		).toBe(0.5);
		expect(termValueNumber(range(2, 3))).toBe(2.5);
	});

	it("tells a term value from a text or a relative quantity", () => {
		expect(isTermValue(1)).toBe(true);
		expect(isTermValue(range(1, 2))).toBe(true);
		expect(isTermValue("une pincée")).toBe(false);
		expect(isTermValue({ type: "RelativeQuantity", percent: 10 })).toBe(false);
		expect(isTermValue(null)).toBe(false);
	});
});

describe("termsTotal", () => {
	it("has no total without a term", () => {
		expect(termsTotal([])).toBeNull();
	});

	it("keeps one term as written", () => {
		const fraction = {
			type: "fraction" as const,
			value: 0.5,
			numerator: 1,
			denominator: 2,
			text: "1/2",
		};
		expect(termsTotal([{ value: fraction, unit: "cup" }])).toEqual({
			qty: fraction,
			unit: "cup",
		});
	});

	it("keeps a range a range", () => {
		const total = termsTotal([{ value: range(2, 3, "2-3"), unit: "g" }]);
		expect(total?.qty).toEqual(range(2, 3, "2-3"));
	});

	it("adds the spellings of one unit, in the first unit written", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: 2, unit: "cups" },
			]),
		).toEqual({ qty: 3, unit: "cup" });
	});

	it("adds a range by its middle", () => {
		expect(
			termsTotal([
				{ value: range(2, 3), unit: "g" },
				{ value: 200, unit: "g" },
			]),
		).toEqual({ qty: 202.5, unit: "g" });
	});

	it("takes away a term taken away, in the unit of a term added", () => {
		expect(
			termsTotal([
				{ value: 4, unit: "tbsp", minus: true },
				{ value: 10, unit: "tbsp" },
			]),
		).toEqual({ qty: 6, unit: "tbsp" });
	});

	it("has no single total across units", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: 20, unit: "g" },
			]),
		).toBeNull();
	});
});

describe("mergeTerms", () => {
	it("keeps every term, terms added before terms taken away", () => {
		const terms: Term[] = [
			{ value: 2, unit: "tbsp" },
			{ value: 4, unit: "tbsp", minus: true },
			{ value: 1, unit: "cup" },
		];
		expect(mergeTerms(terms, "unit")).toEqual([
			{ value: 2, unit: "tbsp" },
			{ value: 1, unit: "cup" },
			{ value: 4, unit: "tbsp", minus: true },
		]);
	});

	it("never moves a term among the terms of its own sign", () => {
		const terms: Term[] = [
			{ value: 1, unit: "g" },
			{ value: 2, unit: "kg" },
			{ value: 3, unit: "g" },
		];
		expect(mergeTerms(terms, "unit")).toEqual(terms);
	});
});

describe("scaleTerms", () => {
	it("leaves every value alone at a factor of 1", () => {
		const value = { type: "single" as const, value: 2, text: "2" };
		expect(scaleTermValue(value, 1)).toBe(value);
	});

	it("scales a number and rounds it to 2 decimals", () => {
		expect(scaleTermValue(1, 1 / 3)).toBe(0.33);
	});

	it("drops the source text of a scaled value", () => {
		expect(scaleTermValue({ type: "single", value: 2, text: "2" }, 2)).toEqual({
			type: "single",
			value: 4,
			text: undefined,
		});
		expect(scaleTermValue(range(1, 2, "1-2"), 2)).toEqual({
			type: "range",
			value: 3,
			range: { min: 2, max: 4 },
			text: undefined,
		});
	});

	it("turns a scaled fraction into a single value", () => {
		expect(
			scaleTermValue(
				{ type: "fraction", value: 0.5, numerator: 1, denominator: 2 },
				3,
			),
		).toEqual({ type: "single", value: 1.5 });
	});

	it("keeps units and signs", () => {
		expect(
			scaleTerms(
				[
					{ value: 1, unit: "cup" },
					{ value: 2, unit: "tbsp", minus: true },
				],
				2,
			),
		).toEqual([
			{ value: 2, unit: "cup" },
			{ value: 4, unit: "tbsp", minus: true },
		]);
	});

	it("refuses a product that is no longer finite", () => {
		expect(() => scaleTerms([{ value: 500, unit: "g" }], 1e308)).toThrow(
			QuantityOverflowError,
		);
	});

	it("scales the total like each term (one unit)", () => {
		const terms: Term[] = [
			{ value: 1.25, unit: "g" },
			{ value: 2.5, unit: "g" },
		];
		const total = termsTotal(terms)?.qty as number;
		const scaledTotal = termsTotal(scaleTerms(terms, 2))?.qty as number;
		expect(round2(total * 2)).toBe(scaledTotal);
	});
});

describe("formatTerms", () => {
	it("writes a term with its source text first", () => {
		expect(formatTerm({ value: range(1, 2, "1-2"), unit: "cups" })).toBe(
			"1-2 cups",
		);
		expect(formatTerm({ value: 3, unit: null })).toBe("3");
	});

	it("writes terms added before terms taken away", () => {
		expect(
			formatTerms([
				{ value: 4, unit: "tbsp", minus: true },
				{ value: 1, unit: "cup" },
				{ value: 2, unit: "tbsp" },
			]),
		).toBe("1 cup + 2 tbsp − 4 tbsp");
	});

	it("takes its separators as options", () => {
		expect(
			formatTerms(
				[
					{ value: 1, unit: "cup" },
					{ value: 1, unit: "tbsp" },
				],
				{ plus: " plus " },
			),
		).toBe("1 cup plus 1 tbsp");
	});
});

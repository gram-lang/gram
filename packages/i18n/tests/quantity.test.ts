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

	it("adds a range by its bounds, and stays a range", () => {
		expect(
			termsTotal([
				{ value: range(2, 3), unit: "g" },
				{ value: 200, unit: "g" },
			]),
		).toEqual({ qty: range(202, 203), unit: "g" });
	});

	it("takes a range away bound against bound", () => {
		expect(
			termsTotal([
				{ value: 10, unit: "tbsp" },
				{ value: range(1, 2), unit: "tbsp", minus: true },
			]),
		).toEqual({ qty: range(8, 9), unit: "tbsp" });
	});

	it("never converts a sum of one unit", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "tasse" },
				{ value: 1, unit: "tasses" },
			]),
		).toEqual({ qty: 2, unit: "tasse" });
		expect(
			termsTotal([
				{ value: 1, unit: "livre" },
				{ value: 1, unit: "livre" },
			]),
		).toEqual({ qty: 2, unit: "livre" });
	});

	it("adds one ladder exactly, in the smallest unit written", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: 1, unit: "tbsp" },
			]),
		).toEqual({ qty: 17, unit: "tbsp" });
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: 2, unit: "tbsp", minus: true },
			]),
		).toEqual({ qty: 14, unit: "tbsp" });
		expect(
			termsTotal([
				{ value: 1, unit: "lb" },
				{ value: 4, unit: "oz" },
			]),
		).toEqual({ qty: 20, unit: "oz" });
		expect(
			termsTotal([
				{ value: 1, unit: "kg" },
				{ value: 200, unit: "g" },
			]),
		).toEqual({ qty: 1200, unit: "g" });
	});

	it("keeps the spelling the smallest unit was written in", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cups" },
				{ value: 1, unit: "càs" },
			]),
		).toEqual({ qty: 17, unit: "càs" });
	});

	it("adds fractions of a ladder without floating-point noise", () => {
		expect(
			termsTotal([
				{
					value: { type: "fraction", value: 0.5, numerator: 1, denominator: 2 },
					unit: "cup",
				},
				{ value: 0.1, unit: "tsp" },
				{ value: 0.2, unit: "tsp" },
			]),
		).toEqual({ qty: 24.3, unit: "tsp" });
	});

	it("adds a range on a ladder by its bounds", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: range(1, 2), unit: "tbsp" },
			]),
		).toEqual({ qty: range(17, 18), unit: "tbsp" });
	});

	it("adds across systems of one family in grams or milliliters", () => {
		expect(
			termsTotal([
				{ value: 1, unit: "cup" },
				{ value: 10, unit: "ml" },
			]),
		).toEqual({ qty: 246.59, unit: "ml" });
		expect(
			termsTotal([
				{ value: 1, unit: "oz" },
				{ value: 10, unit: "g" },
			]),
		).toEqual({ qty: 38.35, unit: "g" });
		expect(
			termsTotal([
				{ value: 1, unit: "tsp" },
				{ value: 1, unit: "pinch" },
			]),
		).toEqual({ qty: 5.24, unit: "ml" });
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
		expect(
			termsTotal([
				{ value: 1, unit: "gousse" },
				{ value: 1, unit: "pièce" },
			]),
		).toBeNull();
		expect(
			termsTotal([
				{ value: 1, unit: null },
				{ value: 1, unit: "cup" },
			]),
		).toBeNull();
	});
});

describe("mergeTerms", () => {
	it("adds up each unit, terms added before terms taken away", () => {
		const terms: Term[] = [
			{ value: 2, unit: "tbsp" },
			{ value: 1, unit: "cup" },
			{ value: 4, unit: "tbsp", minus: true },
		];
		expect(mergeTerms(terms, "unit")).toEqual([
			{ value: 1, unit: "cup" },
			{ value: 2, unit: "tbsp", minus: true },
		]);
	});

	it("adds up the spellings of one unit, never two units of one ladder", () => {
		const terms: Term[] = [
			{ value: 100, unit: "g" },
			{ value: 2, unit: "kg" },
			{ value: 100, unit: "grams" },
		];
		expect(mergeTerms(terms, "unit")).toEqual([
			{ value: 200, unit: "g" },
			{ value: 2, unit: "kg" },
		]);
	});

	it("leaves out a unit that adds up to nothing", () => {
		const terms: Term[] = [
			{ value: 2, unit: "tbsp" },
			{ value: 1, unit: "cup" },
			{ value: 2, unit: "tbsp", minus: true },
		];
		expect(mergeTerms(terms, "unit")).toEqual([{ value: 1, unit: "cup" }]);
	});

	it("keeps the singular and plural of a unit it does not know apart", () => {
		// Decided for 1.5: an unknown unit is only lowercased, so `gousse`
		// and `gousses` are two units, in a section as in the shopping list.
		const terms: Term[] = [
			{ value: 1, unit: "gousse" },
			{ value: 2, unit: "gousses" },
			{ value: 1, unit: "Gousse" },
		];
		for (const mode of ["unit", "ladder"] as const) {
			expect(mergeTerms(terms, mode)).toEqual([
				{ value: 2, unit: "gousse" },
				{ value: 2, unit: "gousses" },
			]);
		}
	});

	it("adds each ladder into one term, in the smallest unit written", () => {
		const terms: Term[] = [
			{ value: 2, unit: "tbsp" },
			{ value: 1, unit: "cup" },
			{ value: 4, unit: "tbsp", minus: true },
		];
		expect(mergeTerms(terms, "ladder")).toEqual([{ value: 14, unit: "tbsp" }]);
	});

	it("keeps systems, families and units off a ladder apart", () => {
		const terms: Term[] = [
			{ value: 1, unit: "cup" },
			{ value: 100, unit: "ml" },
			{ value: 2, unit: "gousses" },
			{ value: 1, unit: "tbsp" },
			{ value: 50, unit: "g" },
			{ value: 1, unit: "gousses" },
			{ value: 1, unit: "kg" },
		];
		expect(mergeTerms(terms, "ladder")).toEqual([
			{ value: 17, unit: "tbsp" },
			{ value: 100, unit: "ml" },
			{ value: 3, unit: "gousses" },
			{ value: 1050, unit: "g" },
		]);
	});

	it("leaves a lone term as written", () => {
		const fraction = {
			type: "fraction" as const,
			value: 0.5,
			numerator: 1,
			denominator: 2,
			text: "1/2",
		};
		expect(
			mergeTerms(
				[
					{ value: fraction, unit: "cup" },
					{ value: 20, unit: "g" },
				],
				"ladder",
			),
		).toEqual([
			{ value: fraction, unit: "cup" },
			{ value: 20, unit: "g" },
		]);
	});

	it("adds ranges by their bounds", () => {
		expect(
			mergeTerms(
				[
					{ value: range(2, 3), unit: "g" },
					{ value: 200, unit: "g" },
				],
				"ladder",
			),
		).toEqual([{ value: range(202, 203), unit: "g" }]);
	});

	it("turns a negative total into a term taken away, after the others", () => {
		expect(
			mergeTerms(
				[
					{ value: 4, unit: "tbsp", minus: true },
					{ value: 1, unit: "tsp" },
					{ value: 1, unit: "cup" },
					{ value: 1, unit: "l" },
					{ value: 100, unit: "cl", minus: true },
					{ value: 50, unit: "ml", minus: true },
				],
				"ladder",
			),
		).toEqual([
			{ value: 37, unit: "tsp" },
			{ value: 50, unit: "ml", minus: true },
		]);
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

describe("formatTerms, computed", () => {
	const computed = (
		terms: Term[],
		options: Parameters<typeof formatTerms>[1] = {},
	) => formatTerms(terms, { mode: "computed", ...options });
	const t = (value: Term["value"], unit: string | null, minus?: true): Term =>
		minus ? { value, unit, minus } : { value, unit };

	it("recomposes a scaled sum term by term, never into a fraction no spoon measures", () => {
		const doubled = scaleTerms([t(1, "cup"), t(1, "tbsp")], 2);
		expect(computed(doubled)).toBe("2 cup + 2 tbsp");
	});

	it("writes one amount of the largest unit written when that unit measures it", () => {
		expect(computed([t(2, "cup"), t(4, "tbsp", true)])).toBe("1 3/4 cup");
		expect(computed([t(1, "cup"), t(20, "tbsp")])).toBe("2 1/4 cup");
		expect(computed([t(1, "lb"), t(4, "oz")])).toBe("1 1/4 lb");
	});

	it("keeps terms that are measurable as they are", () => {
		expect(computed([t(1, "cup"), t(2, "tbsp", true)])).toBe("1 cup − 2 tbsp");
		expect(computed([t(0.5, "cup"), t(2, "tbsp", true)])).toBe(
			"1/2 cup − 2 tbsp",
		);
	});

	it("breaks an amount down, three terms at most, the last rounded to what its unit measures", () => {
		expect(computed(scaleTerms([t(1, "cup")], 1.1))).toBe(
			"1 cup + 1 tbsp + 1 3/4 tsp",
		);
	});

	it("rounds the last term to several spoons, never down to one (3/4 tsp stays 3/4 tsp)", () => {
		expect(computed(scaleTerms([t(0.5, "tsp")], 1.5), { rounding: true })).toBe(
			"3/4 tsp",
		);
		expect(computed([t(1.75, "tsp")], { rounding: true })).toBe("1 3/4 tsp");
		expect(computed([t(0.7, "tsp")], { rounding: true })).toBe("3/4 tsp");
	});

	it("never climbs above the largest unit written in a step", () => {
		expect(computed([t(34, "tbsp")])).toBe("34 tbsp");
	});

	it("climbs to a much larger unit for what is bought, never to a near one", () => {
		expect(computed([t(34, "tbsp")], { buying: true })).toBe("2 cup + 2 tbsp");
		expect(computed([t(12, "tbsp")], { buying: true })).toBe("3/4 cup");
		expect(computed([t(3, "tsp")], { buying: true })).toBe("3 tsp");
		expect(computed([t(20, "oz")], { buying: true })).toBe("1 1/4 lb");
	});

	it("leaves an amount that does not recompose exactly as it is without rounding", () => {
		expect(computed([t(1.6, "cup")], { buying: true, rounding: false })).toBe(
			"1.6 cup",
		);
	});

	it("shares the part common to both bounds of a range", () => {
		const doubled = scaleTerms([t(1, "cup"), t(range(1, 2), "tbsp")], 2);
		expect(computed(doubled)).toBe("2 cup + 2-4 tbsp");
		expect(computed([t(range(34, 36), "tbsp")], { buying: true })).toBe(
			"2 cup + 2-4 tbsp",
		);
	});

	it("keeps a metric amount in the largest unit written, in the larger unit to buy", () => {
		const doubled = scaleTerms([t(1, "kg"), t(200, "g")], 2);
		expect(computed(doubled)).toBe("2.4 kg");
		expect(computed([t(800, "g"), t(200, "g")])).toBe("1000 g");
		expect(computed([t(1500, "g")], { buying: true })).toBe("1.5 kg");
		expect(computed([t(2250, "ml")], { buying: true })).toBe("2.25 l");
	});

	it("keeps two systems and two families apart, term by term", () => {
		expect(computed([t(1, "cup"), t(50, "ml")])).toBe("1 cup + 50 ml");
		expect(computed(scaleTerms([t(1, "cup"), t(20, "g")], 2))).toBe(
			"2 cup + 40 g",
		);
		expect(computed([t(1, "tsp"), t(1, "pinch")])).toBe("1 tsp + 1 pinch");
	});

	it("keeps the spelling written, and writes a unit Gram brings in the reader's way", () => {
		expect(computed([t(1, "cups"), t(1, "cups")])).toBe("2 cups");
		expect(computed(scaleTerms([t(1, "càs")], 0.4), { lang: "fr" })).toBe(
			"1 1/4 càc",
		);
		expect(computed([t(1.5, "kg")], { lang: "fr" })).toBe("1,5 kg");
	});

	it("writes terms added before terms taken away", () => {
		expect(computed([t(30, "g"), t(1, "cup"), t(2, "tbsp", true)])).toBe(
			"30 g + 1 cup − 2 tbsp",
		);
	});

	it("goes through the caller's number writer", () => {
		expect(
			computed(scaleTerms([t(1, "cup"), t(1, "tbsp")], 1.5), {
				number: (n) => `<${n}>`,
			}),
		).toBe("<1.5> cup + <1.5> tbsp");
	});
});

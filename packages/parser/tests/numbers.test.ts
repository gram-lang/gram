import { describe, it, expect } from "bun:test";
import {
	parseNumber,
	unicodeFractionValue,
	makeMixedFraction,
	makeRange,
	UNICODE_FRACTIONS,
} from "../src/numbers";

// Unit tests for the number/fraction layer in isolation (audit 2026-07-22,
// parser finding P3) — no getAST()/grammar involved, exactly the
// testability this extraction was meant to unlock.

describe("parseNumber", () => {
	it("parses a plain integer", () => {
		expect(parseNumber("500")).toEqual({
			type: "single",
			value: 500,
			text: "500",
		});
	});

	it("parses a decimal", () => {
		expect(parseNumber("1.5")).toEqual({
			type: "single",
			value: 1.5,
			text: "1.5",
		});
	});

	it("parses a simple fraction", () => {
		expect(parseNumber("1/2")).toEqual({
			type: "fraction",
			value: 0.5,
			numerator: 1,
			denominator: 2,
			text: "1/2",
		});
	});

	it("returns null for an empty string", () => {
		expect(parseNumber("")).toBeNull();
	});

	// Regression tests for the audit (2026-07-22, finding B3): parseNumber
	// used `parseInt` on the numerator, silently truncating any decimal —
	// "1.5/2" became 1/2 (0.5) instead of 0.75, with no warning and nothing
	// but the (unused-by-callers) `text` field hinting anything was lost.
	describe("finding B3: decimal numerator", () => {
		it("does not truncate a decimal numerator", () => {
			const result = parseNumber("1.5/2");
			expect(result?.value).toBe(0.75);
			expect(result).toMatchObject({
				type: "fraction",
				numerator: 1.5,
				denominator: 2,
				text: "1.5/2",
			});
		});

		it("still parses a plain integer numerator correctly", () => {
			expect(parseNumber("3/4")?.value).toBe(0.75);
		});
	});

	// Regression test for the audit (2026-07-22, finding B3): a zero
	// denominator used to produce `value: Infinity`, which JSON.stringify
	// silently serializes to `null` — a value that lies about being a valid
	// number instead of clearly failing.
	describe("finding B3: zero denominator", () => {
		it("returns null instead of a fraction with value Infinity", () => {
			const result = parseNumber("1/0");
			expect(result).toBeNull();
		});

		it("returns null for 0/0 as well", () => {
			expect(parseNumber("0/0")).toBeNull();
		});
	});
});

describe("unicodeFractionValue", () => {
	it("resolves a known glyph to [numerator, denominator]", () => {
		expect(unicodeFractionValue("½")).toEqual([1, 2]);
		expect(unicodeFractionValue("¾")).toEqual([3, 4]);
	});

	it("covers every glyph declared in UNICODE_FRACTIONS", () => {
		for (const glyph of Object.keys(UNICODE_FRACTIONS)) {
			expect(() => unicodeFractionValue(glyph)).not.toThrow();
		}
	});

	it("throws on an unknown glyph", () => {
		expect(() => unicodeFractionValue("x")).toThrow();
	});
});

describe("makeMixedFraction", () => {
	it("combines a whole number with a fraction (e.g. '1 1/2' -> 1.5)", () => {
		const result = makeMixedFraction(1, 1, 2, "1 1/2");
		expect(result.value).toBe(1.5);
		expect(result.numerator).toBe(3); // 1*2 + 1
		expect(result.denominator).toBe(2);
	});

	it("degrades to a bare fraction when whole is 0 (unicodeFraction_bare)", () => {
		const result = makeMixedFraction(0, 1, 2, "½");
		expect(result.value).toBe(0.5);
		expect(result.numerator).toBe(1);
	});
});

describe("makeRange", () => {
	it("averages two endpoints and keeps the explicit bounds", () => {
		const min = parseNumber("2")!;
		const max = parseNumber("3")!;
		const result = makeRange(min, max, "2-3");
		expect(result).toEqual({
			type: "range",
			value: 2.5,
			range: { min: 2, max: 3 },
			text: "2-3",
		});
	});

	it("distinguishes two ranges with the same average", () => {
		// {2-3} and {1-4} both average to 2.5 — a diff/display that only
		// looked at .value would see them as identical.
		const a = makeRange(parseNumber("2")!, parseNumber("3")!, "2-3");
		const b = makeRange(parseNumber("1")!, parseNumber("4")!, "1-4");
		expect(a?.value).toBe(b?.value);
		expect(a?.range).not.toEqual(b?.range);
	});

	it("returns null if either endpoint is null", () => {
		expect(makeRange(null as never, parseNumber("3")!, "x")).toBeNull();
	});
});

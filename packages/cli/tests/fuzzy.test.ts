import { describe, it, expect } from "bun:test";
import { findSimilarInDb, similarity } from "../src/core/fuzzy";
import type { IngredientData } from "@gram-lang/analyzer";

// Regression test for the audit Chantier 6 performance fix: findSimilarInDb now
// pre-filters candidates by length difference before running a full Levenshtein
// comparison. The pre-filter is a mathematical lower bound (edit distance is
// never smaller than the length difference), so it must never change results —
// only skip candidates that could never have matched anyway.

function db(ids: string[]): Record<string, IngredientData> {
	return Object.fromEntries(
		ids.map((id) => [id, { name: id } as IngredientData]),
	);
}

describe("findSimilarInDb", () => {
	it("finds a near-duplicate with a small typo", () => {
		const match = findSimilarInDb("tomatoe", db(["tomato", "onion", "garlic"]));
		expect(match?.existingId).toBe("tomato");
	});

	it("finds a plural/singular near-duplicate", () => {
		const match = findSimilarInDb("carrots", db(["carrot"]));
		expect(match?.existingId).toBe("carrot");
	});

	it("returns null when nothing is close enough, even for very different lengths", () => {
		const match = findSimilarInDb(
			"a",
			db(["completely-unrelated-long-ingredient-name"]),
		);
		expect(match).toBeNull();
	});

	it('returns null for an exact match (score === 1 is excluded, not "similar")', () => {
		const match = findSimilarInDb("flour", db(["flour"]));
		expect(match).toBeNull();
	});

	it("does not skip a legitimate match just because of a length pre-filter edge case", () => {
		// "egg" (3 chars) vs "eggs" (4 chars) scores 0.75 — below the default 0.80
		// threshold, but a lower explicit threshold must still find it: the
		// length-difference pre-filter must not reject it before scoring.
		const match = findSimilarInDb("eggs", db(["egg"]), 0.7);
		expect(match?.existingId).toBe("egg");
	});
});

describe("similarity (used internally by the pre-filter bound)", () => {
	it("is symmetric", () => {
		expect(similarity("kitten", "sitting")).toBeCloseTo(
			similarity("sitting", "kitten"),
			5,
		);
	});

	it("returns 1 for identical strings", () => {
		expect(similarity("flour", "flour")).toBe(1);
	});
});

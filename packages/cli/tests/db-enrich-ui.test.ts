import { describe, it, expect } from "bun:test";
import { buildAcceptDecision, formatEntrySummary } from "../src/ui/db-enrich";
import { fmtNumber } from "../src/core/format";
import type { EnrichEntry } from "../src/types";

// `promptEntry`/`promptEnrichDecisions` need a stdin mock the repo has no
// precedent for (see `ui/db-lint.ts`, which doesn't test its own prompt flow
// either) — only the pure helpers extracted out of that flow are tested here.

describe("buildAcceptDecision", () => {
	function entry(overrides: Partial<EnrichEntry> = {}): EnrichEntry {
		return { id: "flour", name: "Flour", tagSuggestions: [], ...overrides };
	}

	it("carries the AI's physical values verbatim into a write decision", () => {
		const decision = buildAcceptDecision(
			entry({ density: 0.59, unit_weight: 5 }),
			2,
		);
		expect(decision).toEqual({
			entryIndex: 2,
			physical: { action: "write", density: 0.59, unit_weight: 5 },
			nutrition: null,
		});
	});

	it("carries the AI's nutrition values verbatim into a write decision", () => {
		const nutrition = { calories: 364, carbs: 76, protein: 10, fat: 1 };
		const decision = buildAcceptDecision(entry({ nutrition }), 0);
		expect(decision.nutrition).toEqual({ action: "write", nutrition });
		expect(decision.physical).toBeNull();
	});

	it("leaves both groups null for an entry with nothing to review (--field tags/category)", () => {
		const decision = buildAcceptDecision(
			entry({ category: "grains", tagSuggestions: ["baking"] }),
			5,
		);
		expect(decision).toEqual({
			entryIndex: 5,
			physical: null,
			nutrition: null,
		});
	});
});

describe("formatEntrySummary", () => {
	it("joins category, density, unit weight, and calories with a middle dot", () => {
		const summary = formatEntrySummary({
			id: "flour",
			name: "Flour",
			category: "grains",
			density: 0.59,
			unit_weight: 5,
			nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
			tagSuggestions: [],
		});
		expect(summary).toBe(
			`grains · density: ${fmtNumber(0.59)} g/mL · unit weight: ${fmtNumber(5)} g · ${fmtNumber(364)} kcal/100g`,
		);
	});

	it("omits absent fields instead of leaving gaps", () => {
		const summary = formatEntrySummary({
			id: "flour",
			name: "Flour",
			density: 0.59,
			tagSuggestions: [],
		});
		expect(summary).toBe(`density: ${fmtNumber(0.59)} g/mL`);
	});
});

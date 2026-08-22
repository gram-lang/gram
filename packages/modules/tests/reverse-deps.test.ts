import { describe, expect, test } from "bun:test";
import {
	buildReverseDependencyIndex,
	transitiveDependents,
} from "../src/reverse-deps";

describe("buildReverseDependencyIndex / transitiveDependents", () => {
	test("a chain A -> B -> C: changing C notifies both A and B", () => {
		const index = buildReverseDependencyIndex([
			{ from: "A", to: "B" },
			{ from: "B", to: "C" },
		]);
		expect(transitiveDependents(index, "C")).toEqual(new Set(["B", "A"]));
	});

	test("a diamond A -> B, A -> C, B -> D, C -> D: changing D notifies A, B, C once each", () => {
		const index = buildReverseDependencyIndex([
			{ from: "A", to: "B" },
			{ from: "A", to: "C" },
			{ from: "B", to: "D" },
			{ from: "C", to: "D" },
		]);
		expect(transitiveDependents(index, "D")).toEqual(new Set(["A", "B", "C"]));
	});

	test("a leaf with no importers has no dependents", () => {
		const index = buildReverseDependencyIndex([{ from: "A", to: "B" }]);
		expect(transitiveDependents(index, "B")).toEqual(new Set(["A"]));
		expect(transitiveDependents(index, "A")).toEqual(new Set());
	});

	test("an import cycle A -> B -> A terminates instead of looping forever", () => {
		const index = buildReverseDependencyIndex([
			{ from: "A", to: "B" },
			{ from: "B", to: "A" },
		]);
		expect(transitiveDependents(index, "A")).toEqual(new Set(["B"]));
	});

	test("an unknown uri has no dependents", () => {
		const index = buildReverseDependencyIndex([{ from: "A", to: "B" }]);
		expect(transitiveDependents(index, "nope")).toEqual(new Set());
	});
});

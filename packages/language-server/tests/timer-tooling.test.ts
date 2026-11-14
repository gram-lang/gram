import { describe, it, expect } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideCompletions } from "../src/features/completions";
import { provideHover } from "../src/features/hover";
import {
	SEMANTIC_TOKEN_TYPES,
	provideSemanticTokens,
} from "../src/features/semantic-tokens";
import type { IngredientDB } from "../src/ingredient-loader";

const db: IngredientDB = {};
const NBSP = " ";

/** The hover text at the first occurrence of `needle` in `text`. */
function hoverAt(text: string, needle: string, delta = 1): string | null {
	const state = parseDocument(text);
	const offset = text.indexOf(needle) + delta;
	const before = text.slice(0, offset).split("\n");
	const position = {
		line: before.length - 1,
		character: before[before.length - 1]!.length,
	};
	const hover = provideHover(state, position, db);
	if (!hover) return null;
	const contents = hover.contents as { value: string };
	return contents.value;
}

describe("unit completions in a timer", () => {
	const state = parseDocument("## Section\n\nBake.\n");

	it("offers only time units inside ~{…}", () => {
		const labels = provideCompletions(state, db, "Bake for ~{1").map(
			(c) => c.label,
		);
		expect(labels).toContain("min");
		expect(labels).toContain("h");
		expect(labels).toContain("hr");
		expect(labels).toContain("heures");
		expect(labels).not.toContain("g");
		expect(labels).not.toContain("tbsp");
	});

	it("offers time units in a passive, named timer and after a first term", () => {
		for (const prefix of ["Rest ~_{2", "Bake ~_baking{1h 3", "Boil ~eggs{3"]) {
			const labels = provideCompletions(state, db, prefix).map((c) => c.label);
			expect(labels).toContain("min");
			expect(labels).not.toContain("g");
		}
	});

	it("puts the canonical time units first", () => {
		const items = provideCompletions(state, db, "Bake for ~{1");
		const sorted = [...items].sort((a, b) =>
			(a.sortText ?? "").localeCompare(b.sortText ?? ""),
		);
		expect(
			sorted
				.slice(0, 4)
				.map((c) => c.label)
				.sort(),
		).toEqual(["d", "h", "min", "s"].sort());
	});

	it("keeps the quantity units in an ingredient", () => {
		const labels = provideCompletions(state, db, "Mix @flour{200").map(
			(c) => c.label,
		);
		expect(labels).toContain("g");
	});
});

describe("hover on a timer", () => {
	it("shows the duration as Gram displays it", () => {
		const text = "## Section\n\nBake for ~{1h30}.\n";
		expect(hoverAt(text, "~{")).toContain(`1${NBSP}h 30${NBSP}min`);
	});

	it("reads the clock, prime and range forms", () => {
		expect(hoverAt("Simmer ~{1:30 h}.\n", "~{")).toContain(
			`1${NBSP}h 30${NBSP}min`,
		);
		expect(hoverAt("Cook ~{5'30\"}.\n", "~{")).toContain(
			`5${NBSP}min 30${NBSP}s`,
		);
		expect(hoverAt("Roast ~{45 min - 1 h}.\n", "~{")).toContain(
			`45${NBSP}min${NBSP}– 1${NBSP}h`,
		);
	});

	it("speaks the recipe's language", () => {
		const text = "---\nlanguage: fr\n---\n\nReposer ~_{2 jours}.\n";
		expect(hoverAt(text, "~_{")).toContain(`2${NBSP}j`);
	});

	it("shows the timer as written, with its name", () => {
		const value = hoverAt("Bake ~_baking{1 hr 30 mins}.\n", "~_");
		expect(value).toContain("`~_baking{1 hr 30 mins}`");
	});

	it("says nothing about a duration Gram refuses (the diagnostic does)", () => {
		expect(hoverAt("Bake ~{1:30}.\n", "~{")).toBeNull();
	});
});

describe("semantic tokens of a timer", () => {
	const typeIndex = SEMANTIC_TOKEN_TYPES.indexOf("type");
	const numberIndex = SEMANTIC_TOKEN_TYPES.indexOf("number");

	/** Decoded [start, length, type] of every token on the first line. */
	function tokens(text: string): [number, number, number][] {
		const { data } = provideSemanticTokens(parseDocument(text));
		const out: [number, number, number][] = [];
		let line = 0;
		let char = 0;
		for (let i = 0; i < data.length; i += 5) {
			const dl = data[i]!;
			line += dl;
			char = dl === 0 ? char + data[i + 1]! : data[i + 1]!;
			if (line === 0) out.push([char, data[i + 2]!, data[i + 3]!]);
		}
		return out;
	}

	it("leaves the inside of the braces to the TextMate grammar", () => {
		// `1h30` is cut by the grammar as 1 + unit `h30`: a unit token over
		// `h30` would paint the minutes as a unit.
		for (const text of [
			"Bake ~{1h30}.\n",
			"Bake ~{1:30 h}.\n",
			"Bake ~{10 min}.\n",
		]) {
			const inside = tokens(text).filter(
				([, , type]) => type === typeIndex || type === numberIndex,
			);
			expect(inside).toEqual([]);
		}
	});

	it("still marks the sigil, the name and the braces", () => {
		const text = "Bake ~_baking{1h30}.\n";
		const starts = tokens(text).map(([start]) => start);
		expect(starts).toContain(text.indexOf("~"));
		expect(starts).toContain(text.indexOf("baking"));
		expect(starts).toContain(text.indexOf("{"));
		expect(starts).toContain(text.indexOf("}"));
	});
});

import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideCompletions } from "../src/features/completions";
import { provideDefinition } from "../src/features/go-to-definition";
import { provideTimerHover } from "../src/features/hover-durations";
import { provideNutritionHover } from "../src/features/hover-nutrition";
import { provideInlayHints } from "../src/features/inlay-hints";
import { provideReferences } from "../src/features/references";
import { provideRename } from "../src/features/rename";
import {
	provideSemanticTokens,
	SEMANTIC_TOKEN_TYPES,
} from "../src/features/semantic-tokens";
import { offsetToPosition } from "../src/utils/position";

// Ratios with units in the editor: what each one came to (inlay hints,
// hovers), its slash and target highlighted, its target completed, and an
// intermediate renamed inside it.
const SOURCE = `## Dough ->&dough

Mix @flour{500 g}, @eggs{1 / 100 g @&flour} and @milk{1 / 100 ml @&flour}.

## Bake

Weigh &dough{800 g}, add @salt{2 g / 100 g &dough} and bake ~{15 min / 500 g &dough}.
`;

const state = parseDocument(SOURCE);
const at = (needle: string, shift = 0) => SOURCE.indexOf(needle) + shift;
const pos = (offset: number) => offsetToPosition(state.lineStarts, offset);
// The views write a duration with a non-breaking space (`24 min`).
const plain = (value: unknown) =>
	JSON.stringify(value).replace(/\s|\u00a0|\u202f/g, " ");

describe("what each ratio came to", () => {
	it("shows a hint after each resolved ratio, and none for one waiting", () => {
		const labels = provideInlayHints(state).map((h) =>
			String(h.label).replace(/\u00a0|\u202f/g, " "),
		);
		expect(labels).toContain("= 5");
		expect(labels).toContain("= 16 g");
		expect(labels).toContain("= 24 min");
		expect(labels.filter((l) => String(l).startsWith("= "))).toHaveLength(3);
		const hint = provideInlayHints(state).find((h) => h.label === "= 5");
		expect(hint?.position).toEqual(pos(at("@&flour}") + "@&flour}".length));
	});

	it("hovers a proportional time with its duration", () => {
		const hover = provideTimerHover(state, at("~{15 min"));
		expect(plain(hover?.contents)).toContain("24 min");
	});

	it("hovers an ingredient ratio with its amount, or why it has none", () => {
		const eggs = provideNutritionHover(state, pos(at("@eggs")), {});
		expect(JSON.stringify(eggs?.contents)).toContain("= **5**");
		// The analyzer, which decides, runs with a database.
		const raw = parseDocument(
			"## S\n\nMix @x{1 g} and @y{1 / 2 slices @&x}.\n",
			{},
		);
		const y = provideNutritionHover(
			raw,
			offsetToPosition(raw.lineStarts, raw.text.indexOf("@y")),
			{},
		);
		expect(plain(y?.contents)).toContain("do not measure the same thing");
	});
});

describe("highlighting a ratio", () => {
	it("marks its slash, its target's sigil and its target", () => {
		const text = "Mix @x{1 / 100 g &dough} ~{4 min / @&x}.\n";
		const { data } = provideSemanticTokens(parseDocument(text));
		const tokens: [number, string][] = [];
		let col = 0;
		for (let i = 0; i < data.length; i += 5) {
			col =
				data[i] === 0 ? col + (data[i + 1] as number) : (data[i + 1] as number);
			tokens.push([col, SEMANTIC_TOKEN_TYPES[data[i + 3] as number] as string]);
		}
		expect(tokens).toContainEqual([text.indexOf("/"), "operator"]);
		expect(tokens).toContainEqual([text.indexOf("&dough"), "keyword"]);
		expect(tokens).toContainEqual([text.indexOf("dough"), "variable"]);
		expect(tokens).toContainEqual([text.indexOf("/ @&x"), "operator"]);
		expect(tokens).toContainEqual([text.indexOf("@&x"), "keyword"]);
		expect(tokens).toContainEqual([text.indexOf("@&x") + 2, "parameter"]);
	});
});

describe("completing a ratio", () => {
	it("offers the ingredients after `@&`, the intermediates after `&`", () => {
		const labels = (prefix: string) =>
			provideCompletions(state, {}, prefix).map((c) => c.label);
		expect(labels("Add @x{1 / 100 g @&")).toEqual(
			expect.arrayContaining(["flour", "eggs"]),
		);
		expect(labels("Add @x{2 g / 100 g &")).toEqual(["dough"]);
		expect(labels("Add @x{70% &")).toEqual(["dough"]);
	});

	it("offers units of weight after the slash of a proportional time", () => {
		const labels = provideCompletions(state, {}, "Bake ~{15 min / 500 ").map(
			(c) => c.label,
		);
		expect(labels).toContain("g");
		expect(labels).not.toContain("min");
		expect(
			provideCompletions(state, {}, "Bake ~{15 ").map((c) => c.label),
		).toContain("min");
	});
});

describe("an intermediate named inside a ratio", () => {
	it("is renamed with its declaration and references", () => {
		const edit = provideRename(state, pos(at("&dough}") + 2), "pastry", "u");
		const edits = edit?.changes?.u ?? [];
		// The declaration, the reference, and the two ratio targets.
		expect(edits).toHaveLength(4);
	});

	it("is found by its references, and leads to its declaration", () => {
		expect(provideReferences(state, pos(at("&dough}") + 2))).toHaveLength(4);
		expect(
			provideDefinition(state, "u", pos(at("&dough}") + 2))?.range,
		).toEqual({
			start: pos(at("->&dough")),
			end: pos(at("->&dough") + "->&dough".length),
		});
	});
});

import { describe, it, expect } from "bun:test";
import { pathToFileURL } from "node:url";
import { parseDocument } from "../src/document-state";
import { type CompletionItem, InsertTextFormat } from "vscode-languageserver";
import { provideCompletions } from "../src/features/completions";
import { nameInsertion } from "../src/features/completions-ingredients";
import type { IngredientDB } from "../src/ingredient-loader";

const db: IngredientDB = { flour: { name: "Flour" } };

describe("provideCompletions — Phase 1.2 debounce fix", () => {
	it("offers ingredient completions right after @, even when the debounced state text does not contain it yet", () => {
		// Simulates the exact race this bug came from: the user just typed
		// "@" but the 150ms parse debounce in server.ts hasn't re-parsed yet,
		// so `state` still reflects the text from just before the keystroke.
		// Only the `prefix` argument — sourced from the live document in
		// server.ts — carries the just-typed "@".
		const state = parseDocument("## Section\nMix \n");
		const freshPrefix = "Mix @";

		const completions = provideCompletions(state, db, freshPrefix);

		expect(completions.length).toBeGreaterThan(0);
	});

	it("returns no completions when the fresh prefix is not after any trigger character", () => {
		const state = parseDocument("## Section\nMix flour.\n");
		const completions = provideCompletions(state, db, "Mix flour");
		expect(completions).toEqual([]);
	});

	it("returns nothing while the document has a syntax error (no AST yet)", () => {
		// A space before the composite `<` sigil is a known hard parse error
		// (see parser/tests/grammar-edge-cases.test.ts).
		const state = parseDocument("## Section\n@ <@parent\n");
		expect(state.ast).toBeNull();
		const completions = provideCompletions(state, db, "@");
		expect(completions).toEqual([]);
	});

	it('offers path completions (not ingredient completions) inside @use "..." (module-imports RFC §F.1)', () => {
		// The "@" in "@use" would also satisfy isAfterAt's own check — the
		// @use branch must be checked first, or this would wrongly offer
		// ingredient names instead of files.
		const state = parseDocument('@use "./b\n');
		const uri = pathToFileURL("/does/not/exist/tarte.gram").toString();
		const completions = provideCompletions(state, db, '@use "./b', uri);
		// No real project here, so listGramEntries finds nothing — the point
		// is that it didn't fall through to ingredient completions instead.
		expect(completions).toEqual([]);
		expect(completions).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ label: "Flour" })]),
		);
	});
});

describe("completing a multi-word name", () => {
	const words: IngredientDB = {
		flour: { name: "Wheat flour" },
		salt: { name: "Salt" },
	};
	const recipe = parseDocument(
		"## Dough ->&pizza dough{}\n\nMix @flour{200 g}.\n\n## Bake\n\nBake.\n",
	);
	const item = (items: CompletionItem[], label: string) =>
		items.find((i) => i.label === label);

	it("puts the cursor between the braces for a client that expands snippets", () => {
		const items = provideCompletions(recipe, words, "Add @", "", true);
		expect(item(items, "Wheat flour")).toMatchObject({
			insertText: "Wheat flour{$0}",
			insertTextFormat: InsertTextFormat.Snippet,
		});
		const ref = provideCompletions(recipe, words, "Bake the &", "", true);
		expect(item(ref, "pizza dough")).toMatchObject({
			insertText: "pizza dough{$0}",
			insertTextFormat: InsertTextFormat.Snippet,
		});
	});

	it("gives the braces as plain text to any other client", () => {
		for (const snippets of [false, undefined]) {
			const items = provideCompletions(recipe, words, "Add @", "", snippets);
			const flour = item(items, "Wheat flour");
			expect(flour?.insertText).toBe("Wheat flour{}");
			expect(flour?.insertTextFormat).toBeUndefined();
		}
	});

	it("leaves a single-word name and a target inside braces bare", () => {
		const items = provideCompletions(recipe, words, "Add @", "", true);
		expect(item(items, "Salt")).toEqual(
			expect.objectContaining({ insertText: "Salt" }),
		);
		expect(item(items, "Salt")?.insertTextFormat).toBeUndefined();
		const target = provideCompletions(
			recipe,
			words,
			"Add @salt{1 / 100 g &",
			"",
			true,
		);
		expect(item(target, "pizza dough")).toEqual(
			expect.objectContaining({ insertText: "pizza dough" }),
		);
		expect(item(target, "pizza dough")?.insertTextFormat).toBeUndefined();
	});

	it("escapes what a snippet would read as syntax", () => {
		expect(nameInsertion("pâte $1 {x} \\ y", true).insertText).toBe(
			"pâte \\$1 {x\\} \\\\ y{$0}",
		);
	});
});

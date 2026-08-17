import { describe, it, expect } from "bun:test";
import { pathToFileURL } from "node:url";
import { parseDocument } from "../src/document-state";
import { provideCompletions } from "../src/features/completions";
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

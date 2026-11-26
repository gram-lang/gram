import { describe, expect, it } from "bun:test";
import { DocumentHighlightKind } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideDocumentHighlights } from "../src/features/document-highlight";
import { offsetToPosition } from "../src/utils/position";

/** The highlights with the cursor on the last character of the `nth` occurrence of `at`, as `[text, kind]`. */
function highlights(text: string, at: string, nth = 0) {
	const state = parseDocument(text);
	let offset = -1;
	for (let i = 0; i <= nth; i++) offset = text.indexOf(at, offset + 1);
	expect(offset).toBeGreaterThanOrEqual(0);
	const result = provideDocumentHighlights(
		state,
		offsetToPosition(state.lineStarts, offset + at.length - 1),
	);
	return result.map(({ range, kind }) => {
		const start = state.lineStarts[range.start.line]! + range.start.character;
		const end = state.lineStarts[range.end.line]! + range.end.character;
		return [text.slice(start, end), kind];
	});
}

const { Text, Read, Write } = DocumentHighlightKind;

describe("provideDocumentHighlights", () => {
	it("groups an ingredient's mentions by id, alternatives and targets included", () => {
		const text = `## Dough

Mix @Flour{500g} with @salt{2% @&flour}.

Dust with @flour{10g}|@semolina{10g}, then @water{70% @&flour}.
`;
		expect(highlights(text, "Flour")).toEqual([
			["Flour", Text],
			["flour", Text],
			["flour", Read],
			["flour", Read],
		]);
		// On a target: the target's ingredient, not the mention holding it.
		expect(highlights(text, "@&flour")).toHaveLength(4);
		expect(highlights(text, "salt")).toEqual([["salt", Text]]);
	});

	it("counts the parent of a composite as a mention", () => {
		const text = `## Garnish

Grate @lemon zest{1}<@lemon{1}, then squeeze @lemon{1}.
`;
		expect(highlights(text, "@lemon{")).toEqual([
			["lemon", Text],
			["lemon", Text],
		]);
	});

	it("groups an intermediate's declarations and uses", () => {
		const text = `## Dough ->&dough

Knead @flour{500g}.

## Bake

Shape the &dough{} with @salt{2% &dough}, then rest ->&shaped.

Bake the &shaped.
`;
		const expected = [
			["dough", Write],
			["dough", Read],
			["dough", Read],
		];
		expect(highlights(text, "dough")).toEqual(expected);
		expect(highlights(text, "&dough{")).toEqual(expected);
		expect(highlights(text, "% &dough")).toEqual(expected);
		expect(highlights(text, "shaped")).toEqual([
			["shaped", Write],
			["shaped", Read],
		]);
	});

	it("finds the name of a section declaration after a title that contains it", () => {
		const text = "## dough ->&dough\n\nKnead.\n\n## Bake\n\nBake the &dough.\n";
		const state = parseDocument(text);
		const result = provideDocumentHighlights(state, { line: 6, character: 11 });
		expect(result[0]?.range.start).toEqual({ line: 0, character: 12 });
	});

	it("treats an @use binding as a declaration", () => {
		const text = `@use "./pate.gram" as { &pate, &creme fouettee{} as &creme }

## Tarte

Line the mould with &pate, top with &creme.
`;
		expect(highlights(text, "&pate", 1)).toEqual([
			["pate", Write],
			["pate", Read],
		]);
		expect(highlights(text, "&creme", 1)).toEqual([
			["creme", Write],
			["creme", Read],
		]);
	});

	it("highlights nothing off a name, or when the document does not parse", () => {
		const text = "## Dough\n\nMix @flour{500g} well.\n";
		expect(highlights(text, "well")).toEqual([]);
		expect(highlights("## A\n@ <@parent\n", "parent")).toEqual([]);
	});
});

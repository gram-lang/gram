import { describe, expect, it } from "bun:test";
import { DiagnosticSeverity } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideCodeActions } from "../src/features/code-actions";
import { provideDiagnostics } from "../src/features/diagnostics";

// The diagnostics and Quick Fixes come from `@gram-lang/modules/lint`, the
// list `gram check` reads too: what the server adds is only the translation
// to LSP.

const URI = "file:///recipe.gram";
const DOCS = "https://gram-lang.org/docs/reference/api/warnings/";

describe("diagnostics from the lint layer", () => {
	it("links every diagnostic to its code's section of the warnings page", () => {
		const state = parseDocument("## A\n\nBoil ~pasta{15%min}. ->&pasta\n");
		const diags = provideDiagnostics(state, URI);
		expect(diags.length).toBeGreaterThan(0);
		for (const d of diags) {
			expect(d.codeDescription?.href).toBe(
				`${DOCS}#${String(d.code).toLowerCase()}`,
			);
		}
	});

	it("gives a parse error the PARSE_ERROR code", () => {
		const state = parseDocument('## A\n\nMix.\n\n@use "./b.gram" as &b\n');
		const [d] = provideDiagnostics(state, URI);
		expect(d!.code).toBe("PARSE_ERROR");
		expect(d!.severity).toBe(DiagnosticSeverity.Error);
	});

	it("follows the project's lint settings", () => {
		const state = parseDocument("## A\n\nMix @a{1}. ->&mix\n");
		const diags = provideDiagnostics(
			state,
			URI,
			{},
			{
				rules: { MISSING_TITLE: "off", UNUSED_INTERMEDIATE: "hint" },
			},
		);
		expect(diags.map((d) => d.code)).toEqual(["UNUSED_INTERMEDIATE"]);
		expect(diags[0]!.severity).toBe(DiagnosticSeverity.Hint);
	});
});

describe("Quick Fixes from the lint layer", () => {
	it("offers the fix of a diagnostic found again on the fresh state", () => {
		const state = parseDocument(
			"---\ntitle: T\n---\n\n## A\n\nMix @a{1}. ->&mix\n",
		);
		const [diag] = provideDiagnostics(state, URI);
		const [action] = provideCodeActions(state, diag!.range, [diag!], URI, {});
		expect(action!.title).toBe("Remove unused '->&mix'");
		expect(action!.edit!.changes![URI]![0]!.newText).toBe("");
	});

	it("offers nothing for a diagnostic the document no longer has there", () => {
		const before = parseDocument(
			"---\ntitle: T\n---\n\n## A\n\nMix @a{1}. ->&mix\n",
		);
		const [diag] = provideDiagnostics(before, URI);
		// The client still holds the old diagnostic; the text moved since.
		const after = parseDocument(
			"---\ntitle: T\n---\n\n## A\n\nFirst, mix @a{1}. ->&mix\n",
		);
		expect(provideCodeActions(after, diag!.range, [diag!], URI, {})).toEqual(
			[],
		);
	});
});

describe("the writing rules in the editor", () => {
	it("shows a merged line as information, with the blank line as the preferred Quick Fix", () => {
		const state = parseDocument(
			"---\ntitle: T\n---\n\nMix @a{1}.\n[Bake] it.\n",
		);
		const diag = provideDiagnostics(state, URI).find(
			(d) => d.code === "MERGED_STEP_LINE",
		)!;
		expect(diag.severity).toBe(DiagnosticSeverity.Information);
		expect(diag.range.start).toEqual({ line: 5, character: 0 });
		const [action] = provideCodeActions(state, diag.range, [diag], URI, {});
		expect(action!.isPreferred).toBe(true);
		expect(action!.edit!.changes![URI]).toEqual([
			{
				range: {
					start: { line: 5, character: 0 },
					end: { line: 5, character: 0 },
				},
				newText: "\n",
			},
		]);
	});

	it("shows an ingredient lost behind '//' as a warning, on its token", () => {
		const state = parseDocument(
			"---\ntitle: T\n---\n\nMix @flour{1} // or more, @sugar{2}\n",
		);
		const diag = provideDiagnostics(state, URI).find(
			(d) => d.code === "LOST_INGREDIENT",
		)!;
		expect(diag.severity).toBe(DiagnosticSeverity.Warning);
		expect(diag.range).toEqual({
			start: { line: 4, character: 26 },
			end: { line: 4, character: 35 },
		});
	});
});

describe("the Quick Fix that adds an ingredient to the database", () => {
	const DB_URI = "file:///project/.gram/ingredients.yaml";
	const DB_TEXT = "flour:\n  name: Flour\n";
	const db = { flour: { name: "Flour" } };
	const state = parseDocument("---\ntitle: T\n---\n\nAdd @salt{1 g}.\n");

	function addAction(context: Parameters<typeof provideCodeActions>[6]) {
		const diag = provideDiagnostics(state, URI, db).find(
			(d) => d.code === "UNKNOWN_INGREDIENT",
		)!;
		return provideCodeActions(
			state,
			diag.range,
			[diag],
			URI,
			db,
			undefined,
			context,
		).find((a) => a.title === "Add 'salt' to ingredients.yaml");
	}

	it("edits the database file, at its end, as changes for a client without documentChanges", () => {
		const action = addAction({
			ingredientsFile: { uri: DB_URI, text: DB_TEXT },
		})!;
		expect(action.isPreferred).toBeUndefined();
		const [edit] = action.edit!.changes![DB_URI]!;
		expect(edit!.range).toEqual({
			start: { line: 2, character: 0 },
			end: { line: 2, character: 0 },
		});
		expect(edit!.newText).toStartWith('\nsalt:\n  name: "salt"\n');
		expect(action.edit!.changes![URI]).toBeUndefined();
	});

	it("writes documentChanges for a client that applies them", () => {
		const action = addAction({
			documentChanges: true,
			ingredientsFile: { uri: DB_URI, text: DB_TEXT },
		})!;
		expect(action.edit!.changes).toBeUndefined();
		const [change] = action.edit!.documentChanges!;
		expect(change).toMatchObject({
			textDocument: { uri: DB_URI, version: null },
		});
		expect(
			(change as { edits: { newText: string }[] }).edits[0]!.newText,
		).toContain("salt:");
	});

	it("is not offered without the database file", () => {
		expect(addAction({})).toBeUndefined();
	});
});

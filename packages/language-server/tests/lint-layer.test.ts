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

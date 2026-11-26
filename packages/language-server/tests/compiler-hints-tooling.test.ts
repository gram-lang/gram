import { describe, expect, it } from "bun:test";
import type { CodeAction, TextEdit } from "vscode-languageserver";
import { DiagnosticSeverity } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideCodeActions } from "../src/features/code-actions";
import { provideDiagnostics } from "../src/features/diagnostics";
import { positionToOffset } from "../src/utils/position";

const URI = "file:///recipe.gram";
const recipe = (...steps: string[]) => `## Section\n\n${steps.join("\n\n")}\n`;

const diagsOf = (text: string, code: string) =>
	provideDiagnostics(parseDocument(text), URI).filter((d) => d.code === code);

/** The diagnostic and the text once its preferred Quick Fix is applied. */
function fix(text: string, code: string) {
	const state = parseDocument(text);
	const diags = provideDiagnostics(state, URI).filter((d) => d.code === code);
	expect(diags).toHaveLength(1);
	const actions = provideCodeActions(state, diags[0]!.range, diags, URI, {});
	const action = actions.find(
		(a: CodeAction) => a.kind === "quickfix" && a.isPreferred,
	);
	expect(action).toBeDefined();
	const [edit] = action!.edit!.changes![URI] as TextEdit[];
	const start = positionToOffset(state.lineStarts, edit!.range.start);
	const end = positionToOffset(state.lineStarts, edit!.range.end);
	return {
		diag: diags[0]!,
		title: action!.title,
		text: text.slice(0, start) + edit!.newText + text.slice(end),
	};
}

describe("REFERENCE_TO_INGREDIENT Quick Fix", () => {
	it("writes '@&' before the name", () => {
		const { diag, title, text } = fix(
			recipe("Mix @flour{500g}.", "Dust with &flour."),
			"REFERENCE_TO_INGREDIENT",
		);
		expect(diag.severity).toBe(DiagnosticSeverity.Warning);
		expect(title).toBe("Write @&flour (a raw ingredient)");
		expect(text).toBe(recipe("Mix @flour{500g}.", "Dust with @&flour."));
		expect(diagsOf(text, "REFERENCE_TO_INGREDIENT")).toEqual([]);
	});

	it("keeps a quantity and a multi-word name", () => {
		const { text } = fix(
			recipe(
				"Mélanger le @sucre glace{50g}.",
				"Saupoudrer de &sucre glace{10g}.",
			),
			"REFERENCE_TO_INGREDIENT",
		);
		expect(text).toBe(
			recipe(
				"Mélanger le @sucre glace{50g}.",
				"Saupoudrer de @&sucre glace{10g}.",
			),
		);
		expect(diagsOf(text, "REFERENCE_TO_INGREDIENT")).toEqual([]);
	});
});

describe("INVALID_DURATION Quick Fix (Cooklang's '%')", () => {
	it("writes the duration with a space", () => {
		const { title, text } = fix(
			recipe("Cook ~pasta{15%min}."),
			"INVALID_DURATION",
		);
		expect(title).toBe("Replace with {15 min}");
		expect(text).toBe(recipe("Cook ~pasta{15 min}."));
		expect(diagsOf(text, "INVALID_DURATION")).toEqual([]);
	});

	it("offers none for another refused duration", () => {
		const text = recipe("Cook ~{1:30}.");
		const state = parseDocument(text);
		const diags = diagsOf(text, "INVALID_DURATION");
		expect(diags).toHaveLength(1);
		expect(
			provideCodeActions(state, diags[0]!.range, diags, URI, {}).filter(
				(a) => a.isPreferred,
			),
		).toEqual([]);
	});
});

describe("INVALID_UNIT Quick Fix (Cooklang's '%')", () => {
	it("writes the unit after a space", () => {
		const { title, text } = fix(recipe("Mix @flour{200%g}."), "INVALID_UNIT");
		expect(title).toBe("Write the unit after a space: g");
		expect(text).toBe(recipe("Mix @flour{200 g}."));
		expect(diagsOf(text, "INVALID_UNIT")).toEqual([]);
	});

	it("handles spaces around '%' and a fraction", () => {
		expect(fix(recipe("Add @milk{1/2 % cup}."), "INVALID_UNIT").text).toBe(
			recipe("Add @milk{1/2 cup}."),
		);
	});
});

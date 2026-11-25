import { describe, expect, it } from "bun:test";
import type { CodeAction, TextEdit } from "vscode-languageserver";
import { DiagnosticSeverity } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideCodeActions } from "../src/features/code-actions";
import { provideDiagnostics } from "../src/features/diagnostics";
import { positionToOffset } from "../src/utils/position";

const URI = "file:///recipe.gram";
const recipe = (step: string) => `## Section\n\n${step}\n`;

/** The diagnostic and the text once its preferred Quick Fix is applied. */
function fix(text: string) {
	const state = parseDocument(text);
	const diags = provideDiagnostics(state, URI).filter(
		(d) => d.code === "SPACED_COMPOSITE",
	);
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

describe("SPACED_COMPOSITE Quick Fix", () => {
	it("glues '<' to both ingredients", () => {
		const { diag, title, text } = fix(
			recipe("Zest @lemon zest{1} < @lemon{2} finely."),
		);
		expect(diag.severity).toBe(DiagnosticSeverity.Warning);
		expect(title).toBe("Write <@lemon with no spaces");
		expect(text).toBe(recipe("Zest @lemon zest{1}<@lemon{2} finely."));
	});

	it("handles a space on one side and tabs", () => {
		expect(fix(recipe("Add @yolks{3} <@eggs{3}.")).text).toBe(
			recipe("Add @yolks{3}<@eggs{3}."),
		);
		expect(fix(recipe("Add @yolks{3}<\t@eggs{3}.")).text).toBe(
			recipe("Add @yolks{3}<@eggs{3}."),
		);
	});

	it("leaves a recipe that compiles without the warning once applied", () => {
		const { text } = fix(recipe("Zest @lemon zest{1} < @lemon{2}."));
		expect(
			provideDiagnostics(parseDocument(text), URI).some(
				(d) => d.code === "SPACED_COMPOSITE",
			),
		).toBe(false);
	});
});

import { type CodeLens, Command, Range, Position } from "vscode-languageserver";
import type { DocumentState } from "../document-state";

export function provideCodeLenses(_state: DocumentState): CodeLens[] {
	const lenses: CodeLens[] = [];

	const topRange = Range.create(Position.create(0, 0), Position.create(0, 0));

	lenses.push({
		range: topRange,
		command: Command.create("▶ Aperçu", "gram.showPreview"),
	});

	lenses.push({
		range: topRange,
		command: Command.create("📊 Macros", "gram.showNutrition"),
	});

	return lenses;
}

import { getDictionary } from "@gram-lang/i18n";
import { type CodeLens, Command, Position, Range } from "vscode-languageserver";
import type { DocumentState } from "../document-state";

/** `locale` is the editor's language: the lens is a command of the editor, not recipe text. */
export function provideCodeLenses(
	_state: DocumentState,
	locale?: string,
): CodeLens[] {
	const t = getDictionary(locale).languageServer;
	const topRange = Range.create(Position.create(0, 0), Position.create(0, 0));
	return [
		{
			range: topRange,
			command: Command.create(`▶ ${t.showPreview}`, "gram.showPreview"),
		},
	];
}

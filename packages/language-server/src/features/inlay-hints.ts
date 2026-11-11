import { type InlayHint, InlayHintKind, Position } from "vscode-languageserver";
import {
	type MiseEnPlaceMode,
	type RestChoice,
	scheduleTimes,
} from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";
import { formatDuration } from "@gram-lang/renderer";
import type { DocumentState } from "../document-state";

export function provideInlayHints(
	state: DocumentState,
	schedule?: MiseEnPlaceMode,
	rests?: RestChoice,
): InlayHint[] {
	const hints: InlayHint[] = [];
	if (!state.ast || !state.compilation?.metrics) return hints;

	// The total follows the chosen timeline (`gram.miseEnPlace`, `gram.rests`).
	const { totalTime } = scheduleTimes(state.compilation, schedule, rests);

	let titleLine = 0;
	let titleChar = 0;
	const lines = state.text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		if (lines[i]!.toLowerCase().startsWith("title:")) {
			titleLine = i;
			titleChar = lines[i]!.length;
			break;
		}
	}

	if (totalTime > 0) {
		// The words and the duration of the views, in the recipe's language.
		const meta = state.compilation.meta?.language;
		const lang = typeof meta === "string" ? meta : undefined;
		const t = getDictionary(lang).renderer;
		hints.push({
			position: Position.create(titleLine, titleChar),
			label: `  ${t.totalTime}${t.colon}${formatDuration(totalTime, lang)}`,
			kind: InlayHintKind.Type,
			paddingLeft: true,
		});
	}

	return hints;
}

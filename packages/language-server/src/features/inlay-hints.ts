import { type InlayHint, InlayHintKind, Position } from "vscode-languageserver";
import type { DocumentState } from "../document-state";

export function provideInlayHints(state: DocumentState): InlayHint[] {
	const hints: InlayHint[] = [];
	if (!state.ast || !state.compilation?.metrics) return hints;

	const metrics = state.compilation.metrics;

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

	if (metrics.totalTime > 0) {
		const totalMinutes = Math.round(metrics.totalTime);
		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;
		const timeStr =
			hours > 0 ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`) : `${mins}m`;

		hints.push({
			position: Position.create(titleLine, titleChar),
			label: `  Total Time: ${timeStr}`,
			kind: InlayHintKind.Type,
			paddingLeft: true,
		});
	}

	return hints;
}

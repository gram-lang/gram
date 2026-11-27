import type { Position, Range } from "vscode-languageserver";
import { buildLineIndex, offsetToPosition } from "@gram-lang/modules/lint";

// Shared with `gram check` (`@gram-lang/modules/lint`), so both count the
// same lines and UTF-16 columns.
export { buildLineIndex, offsetToPosition };

export function locToRange(
	lineStarts: number[],
	loc: { start: number; end: number },
): Range {
	return {
		start: offsetToPosition(lineStarts, loc.start),
		end: offsetToPosition(lineStarts, loc.end),
	};
}

export function positionToOffset(
	lineStarts: number[],
	position: Position,
): number {
	const lineStart = (lineStarts[position.line] ??
		lineStarts[lineStarts.length - 1])!;
	return lineStart + position.character;
}

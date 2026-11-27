/**
 * Line and column of an offset, the way the language server and
 * `gram check` both show it. Offsets and columns count UTF-16 code units,
 * like `loc` (Ohm.js) and the LSP: an emoji is two columns, `é` one.
 */

/** A position, both counted from 0 (the LSP's convention). */
export interface LinePosition {
	line: number;
	character: number;
}

/**
 * The offset where each line of `text` starts: `[0, …]`, one entry after
 * each `\n`.
 *
 * @experimental
 */
export function buildLineIndex(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") starts.push(i + 1);
	}
	return starts;
}

/**
 * The line and column of `offset`, both from 0, given the line starts of
 * its text (`buildLineIndex`).
 *
 * @experimental
 */
export function offsetToPosition(
	lineStarts: number[],
	offset: number,
): LinePosition {
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid]! <= offset) lo = mid;
		else hi = mid - 1;
	}
	return { line: lo, character: offset - lineStarts[lo]! };
}

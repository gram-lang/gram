import type { Position, Range } from 'vscode-languageserver';

export function buildLineIndex(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    return starts;
}

export function offsetToPosition(lineStarts: number[], offset: number): Position {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid]! <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo, character: offset - lineStarts[lo]! };
}

export function locToRange(lineStarts: number[], loc: { start: number; end: number }): Range {
    return {
        start: offsetToPosition(lineStarts, loc.start),
        end: offsetToPosition(lineStarts, loc.end),
    };
}

export function positionToOffset(lineStarts: number[], position: Position): number {
    const lineStart = (lineStarts[position.line] ?? lineStarts[lineStarts.length - 1])!;
    return lineStart + position.character;
}

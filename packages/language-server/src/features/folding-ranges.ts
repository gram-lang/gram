import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { offsetToPosition } from '../utils/position';

export function provideFoldingRanges(state: DocumentState): FoldingRange[] {
    const ranges: FoldingRange[] = [];

    // Frontmatter: scan for opening and closing ---
    const fmMatch = state.text.match(/^---\r?\n[\s\S]*?\n---/m);
    if (fmMatch) {
        const fmEnd = state.text.indexOf('\n---', 3);
        if (fmEnd !== -1) {
            const endLine = offsetToPosition(state.lineStarts, fmEnd + 1).line;
            ranges.push({ startLine: 0, endLine, kind: FoldingRangeKind.Region });
        }
    }

    if (!state.ast) return ranges;

    // Sections
    for (const section of state.ast.children) {
        if (!section.loc) continue;
        const startLine = offsetToPosition(state.lineStarts, section.loc.start).line;
        const endLine = offsetToPosition(state.lineStarts, section.loc.end).line;
        if (endLine > startLine) {
            ranges.push({ startLine, endLine, kind: FoldingRangeKind.Region });
        }
    }

    return ranges;
}

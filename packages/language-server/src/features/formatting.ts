import { TextEdit, Range } from 'vscode-languageserver';
import { DocumentState } from '../document-state';

function formatLine(line: string, inFrontmatter: boolean): string {
    if (inFrontmatter) return line.replace(/\s+$/, '');

    let out = line;

    // Trim trailing whitespace
    out = out.replace(/\s+$/, '');

    // Normalize spaces inside ingredient/cookware/timer/temp braces: { qty unit } → {qty unit}
    // Only trim inner leading/trailing spaces, not content
    out = out.replace(/\{(\s+)/g, '{').replace(/(\s+)\}/g, '}');

    // Normalize composite separator: @ingA{} < @ingB{} → @ingA{}<@ingB{}
    out = out.replace(/ *< *@/g, '<@');

    // Normalize ->&name {} → ->&name{} (handles single and multi-word names)
    out = out.replace(/->&([^{\n]+?)\s+\{\}/g, '->&$1{}');

    // Normalize section headers: ensure exactly one space after ## (handles ##Title and ##  Title)
    out = out.replace(/^(#{1,3})\s*(?=\S)/, (_, hashes) => hashes + ' ');

    // Normalize tabs → 4 spaces (in recipe body only)
    out = out.replace(/\t/g, '    ');

    return out;
}

export function provideFormatting(state: DocumentState): TextEdit[] {
    const lines = state.text.split('\n');
    const formatted: string[] = [];

    let inFrontmatter = false;
    let frontmatterClosed = false;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];

        // Track frontmatter boundaries
        if (i === 0 && raw.trimEnd() === '---') {
            inFrontmatter = true;
            formatted.push(raw.replace(/\s+$/, ''));
            continue;
        }
        if (inFrontmatter && !frontmatterClosed && raw.trimEnd() === '---') {
            inFrontmatter = false;
            frontmatterClosed = true;
            formatted.push(raw.replace(/\s+$/, ''));
            continue;
        }

        formatted.push(formatLine(raw, inFrontmatter));
    }

    const newText = formatted.join('\n');
    if (newText === state.text) return [];

    const lastLine = lines.length - 1;
    const lastChar = lines[lastLine]?.length ?? 0;
    const fullRange: Range = {
        start: { line: 0, character: 0 },
        end: { line: lastLine, character: lastChar },
    };

    return [{ range: fullRange, newText }];
}

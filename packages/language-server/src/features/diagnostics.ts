import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { locToRange } from '../utils/position';
import { collectIntermediates, collectReferences } from '../utils/ast-walker';
import { WarningCode } from '@gram/compiler';

const ZERO_RANGE: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };

export function provideDiagnostics(state: DocumentState): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (state.parseError) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: ZERO_RANGE,
            message: state.parseError,
            source: 'gram',
        });
        return diagnostics;
    }

    if (!state.ast) return diagnostics;

    // Compiler warnings → LSP diagnostics
    if (state.compilation?.warnings) {
        for (const w of state.compilation.warnings) {
            const range = w.loc ? locToRange(state.lineStarts, w.loc) : ZERO_RANGE;
            const isError = w.code === WarningCode.UNDEFINED_REFERENCE || w.code === WarningCode.CIRCULAR_REFERENCE;
            diagnostics.push({
                severity: isError ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
                range,
                message: w.message,
                code: w.code,
                source: 'gram',
            });
        }
    }

    // Unused intermediate declarations (declared but never referenced)
    const declared = collectIntermediates(state.ast);
    const usedNames = new Set(collectReferences(state.ast).map(r => r.name));
    for (const { decl } of declared) {
        if (!usedNames.has(decl.name)) {
            const range = decl.loc ? locToRange(state.lineStarts, decl.loc) : ZERO_RANGE;
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Intermediate '->&${decl.name}' is declared but never used.`,
                code: 'UNUSED_INTERMEDIATE',
                source: 'gram',
            });
        }
    }

    // Missing frontmatter title
    if (!state.ast.meta || !(state.ast.meta as any).title) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: ZERO_RANGE,
            message: "Recipe is missing a 'title' in frontmatter.",
            code: 'MISSING_TITLE',
            source: 'gram',
        });
    }

    return diagnostics;
}

import { describe, it, expect } from 'bun:test';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { parseDocument } from '../src/document-state';
import { provideDiagnostics } from '../src/features/diagnostics';

describe('provideDiagnostics — shared warningSeverity map', () => {
    it('reports a structural issue (undefined reference) as Error', () => {
        const state = parseDocument('## Section\nUse &ghost.\n');
        const diags = provideDiagnostics(state);
        const undefinedRef = diags.find(d => d.code === 'UNDEFINED_REFERENCE');
        expect(undefinedRef?.severity).toBe(DiagnosticSeverity.Error);
    });

    it('reports a nutritional/estimation-style issue (missing timer unit) as Warning, not Error', () => {
        const state = parseDocument('## Section\nWait for ~timer{10}.\n');
        const diags = provideDiagnostics(state);
        const missingUnit = diags.find(d => d.code === 'MISSING_UNIT');
        expect(missingUnit?.severity).toBe(DiagnosticSeverity.Warning);
    });
});

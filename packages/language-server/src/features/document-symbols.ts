import { type DocumentSymbol, SymbolKind, type Range } from 'vscode-languageserver';
import type { DocumentState } from '../document-state';
import { locToRange } from '../utils/position';
import { type SectionAST, type StepAST, type IntermediateDecl, isIntermediateDecl, isStep } from '@gram-lang/parser';

const ZERO_RANGE: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function getDeclSymbol(decl: IntermediateDecl, lineStarts: number[]): DocumentSymbol {
    const range = decl.loc ? locToRange(lineStarts, decl.loc) : ZERO_RANGE;
    return {
        name: `->&${decl.name}`,
        kind: SymbolKind.Variable,
        range,
        selectionRange: range,
    };
}

function getStepSymbol(step: StepAST, index: number, lineStarts: number[]): DocumentSymbol {
    const range = step.loc ? locToRange(lineStarts, step.loc) : ZERO_RANGE;
    const name = step.action ?? `Step ${index + 1}`;

    // Inline ->&decl inside this step become children
    const children: DocumentSymbol[] = [];
    for (const child of step.children) {
        if (isIntermediateDecl(child)) {
            children.push(getDeclSymbol(child, lineStarts));
        }
    }

    const symbol: DocumentSymbol = {
        name,
        kind: SymbolKind.Event,
        range,
        selectionRange: range,
    };
    if (children.length > 0) symbol.children = children;
    return symbol;
}

export function provideDocumentSymbols(state: DocumentState): DocumentSymbol[] {
    if (!state.ast) return [];

    return state.ast.children.map((section: SectionAST) => {
        const sectionRange = section.loc ? locToRange(state.lineStarts, section.loc) : ZERO_RANGE;
        const children: DocumentSymbol[] = [];

        // Section-level intermediate declaration (from header: ## Title ->&decl)
        if (section.intermediateDecl) {
            children.push(getDeclSymbol(section.intermediateDecl, state.lineStarts));
        }

        // Steps (with their inline ->&decl as children)
        let stepIndex = 0;
        for (const block of section.children) {
            if (!isStep(block)) continue;
            children.push(getStepSymbol(block, stepIndex, state.lineStarts));
            stepIndex++;
        }

        const symbol: DocumentSymbol = {
            name: section.title ?? '(section)',
            kind: SymbolKind.Module,
            range: sectionRange,
            selectionRange: sectionRange,
        };
        if (children.length > 0) symbol.children = children;
        return symbol;
    });
}

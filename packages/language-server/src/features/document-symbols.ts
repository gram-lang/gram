import { DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { locToRange } from '../utils/position';
import { ASTNodeType, SectionAST, StepAST, IntermediateDecl } from '@gram/parser';

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

export function provideDocumentSymbols(state: DocumentState): DocumentSymbol[] {
    if (!state.ast) return [];

    return state.ast.children.map((section: SectionAST) => {
        const sectionRange = section.loc ? locToRange(state.lineStarts, section.loc) : ZERO_RANGE;
        const children: DocumentSymbol[] = [];

        if (section.intermediateDecl) {
            children.push(getDeclSymbol(section.intermediateDecl, state.lineStarts));
        }

        for (const block of section.children) {
            if (block.type !== ASTNodeType.Step) continue;
            for (const child of (block as StepAST).children) {
                if (child.type === ASTNodeType.IntermediateDecl) {
                    children.push(getDeclSymbol(child as IntermediateDecl, state.lineStarts));
                }
            }
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

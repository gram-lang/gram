import { CodeAction, CodeActionKind, Diagnostic, Range, TextEdit } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { locToRange, offsetToPosition, positionToOffset } from '../utils/position';
import { collectIntermediates, collectIngredients } from '../utils/ast-walker';
import { IngredientDB, lookupIngredient } from '../ingredient-loader';
import { normalizeUnit } from '@gram/i18n';
import { ASTNodeType, QuantityAST } from '@gram/parser';
import { volumeToGrams } from './hover-nutrition';

export function provideCodeActions(
    state: DocumentState,
    range: Range,
    diagnostics: Diagnostic[],
    uri: string,
    db: IngredientDB,
): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diag of diagnostics) {
        // Quick fix: add missing title to frontmatter
        if (diag.code === 'MISSING_TITLE') {
            if (state.text.startsWith('---')) {
                const titleInsert: TextEdit = {
                    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
                    newText: 'title: \n',
                };
                actions.push({
                    title: "Add 'title' to frontmatter",
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diag],
                    edit: { changes: { [uri]: [titleInsert] } },
                });
            }
        }

        // Quick fix: remove unused intermediate declaration
        if (diag.code === 'UNUSED_INTERMEDIATE') {
            const nameMatch = diag.message.match(/'->& *([^']+)'/);
            if (nameMatch) {
                const name = nameMatch[1];
                const decls = collectIntermediates(state.ast!);
                const match = decls.find(d => d.decl.name === name && d.decl.loc);
                if (match?.decl.loc) {
                    actions.push({
                        title: `Remove unused '->&${name}'`,
                        kind: CodeActionKind.QuickFix,
                        diagnostics: [diag],
                        edit: { changes: { [uri]: [{ range: locToRange(state.lineStarts, match.decl.loc), newText: '' }] } },
                    });
                }
            }
        }

        // Quick fix: declare missing intermediate at end of current section
        if (diag.code === 'UNDEFINED_REFERENCE' || (typeof diag.code === 'string' && diag.code.includes('UNDEFINED'))) {
            const nameMatch = diag.message.match(/'&([^']+)'/);
            if (nameMatch && state.ast) {
                const name = nameMatch[1];
                const offset = positionToOffset(state.lineStarts, diag.range.start);
                let insertLine = diag.range.start.line + 1;
                for (const section of state.ast.children) {
                    if (section.loc && section.loc.start <= offset && offset <= section.loc.end) {
                        insertLine = offsetToPosition(state.lineStarts, section.loc.end).line;
                        break;
                    }
                }
                actions.push({
                    title: `Declare '->&${name}{}'`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diag],
                    edit: { changes: { [uri]: [{ range: { start: { line: insertLine, character: 0 }, end: { line: insertLine, character: 0 } }, newText: `->&${name}{}\n` }] } },
                });
            }
        }
    }

    // Refactor: convert volume unit → grams (only when ingredient has density in DB)
    if (state.ast && Object.keys(db).length > 0) {
        const cursorOffset = positionToOffset(state.lineStarts, range.start);
        const ingredients = collectIngredients(state.ast);
        const ingredient = ingredients.find(i => i.loc && i.loc.start <= cursorOffset && cursorOffset <= i.loc.end);

        if (ingredient) {
            const entry = lookupIngredient(ingredient.name, db);
            const qty = ingredient.quantity?.type === ASTNodeType.Quantity ? ingredient.quantity as QuantityAST : null;

            if (entry?.physical?.density && qty?.unit && qty.value?.type === 'single' && typeof qty.value.value === 'number' && qty.loc) {
                const canon = normalizeUnit(qty.unit);
                const amount = qty.value.value;
                const density = entry.physical.density;

                // Volume → grams: ml, l, tsp, tbsp, and their aliases
                const grams = volumeToGrams(amount, canon, density);
                if (grams != null) {
                    const qtyRange = locToRange(state.lineStarts, qty.loc);
                    actions.push({
                        title: `Convert to grams (≈ ${Math.round(grams)} g)`,
                        kind: CodeActionKind.RefactorRewrite,
                        // qty.loc covers only the inner content (e.g. "1 càc"), not the surrounding {}
                        edit: { changes: { [uri]: [{ range: qtyRange, newText: `${Math.round(grams)} g` }] } },
                    });
                }
            }
        }
    }

    return actions;
}

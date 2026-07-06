import { type Hover, type MarkupContent, MarkupKind, type Position } from 'vscode-languageserver';
import type { DocumentState } from '../document-state';
import { positionToOffset } from '../utils/position';
import { collectIntermediates, collectReferences, getStepSourceText } from '../utils/ast-walker';
import type { IngredientDB } from '../ingredient-loader';
import { provideNutritionHover } from './hover-nutrition';

export function provideHover(state: DocumentState, position: Position, db: IngredientDB): Hover | null {
    if (!state.ast) return null;

    const offset = positionToOffset(state.lineStarts, position);

    // 1. Hover on &ref → show the step that produced it
    const refs = collectReferences(state.ast);
    const ref = refs.find(r => r.loc && r.loc.start <= offset && offset <= r.loc.end);
    if (ref) {
        const decls = collectIntermediates(state.ast);
        const match = decls.find(d => d.decl.name === ref.name);
        if (!match) return null;

        let description = '';
        if (match.step) {
            description = `\`\`\`gram\n${getStepSourceText(match.step, state.text)}\n\`\`\``;
        } else if (match.section) {
            description = `Section: **${match.section.title ?? '(unnamed)'}**`;
        }

        const contents: MarkupContent = {
            kind: MarkupKind.Markdown,
            value: [`**\`->&${ref.name}\`**`, description].filter(Boolean).join('\n\n'),
        };
        return { contents };
    }

    // 2. Hover on @ingredient → show nutrition + unit conversion
    return provideNutritionHover(state, position, db);
}

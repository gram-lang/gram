import { SemanticTokens } from 'vscode-languageserver';
import {
    ASTNodeType, SectionAST, StepAST, IngredientAST, CookwareAST,
    TimerAST, TemperatureAST, ReferenceAST, IntermediateDecl,
    AlternativeAST, CommentAST, QuantityAST, TextQuantityAST,
} from '@gram/parser';
import { DocumentState } from '../document-state';
import { offsetToPosition } from '../utils/position';

export const SEMANTIC_TOKEN_TYPES = [
    'namespace',  // 0 — ## section title
    'keyword',    // 1 — sigils: @ # ~ ° ->& & <@
    'parameter',  // 2 — ingredient / cookware names
    'variable',   // 3 — intermediate / reference names
    'number',     // 4 — quantity amounts
    'type',       // 5 — units (g, ml, tbsp, min…)
    'string',     // 6 — text quantities, temperature descriptions
    'operator',   // 7 — braces {}, brackets [], modifiers, <
    'function',   // 8 — action verbs [Mix]
    'comment',    // 9 — // and /* */
] as const;

export const SEMANTIC_TOKEN_MODIFIERS: string[] = [];

const T = {
    namespace: 0, keyword: 1, parameter: 2, variable: 3, number: 4,
    type: 5, string: 6, operator: 7, function: 8, comment: 9,
} as const;

interface RawToken { offset: number; length: number; type: number; }

function emit(out: RawToken[], offset: number, length: number, type: number): void {
    if (length > 0 && offset >= 0) out.push({ offset, length, type });
}

// Emits only the brace delimiters { } as operators.
// The number/unit content inside is intentionally left to the TextMate grammar
// (constant.numeric.gram / string.unquoted.unit.gram), which themes reliably colour
// differently — avoiding dependence on theme-specific semantic token rules.
function emitQuantity(out: RawToken[], qty: QuantityAST, text: string): void {
    if (!qty.loc) return;
    const cStart = qty.loc.start;
    const cEnd = qty.loc.end;
    if (text[cStart] === '{') {
        emit(out, cStart, 1, T.operator);
        emit(out, cEnd - 1, 1, T.operator);
    } else {
        if (cStart > 0) emit(out, cStart - 1, 1, T.operator);
        emit(out, cEnd, 1, T.operator);
    }
}

function emitTextQtyWithText(out: RawToken[], qty: TextQuantityAST, text: string): void {
    if (!qty.loc) return;
    const cStart = qty.loc.start;
    const cEnd = qty.loc.end;
    if (text[cStart] === '{') {
        emit(out, cStart, 1, T.operator);
        emit(out, cEnd - 1, 1, T.operator);
    } else {
        if (cStart > 0) emit(out, cStart - 1, 1, T.operator);
        emit(out, cEnd, 1, T.operator);
    }
}

function walkIngredient(out: RawToken[], ing: IngredientAST, text: string): void {
    if (!ing.loc) return;
    let pos = ing.loc.start;

    // @ sigil
    if (text[pos] === '@') { emit(out, pos, 1, T.keyword); pos++; }

    // Modifier chars (can be combined: @?- etc.)
    const modStart = pos;
    while (pos < ing.loc.end && '-?&*='.includes(text[pos] ?? '')) pos++;
    if (pos > modStart) emit(out, modStart, pos - modStart, T.operator);

    // Name — ends at { < ( newline or end of token
    const nameStart = pos;
    while (pos < ing.loc.end && !'{<(\n'.includes(text[pos] ?? '')) pos++;
    const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
    if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.parameter);

    // Main quantity
    if (ing.quantity?.type === ASTNodeType.Quantity) {
        emitQuantity(out, ing.quantity as QuantityAST, text);
    } else if (ing.quantity?.type === ASTNodeType.TextQuantity) {
        emitTextQtyWithText(out, ing.quantity as TextQuantityAST, text);
    }

    // Composite part: <@name{qty} stored in ing.composite, within the same loc span
    if (ing.composite) {
        // Find <@ in the source after the main ingredient (the composite is always contiguous)
        const ltAt = text.indexOf('<@', ing.loc.start + 1);
        if (ltAt >= 0 && ltAt < ing.loc.end) {
            emit(out, ltAt, 1, T.operator);    // <
            emit(out, ltAt + 1, 1, T.keyword); // @
            const compNameStart = ltAt + 2;
            emit(out, compNameStart, ing.composite.parent.length, T.parameter); // composite name
            if (ing.composite.quantity?.type === ASTNodeType.Quantity) {
                emitQuantity(out, ing.composite.quantity as QuantityAST, text);
            }
        }
    }
}

function walkCookware(out: RawToken[], cw: CookwareAST, text: string): void {
    if (!cw.loc) return;
    let pos = cw.loc.start;

    // # sigil
    if (text[pos] === '#') { emit(out, pos, 1, T.keyword); pos++; }

    // Modifiers
    const modStart = pos;
    while (pos < cw.loc.end && '-?&*='.includes(text[pos] ?? '')) pos++;
    if (pos > modStart) emit(out, modStart, pos - modStart, T.operator);

    // Name
    const nameStart = pos;
    while (pos < cw.loc.end && !'{(\n'.includes(text[pos] ?? '')) pos++;
    const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
    if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.parameter);

    // Quantity
    if (cw.quantity?.type === ASTNodeType.Quantity) {
        emitQuantity(out, cw.quantity as QuantityAST, text);
    }
}

function walkReference(out: RawToken[], ref: ReferenceAST, text: string): void {
    if (!ref.loc) return;
    let pos = ref.loc.start;

    // & sigil
    if (text[pos] === '&') { emit(out, pos, 1, T.keyword); pos++; }

    // Name
    const nameStart = pos;
    while (pos < ref.loc.end && !'{(\n'.includes(text[pos] ?? '')) pos++;
    const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
    if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.variable);

    // Optional quantity
    if (ref.quantity?.type === ASTNodeType.Quantity) {
        emitQuantity(out, ref.quantity as QuantityAST, text);
    } else if (ref.quantity?.type === ASTNodeType.TextQuantity) {
        emitTextQtyWithText(out, ref.quantity as TextQuantityAST, text);
    }
}

function walkTimer(out: RawToken[], timer: TimerAST, text: string): void {
    if (!timer.loc) return;
    let pos = timer.loc.start;

    // ~ sigil
    if (text[pos] === '~') { emit(out, pos, 1, T.keyword); pos++; }

    // Async modifier &
    if (timer.isAsync && text[pos] === '&') {
        emit(out, pos, 1, T.operator);
        pos++;
    }

    // Optional name (e.g. ~baking{30 min})
    if (timer.name) {
        emit(out, pos, timer.name.length, T.variable);
        pos += timer.name.length;
    }

    if (timer.quantity?.type === ASTNodeType.Quantity) {
        emitQuantity(out, timer.quantity as QuantityAST, text);
    } else if (timer.quantity?.type === ASTNodeType.TextQuantity) {
        emitTextQtyWithText(out, timer.quantity as TextQuantityAST, text);
    }
}

function walkTemperature(out: RawToken[], temp: TemperatureAST, text: string): void {
    if (!temp.loc) return;
    // ° sigil (1 UTF-16 code unit)
    emit(out, temp.loc.start, 1, T.keyword);

    // The {value unit} or {text} part: color as string — precise splitting from TemperatureAST fields
    if (temp.loc.end > temp.loc.start + 1) {
        const bodyStart = temp.loc.start + 1 + (temp.name?.length ?? 0);
        const body = text.slice(bodyStart, temp.loc.end);
        const braceOpen = body.indexOf('{');
        if (braceOpen >= 0) {
            const braceClose = body.lastIndexOf('}');
            const absOpen = bodyStart + braceOpen;
            const absClose = bodyStart + (braceClose >= 0 ? braceClose : body.length - 1);
            emit(out, absOpen, 1, T.operator);                           // {
            emit(out, absOpen + 1, absClose - absOpen - 1, T.string);   // content
            emit(out, absClose, 1, T.operator);                          // }
        }
    }
}

function walkIntermediate(out: RawToken[], decl: IntermediateDecl, text: string): void {
    if (!decl.loc) return;
    let pos = decl.loc.start;

    // ->&  (3 chars)
    emit(out, pos, 3, T.keyword);
    pos += 3;

    // Name
    const nameStart = pos;
    while (pos < decl.loc.end && text[pos] !== '{' && text[pos] !== '\n') pos++;
    const nameTrimLen = text.slice(nameStart, pos).trimEnd().length;
    if (nameTrimLen > 0) emit(out, nameStart, nameTrimLen, T.variable);

    // {} (always empty for declarations)
    if (text[pos] === '{' && text[pos + 1] === '}') {
        emit(out, pos, 1, T.operator);
        emit(out, pos + 1, 1, T.operator);
    }
}

function walkStep(out: RawToken[], step: StepAST, text: string): void {
    if (!step.loc) return;

    // Action verb [Mix]
    if (step.action && text[step.loc.start] === '[') {
        const closeIdx = text.indexOf(']', step.loc.start);
        if (closeIdx > step.loc.start) {
            emit(out, step.loc.start, 1, T.operator);
            emit(out, step.loc.start + 1, closeIdx - step.loc.start - 1, T.function);
            emit(out, closeIdx, 1, T.operator);
        }
    }

    for (const child of step.children) {
        switch (child.type) {
            case ASTNodeType.Ingredient:
                walkIngredient(out, child as IngredientAST, text); break;
            case ASTNodeType.Cookware:
                walkCookware(out, child as CookwareAST, text); break;
            case ASTNodeType.Timer:
                walkTimer(out, child as TimerAST, text); break;
            case ASTNodeType.Temperature:
                walkTemperature(out, child as TemperatureAST, text); break;
            case ASTNodeType.Reference:
                walkReference(out, child as ReferenceAST, text); break;
            case ASTNodeType.IntermediateDecl:
                walkIntermediate(out, child as IntermediateDecl, text); break;
            case ASTNodeType.Alternative:
                for (const opt of (child as AlternativeAST).options) {
                    if (opt.type === ASTNodeType.Ingredient) walkIngredient(out, opt as IngredientAST, text);
                    else if (opt.type === ASTNodeType.Cookware) walkCookware(out, opt as CookwareAST, text);
                }
                break;
            case ASTNodeType.Comment:
                if ((child as CommentAST).loc) {
                    const c = child as CommentAST;
                    emit(out, c.loc!.start, c.loc!.end - c.loc!.start, T.comment);
                }
                break;
        }
    }
}

function walkSection(out: RawToken[], section: SectionAST, text: string): void {
    // Section header: ## Title
    if (section.loc && text.slice(section.loc.start, section.loc.start + 2) === '##') {
        const headerStart = section.loc.start;
        emit(out, headerStart, 2, T.keyword); // ##

        // Title starts after ## and optional spaces
        let titlePos = headerStart + 2;
        while (titlePos < text.length && text[titlePos] === ' ') titlePos++;

        // Title ends before ->&, ~, or newline
        const lineEnd = text.indexOf('\n', titlePos);
        const lineEndAbs = lineEnd >= 0 ? lineEnd : text.length;
        let titleEnd = lineEndAbs;
        for (const marker of ['->&', '~']) {
            const idx = text.indexOf(marker, titlePos);
            if (idx >= 0 && idx < titleEnd) titleEnd = idx;
        }
        // Trim trailing spaces from title
        while (titleEnd > titlePos && text[titleEnd - 1] === ' ') titleEnd--;
        if (titleEnd > titlePos) emit(out, titlePos, titleEnd - titlePos, T.namespace);
    }

    // Intermediate decl in section header (## Title ->&name{})
    if (section.intermediateDecl) {
        walkIntermediate(out, section.intermediateDecl, text);
    }

    for (const block of section.children) {
        if (block.type === ASTNodeType.Step) {
            walkStep(out, block as StepAST, text);
        } else if (block.type === ASTNodeType.Comment) {
            const c = block as CommentAST;
            if (c.loc) emit(out, c.loc.start, c.loc.end - c.loc.start, T.comment);
        }
    }
}

function encodeTokens(rawTokens: RawToken[], lineStarts: number[]): number[] {
    rawTokens.sort((a, b) => a.offset - b.offset);

    const data: number[] = [];
    let prevLine = 0;
    let prevChar = 0;

    for (const tok of rawTokens) {
        const pos = offsetToPosition(lineStarts, tok.offset);
        const deltaLine = pos.line - prevLine;
        const deltaChar = deltaLine === 0 ? pos.character - prevChar : pos.character;
        data.push(deltaLine, deltaChar, tok.length, tok.type, 0);
        prevLine = pos.line;
        prevChar = pos.character;
    }

    return data;
}

export function provideSemanticTokens(state: DocumentState): SemanticTokens {
    if (!state.ast) return { data: [] };

    const out: RawToken[] = [];
    const text = state.text;

    for (const section of state.ast.children) {
        walkSection(out, section, text);
    }

    return { data: encodeTokens(out, state.lineStarts) };
}

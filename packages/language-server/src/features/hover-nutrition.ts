import { Hover, MarkupContent, MarkupKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { positionToOffset } from '../utils/position';
import { collectIngredients } from '../utils/ast-walker';
import { IngredientDB, lookupIngredient, IngredientEntry } from '../ingredient-loader';
import { normalizeUnit } from '@gram/i18n';
import { ASTNodeType, QuantityAST } from '@gram/parser';

// ml equivalent for spoon units (not in i18n volume set)
export const SPOON_TO_ML: Record<string, number> = { tsp: 5, tbsp: 15 };

const VOLUME_UNITS = new Set(['ml', 'l']);

function toMillilitres(value: number, unit: string): number {
    if (unit === 'l') return value * 1000;
    if (SPOON_TO_ML[unit]) return value * SPOON_TO_ML[unit];
    return value; // ml
}

// Returns grams from any volume unit (ml, l, tsp, tbsp), or null if not applicable.
export function volumeToGrams(amount: number, canonUnit: string, density: number): number | null {
    if (VOLUME_UNITS.has(canonUnit) || SPOON_TO_ML[canonUnit]) {
        return toMillilitres(amount, canonUnit) * density;
    }
    return null;
}

function buildConversionSection(qty: QuantityAST, entry: IngredientEntry, rawUnit: string): string | null {
    const physical = entry.physical;
    if (!physical?.density) return null;

    const canon = normalizeUnit(rawUnit);
    if (!canon) return null;

    const qtyValue = qty.value;
    if (!qtyValue || qtyValue.type !== 'single' || typeof qtyValue.value !== 'number') return null;
    const amount = qtyValue.value;

    const grams = volumeToGrams(amount, canon, physical.density);
    if (grams != null) {
        return `**Conversion**: ${amount} ${rawUnit} ≈ **${Math.round(grams)} g** _(density: ${physical.density} g/ml)_`;
    }

    if (physical.unit_weight) {
        const totalGrams = amount * physical.unit_weight;
        return `**Conversion**: ${amount} unit(s) ≈ **${Math.round(totalGrams)} g** _(${physical.unit_weight} g/unit)_`;
    }

    return null;
}

function row(label: string, value: number | undefined | null, unit: string): string | null {
    if (value == null) return null;
    return `| ${label} | ${value} ${unit} |`;
}

function buildNutritionSection(entry: IngredientEntry): string | null {
    const n = entry.nutrition;
    if (!n) return null;

    const lines: string[] = [
        `| Nutrient | per 100 g |`,
        `|---|---|`,
        `| Calories | ${n.calories} kcal |`,
    ];

    const optional: Array<[string, number | undefined | null, string]> = [
        ['Carbohydrates', n.carbs, 'g'],
        ['— of which sugars', n.sugar, 'g'],
        ['Protein', n.protein, 'g'],
        ['Fat', n.fat, 'g'],
        ['— of which saturated', n.sat_fat, 'g'],
        ['— of which mono-unsat.', n.mono_fat, 'g'],
        ['— of which poly-unsat.', n.poly_fat, 'g'],
        ['Fiber', n.fiber, 'g'],
        ['Sodium', n.sodium != null ? +(n.sodium * 1000).toFixed(2) : null, 'mg'],
        ['Alcohol', n.alcohol, 'g'],
    ];

    for (const [label, value, unit] of optional) {
        const r = row(label, value, unit);
        if (r) lines.push(r);
    }

    return lines.join('\n');
}

export function provideNutritionHover(state: DocumentState, position: Position, db: IngredientDB): Hover | null {
    if (!state.ast || Object.keys(db).length === 0) return null;

    const offset = positionToOffset(state.lineStarts, position);
    const ingredients = collectIngredients(state.ast);
    const ingredient = ingredients.find(i => i.loc && i.loc.start <= offset && offset <= i.loc.end);
    if (!ingredient) return null;

    const entry = lookupIngredient(ingredient.name, db);
    if (!entry) return null;

    const sections: string[] = [`**\`@${ingredient.name}\`** — _${entry.name}_`];

    const nutrition = buildNutritionSection(entry);
    if (nutrition) sections.push(nutrition);

    const qty = ingredient.quantity?.type === ASTNodeType.Quantity ? ingredient.quantity as QuantityAST : null;
    if (qty?.unit) {
        const conversion = buildConversionSection(qty, entry, qty.unit);
        if (conversion) sections.push(conversion);
    }

    const contents: MarkupContent = { kind: MarkupKind.Markdown, value: sections.join('\n\n---\n\n') };
    return { contents };
}

import { Hover, MarkupContent, MarkupKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { positionToOffset } from '../utils/position';
import { collectIngredients } from '../utils/ast-walker';
import { IngredientDB, lookupIngredient, IngredientEntry } from '../ingredient-loader';
import { normalizeUnit } from '@gram/i18n';
import { UNIT_CONVERSIONS } from '@gram/analyzer';
import { ASTNodeType, QuantityAST, QuantityValueAST } from '@gram/parser';

// Resolve the numeric amount from any supported QuantityValueAST type.
export function getQtyAmount(qtyValue: QuantityValueAST): number | null {
    switch (qtyValue.type) {
        case 'single':
            return typeof qtyValue.value === 'number' ? qtyValue.value : null;
        case 'fraction':
            if (qtyValue.numerator != null && qtyValue.denominator) {
                return qtyValue.numerator / qtyValue.denominator;
            }
            return null;
        case 'range':
            return qtyValue.range?.min ?? null;
        default:
            return null;
    }
}

// Returns grams from a volume unit + density, or from a mass unit directly.
export function volumeToGrams(amount: number, canonUnit: string, density: number): number | null {
    const volFactor = UNIT_CONVERSIONS.volume.map[canonUnit];
    if (volFactor !== undefined) return amount * volFactor * density;
    const massFactor = UNIT_CONVERSIONS.mass.map[canonUnit];
    if (massFactor !== undefined) return amount * massFactor;
    return null;
}

function buildConversionSection(qty: QuantityAST, entry: IngredientEntry, rawUnit: string): string | null {
    const physical = entry.physical;
    if (!physical?.density) return null;

    const canon = normalizeUnit(rawUnit);
    if (!canon) return null;

    const qtyValue = qty.value;
    if (!qtyValue) return null;
    const amount = getQtyAmount(qtyValue);
    if (amount === null || amount <= 0) return null;

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

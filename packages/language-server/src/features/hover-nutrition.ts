import { Hover, MarkupContent, MarkupKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { positionToOffset } from '../utils/position';
import { collectIngredients } from '../utils/ast-walker';
import { IngredientDB, lookupIngredient, IngredientEntry } from '../ingredient-loader';
import { normalizeUnit } from '@gram/i18n';
import { UNIT_CONVERSIONS, normalizeMass } from '@gram/analyzer';
import { ASTNodeType, QuantityAST, QuantityValueAST } from '@gram/parser';
import { getNumericQty } from '@gram/compiler';

function buildConversionSection(qty: QuantityAST, entry: IngredientEntry, rawUnit: string, db: IngredientDB): string | null {
    const physical = entry.physical;
    if (!physical) return null;

    const canon = normalizeUnit(rawUnit);
    if (!canon) return null;

    const qtyValue = qty.value;
    if (!qtyValue) return null;
    const amount = getNumericQty(qtyValue);
    if (amount === null || amount <= 0) return null;

    const norm = normalizeMass(amount, canon, db, entry.name);
    if (norm) {
        if (norm.method === 'physical' && canon !== 'g') {
            return `**Conversion**: ${amount} ${rawUnit} = **${Math.round(norm.mass)} g**`;
        } else if (norm.method === 'density' && physical.density) {
            return `**Conversion**: ${amount} ${rawUnit} ≈ **${Math.round(norm.mass)} g** _(density: ${physical.density} g/ml)_`;
        } else if (norm.method === 'unit_weight' && physical.unit_weight) {
            return `**Conversion**: ${amount} unit(s) ≈ **${Math.round(norm.mass)} g** _(${physical.unit_weight} g/unit)_`;
        }
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
        const conversion = buildConversionSection(qty, entry, qty.unit, db);
        if (conversion) sections.push(conversion);
    }

    const contents: MarkupContent = { kind: MarkupKind.Markdown, value: sections.join('\n\n---\n\n') };
    return { contents };
}

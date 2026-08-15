import {
	type Hover,
	type MarkupContent,
	MarkupKind,
	type Position,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { positionToOffset } from "../utils/position";
import { collectIngredients } from "../utils/ast-walker";
import {
	type IngredientDB,
	lookupIngredient,
	type IngredientEntry,
} from "../ingredient-loader";
import { normalizeUnit } from "@gram-lang/i18n";
import { NUTRIENTS, standardizeMass } from "@gram-lang/analyzer";
import { type QuantityAST, isQuantity } from "@gram-lang/parser";
import { getNumericQty } from "@gram-lang/kitchen";

function buildConversionSection(
	qty: QuantityAST,
	entry: IngredientEntry,
	rawUnit: string,
	db: IngredientDB,
): string | null {
	const physical = entry.physical;
	if (!physical) return null;

	const canon = normalizeUnit(rawUnit);
	if (!canon) return null;

	const qtyValue = qty.value;
	if (!qtyValue) return null;
	const amount = getNumericQty(qtyValue);
	if (amount === null || amount <= 0) return null;

	const norm = standardizeMass(amount, canon, db, entry.name);
	if (norm) {
		if (norm.method === "physical" && canon !== "g") {
			return `**Conversion**: ${amount} ${rawUnit} = **${Math.round(norm.mass)} g**`;
		} else if (norm.method === "density" && physical.density) {
			return `**Conversion**: ${amount} ${rawUnit} ≈ **${Math.round(norm.mass)} g** _(density: ${physical.density} g/ml)_`;
		} else if (norm.method === "unit_weight" && physical.unit_weight) {
			return `**Conversion**: ${amount} unit(s) ≈ **${Math.round(norm.mass)} g** _(${physical.unit_weight} g/unit)_`;
		}
	}

	return null;
}

function buildNutritionSection(entry: IngredientEntry): string | null {
	const n = entry.nutrition;
	if (!n) return null;

	// Driven by NUTRIENTS rather than a hand-written list, so this hover can no
	// longer show a different set of nutrients than the database accepts. It
	// also drops a `sodium * 1000` conversion that was here: database values
	// are already in milligrams, as the analyzer and `gram db search` both
	// assume, so the hover was reporting a thousand times too much.
	const lines: string[] = [`| Nutrient | per 100 g |`, `|---|---|`];

	for (const nutrient of NUTRIENTS) {
		const value = n[nutrient.key];
		if (value == null) continue;
		const label = nutrient.parent
			? `— of which ${nutrient.label.toLowerCase()}`
			: nutrient.label;
		lines.push(`| ${label} | ${value} ${nutrient.unit} |`);
	}

	return lines.join("\n");
}

export function provideNutritionHover(
	state: DocumentState,
	position: Position,
	db: IngredientDB,
): Hover | null {
	if (!state.ast || Object.keys(db).length === 0) return null;

	const offset = positionToOffset(state.lineStarts, position);
	const ingredients = collectIngredients(state.ast);
	const ingredient = ingredients.find(
		(i) => i.loc && i.loc.start <= offset && offset <= i.loc.end,
	);
	if (!ingredient) return null;

	const entry = lookupIngredient(ingredient.name, db);
	if (!entry) return null;

	const sections: string[] = [`**\`@${ingredient.name}\`** — _${entry.name}_`];

	const nutrition = buildNutritionSection(entry);
	if (nutrition) sections.push(nutrition);

	const qty = isQuantity(ingredient.quantity) ? ingredient.quantity : null;
	if (qty?.unit) {
		const conversion = buildConversionSection(qty, entry, qty.unit, db);
		if (conversion) sections.push(conversion);
	}

	const contents: MarkupContent = {
		kind: MarkupKind.Markdown,
		value: sections.join("\n\n---\n\n"),
	};
	return { contents };
}

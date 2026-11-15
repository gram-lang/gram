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
import { formatTerms, normalizeUnit, termsTotal } from "@gram-lang/i18n";
import { massOf, NUTRIENTS, standardizeMass } from "@gram-lang/analyzer";
import {
	type CompoundQuantityAST,
	isCompoundQuantity,
	isQuantity,
	type QuantityAST,
} from "@gram-lang/parser";
import {
	familyOf,
	numericTotal,
	readSum,
	termsByFamily,
	termsOfAst,
} from "@gram-lang/kitchen";

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

	const amount = numericTotal(termsOfAst(qty));
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

/** What a family of amounts is called in a hover (`familyOf`). */
function familyName(unit: string | null): string {
	const family = familyOf(unit);
	if (family === "mass") return "weight";
	if (family === "volume") return "volume";
	return unit ?? "count";
}

/**
 * A sum of quantities (`{1 cup + 1 tbsp}`): what it adds up to (`17 tbsp`),
 * or the kinds of amount it keeps apart (`1 cup + 20 g`: a volume and a
 * weight), then what it weighs when every part can be weighed. Nothing for
 * a sum Gram refuses: its warning says why.
 */
function buildSumSection(
	node: CompoundQuantityAST,
	entry: IngredientEntry | null,
	db: IngredientDB,
): string | null {
	const sum = readSum(node, undefined);
	if (sum.problems.length > 0 || sum.terms.length === 0) return null;
	const written = formatTerms(sum.terms);
	const lines: string[] = [];

	const total = termsTotal(sum.terms);
	if (total) {
		lines.push(
			`**Total**: ${written} = **${formatTerms([{ value: total.qty, unit: total.unit }])}**`,
		);
	} else {
		const families = termsByFamily(sum.terms).map((group) =>
			familyName(group[0]?.unit ?? null),
		);
		lines.push(
			`**Total**: ${written} _(${families.join(" + ")}, counted apart)_`,
		);
	}

	if (entry) {
		const { known, unknown } = massOf(sum.terms, db, entry.name);
		if (unknown.length === 0 && known.length > 0) {
			const mass = known.reduce(
				(acc, part) => acc + (part.term.minus ? -part.mass : part.mass),
				0,
			);
			const exact = known.every((part) => part.method === "physical");
			const density = known.some((part) => part.method === "density")
				? entry.physical?.density
				: undefined;
			if (mass > 0) {
				lines.push(
					`**Conversion**: ${written} ${exact ? "=" : "≈"} **${Math.round(mass)} g**${density ? ` _(density: ${density} g/ml)_` : ""}`,
				);
			}
		}
	}

	return lines.join("\n\n");
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
	if (!state.ast) return null;

	const offset = positionToOffset(state.lineStarts, position);
	const ingredients = collectIngredients(state.ast);
	const ingredient = ingredients.find(
		(i) => i.loc && i.loc.start <= offset && offset <= i.loc.end,
	);
	if (!ingredient) return null;

	const entry =
		Object.keys(db).length > 0 ? lookupIngredient(ingredient.name, db) : null;
	const sum = isCompoundQuantity(ingredient.quantity)
		? buildSumSection(ingredient.quantity, entry ?? null, db)
		: null;
	// A sum shows its total even for an ingredient the database lacks.
	if (!entry && !sum) return null;

	const sections: string[] = [
		entry
			? `**\`@${ingredient.name}\`** — _${entry.name}_`
			: `**\`@${ingredient.name}\`**`,
	];

	const nutrition = entry ? buildNutritionSection(entry) : null;
	if (nutrition) sections.push(nutrition);

	const qty = isQuantity(ingredient.quantity) ? ingredient.quantity : null;
	if (entry && qty?.unit) {
		const conversion = buildConversionSection(qty, entry, qty.unit, db);
		if (conversion) sections.push(conversion);
	}
	if (sum) sections.push(sum);

	const contents: MarkupContent = {
		kind: MarkupKind.Markdown,
		value: sections.join("\n\n---\n\n"),
	};
	return { contents };
}

import {
	type Hover,
	type MarkupContent,
	MarkupKind,
	type Position,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { positionToOffset } from "../utils/position";
import { collectIngredients } from "../utils/ast-walker";
import { compiledRatios } from "../utils/ratios";
import type { IngredientDB, IngredientEntry } from "../ingredient-loader";
import { formatTerms, normalizeUnit, termsTotal } from "@gram-lang/i18n";
import {
	getIngredientData,
	NUTRIENTS,
	standardizeMass,
	weighAmount,
} from "@gram-lang/analyzer";
import {
	type CompoundQuantityAST,
	isCompoundQuantity,
	isRatioQuantity,
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
		// Each kind adds up, and takes away, on its own: show what each comes
		// to (`1 cup - 2 tbsp + 30 g` is 14 tbsp of volume and 30 g of weight).
		const kinds = termsByFamily(sum.terms).map((group) => {
			const kindTotal = termsTotal(group);
			const amount = kindTotal
				? formatTerms([{ value: kindTotal.qty, unit: kindTotal.unit }])
				: formatTerms(group);
			return `**${amount}** _(${familyName(group[0]?.unit ?? null)})_`;
		});
		lines.push(
			`**Total**: ${written} = ${kinds.join(" + ")}, counted apart: each kind adds up and takes away on its own`,
		);
	}

	if (entry) {
		// Weighed as the views weigh it (`weighAmount`), so the hover can never
		// tell another mass, nor call exact what they call an estimate.
		const weighed = weighAmount(sum.terms, db, entry.name);
		if (weighed && weighed.normalizedMass > 0) {
			const density =
				weighed.isEstimate &&
				sum.terms.some((term) => familyOf(term.unit) === "volume")
					? entry.physical?.density
					: undefined;
			lines.push(
				`**Conversion**: ${written} ${weighed.isEstimate ? "≈" : "="} **${Math.round(weighed.normalizedMass)} g**${density ? ` _(density: ${density} g/ml)_` : ""}`,
			);
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

/**
 * A ratio with units (`1 / 100 g @&flour`): as written, then the amount it
 * came to, or the warning that says why it did not.
 */
function buildRatioSection(
	state: DocumentState,
	quantity: unknown,
): string | null {
	const q = quantity as Parameters<typeof isRatioQuantity>[0];
	if (!isRatioQuantity(q) || !q.loc) return null;
	const start = q.loc.start;
	const ratio = compiledRatios(state).find((r) => r.spec.loc?.start === start);
	if (ratio?.resolved) return `**Ratio**: \`${q.raw}\` = **${ratio.resolved}**`;
	const warning = state.compilation?.warnings.find(
		(w) => w.loc?.start === start && !w.loc?.uri,
	);
	return `**Ratio**: \`${q.raw}\`${warning ? ` — ${warning.message}` : ""}`;
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
		Object.keys(db).length > 0 ? getIngredientData(ingredient.name, db) : null;
	const sum = isCompoundQuantity(ingredient.quantity)
		? buildSumSection(ingredient.quantity, entry ?? null, db)
		: null;
	const ratio = buildRatioSection(state, ingredient.quantity);
	// A sum or a ratio shows what it comes to even for an ingredient the
	// database lacks.
	if (!entry && !sum && !ratio) return null;

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
	if (ratio) sections.push(ratio);

	const contents: MarkupContent = {
		kind: MarkupKind.Markdown,
		value: sections.join("\n\n---\n\n"),
	};
	return { contents };
}

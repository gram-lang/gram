import {
	slugify,
	round2,
	termsByFamily,
	type TargetConverter,
} from "@gram-lang/kitchen";
import type { Meta } from "@gram-lang/parser";
import {
	convertUnitInFamily,
	isMeasureUnit,
	normalizeUnit,
	type Term,
	termsTotal,
	termValueNumber,
	UNIT_CONVERSIONS,
	unitContainsQuantity,
} from "@gram-lang/i18n";

import { getIngredientData } from "./ingredient_db";
import type { IngredientData } from "./types";

/**
 * Mass Normalization Module
 *
 * Responsible for converting physical mass units into a standard Gram unit (g).
 */

export interface ConversionResult {
	mass: number;
	method: "physical" | "density" | "unit_weight" | "default" | "explicit";
}

/**
 * Converts a value between two unit strings. Same-family conversions
 * (mass-to-mass, or volume-to-volume) use the UNIT_CONVERSIONS table alone.
 * Crossing families (mass <-> volume) additionally requires a `density`
 * (g/mL) — pass the ingredient's resolved density (see
 * `resolveIngredientDensity`) to bridge it. Without one, cross-family
 * conversions return null rather than guess — callers should surface that as
 * a distinct error.
 *
 * `lang` (the recipe's own language, e.g. from frontmatter/config) resolves
 * `fromUnit`/`toUnit` against that language's dictionary first — see
 * `normalizeUnit`'s own doc comment for why this matters when an alias
 * collides across languages.
 */
export function convertUnit(
	value: number,
	fromUnit: string,
	toUnit: string,
	density?: number,
	lang?: string,
): number | null {
	const inFamily = convertUnitInFamily(value, fromUnit, toUnit, lang);
	if (inFamily !== null) return inFamily;
	if (density === undefined || density <= 0) return null;

	// Cross-family: bridge through grams using the density (g/mL).
	const from = normalizeUnit(fromUnit, lang);
	const to = normalizeUnit(toUnit, lang);
	const massMap: Record<string, number> = UNIT_CONVERSIONS.mass.map;
	const volMap: Record<string, number> = UNIT_CONVERSIONS.volume.map;
	const fromMass = massMap[from];
	const toMass = massMap[to];
	const fromVol = volMap[from];
	const toVol = volMap[to];
	if (fromMass !== undefined && toVol !== undefined) {
		return (value * fromMass) / density / toVol;
	}
	if (fromVol !== undefined && toMass !== undefined) {
		return (value * fromVol * density) / toMass;
	}
	return null;
}

export interface DensityResolution {
	density: number;
	isEstimate: boolean;
}

/**
 * Resolves an ingredient's density (g/mL), checking recipe-level overrides
 * (frontmatter `densities:`, see `parseDensityOverrides`) before falling back
 * to the ingredient database. Shared by `standardizeMass` and by
 * density-aware unit conversion (e.g. reverse scaling across mass <-> volume).
 */
export function resolveIngredientDensity(
	ingredientName: string,
	database: Record<string, IngredientData>,
	overrides?: Record<string, number>,
): DensityResolution | null {
	const slug = slugify(ingredientName);
	const overrideDensity = overrides ? overrides[slug] : undefined;
	if (overrideDensity !== undefined) {
		return { density: overrideDensity, isEstimate: false };
	}

	const data = getIngredientData(ingredientName, database);
	if (data?.physical?.density) {
		return { density: data.physical.density, isEstimate: true };
	}

	return null;
}

export interface UnitWeightResolution {
	unitWeight: number;
	isEstimate: boolean;
}

/**
 * Resolves the weight of one piece of an ingredient (g), checking the
 * recipe-level overrides (frontmatter `densities:`, read as a unit weight for
 * a count, as `standardizeMass` reads it) before the ingredient database.
 * The mirror of `resolveIngredientDensity`.
 */
export function resolveIngredientUnitWeight(
	ingredientName: string,
	database: Record<string, IngredientData>,
	overrides?: Record<string, number>,
): UnitWeightResolution | null {
	const override = overrides ? overrides[slugify(ingredientName)] : undefined;
	if (override !== undefined)
		return { unitWeight: override, isEstimate: false };
	const unitWeight = getIngredientData(ingredientName, database)?.physical
		?.unit_weight;
	return unitWeight ? { unitWeight, isEstimate: true } : null;
}

/**
 * The analyzer's converter for the ratios kitchen cannot resolve alone
 * (`resolveRatios` in `@gram-lang/kitchen`): an amount of a target in its own
 * unit, into the unit of a ratio's denominator. Within one family, as
 * kitchen; across families through the target's weight in grams
 * (`standardizeMass`: a density for a volume, a unit weight for a piece),
 * then back into the denominator's unit (the density again, or the weight of
 * one piece). `null` when a density or a unit weight is missing: the ratio
 * then says which.
 */
export function analyzerConverter(
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	lang?: string,
): TargetConverter {
	return (targetId) => (value, fromUnit, toUnit) => {
		const inFamily = convertUnitInFamily(value, fromUnit, toUnit, lang);
		if (inFamily !== null) return inFamily;

		const grams = standardizeMass(
			value,
			fromUnit || "unit",
			database,
			targetId,
			overrides,
			lang,
		)?.mass;
		if (grams === undefined) return null;

		const to = normalizeUnit(toUnit, lang);
		const toMass = UNIT_CONVERSIONS.mass.map[to];
		if (toMass !== undefined) return grams / toMass;
		const toVol = UNIT_CONVERSIONS.volume.map[to];
		if (toVol !== undefined) {
			const density = resolveIngredientDensity(targetId, database, overrides);
			return density ? grams / density.density / toVol : null;
		}
		if (isMeasureUnit(toUnit, lang) || unitContainsQuantity(toUnit, lang)) {
			return null;
		}
		const piece = resolveIngredientUnitWeight(targetId, database, overrides);
		return piece ? grams / piece.unitWeight : null;
	};
}

/**
 * Parses recipe-level density overrides from frontmatter (e.g.
 * `densities: [water:1.0]`) into a slug -> density (g/mL) map.
 */
export function parseDensityOverrides(meta: Meta): Record<string, number> {
	const overrides: Record<string, number> = {};
	if (!meta?.densities) return overrides;

	const list = Array.isArray(meta.densities)
		? meta.densities
		: [meta.densities];
	list.forEach((entry) => {
		if (typeof entry !== "string") return;
		const parts = entry.split(":");
		if (parts.length === 2) {
			const name = slugify(parts[0] || "");
			const density = parseFloat((parts[1] || "").trim());
			if (!Number.isNaN(density)) {
				overrides[name] = density;
			}
		}
	});
	return overrides;
}

export function standardizeMass(
	amount: number,
	unit: string,
	database: Record<string, IngredientData>,
	ingredientName?: string,
	overrides?: Record<string, number>,
	lang?: string,
): (ConversionResult & { isEstimate: boolean }) | null {
	if (!unit) {
		return null;
	}

	const u = normalizeUnit(unit, lang);

	// 1. Physical Mass
	const massMap: Record<string, number> = UNIT_CONVERSIONS.mass.map;
	const massFactor = massMap[u];
	if (massFactor !== undefined) {
		return { mass: amount * massFactor, method: "physical", isEstimate: false };
	}

	// 2. Volume -> Density
	const volMap: Record<string, number> = UNIT_CONVERSIONS.volume.map;
	const volFactor = volMap[u];
	if (volFactor !== undefined) {
		const volumeMl = amount * volFactor;
		if (ingredientName) {
			const resolved = resolveIngredientDensity(
				ingredientName,
				database,
				overrides,
			);
			if (resolved) {
				return {
					mass: volumeMl * resolved.density,
					method: resolved.isEstimate ? "density" : "explicit",
					isEstimate: resolved.isEstimate,
				};
			}
		}

		// If we reach here, we have a volume unit but NO density available.
		// We refuse to blindly guess (e.g. density=1.0) because it creates false
		// aggregations in shopping lists (e.g. 1 cup of flour != 240g).
		// By returning null, the item will be listed by its raw unit.
		return null;
	}

	// 3. Fallback: Treat unknown units as Count/Unit units
	// e.g. "clove", "head", "stick", "slice" -> treated as "1 unit" multiplier
	//
	// Not a unit that holds a quantity of its own (`1 boîte de 400 g`,
	// `2 8oz tins`): one tin is not one piece of the ingredient, and its unit
	// weight gave a wrong mass in silence (1 tin of 400 g counted 100 g),
	// summed as such into the shopping list. Its mass stays unknown until Gram
	// reads the quantity inside the unit (see the roadmap).
	if (unitContainsQuantity(unit, lang)) return null;

	if (ingredientName) {
		// Check overrides first
		const slug = slugify(ingredientName);
		const unitWt = overrides ? overrides[slug] : undefined;
		if (unitWt !== undefined) {
			return {
				mass: amount * unitWt,
				method: "explicit",
				// This override branch only runs for non-volume units, so `unitWt` is
				// assumed to be a unit weight (g/unit), not a density (g/mL).
				isEstimate: false,
			};
		}

		const data = getIngredientData(ingredientName, database);
		if (data?.physical?.unit_weight) {
			return {
				mass: amount * data.physical.unit_weight,
				method: "unit_weight",
				isEstimate: true,
			};
		}
	}

	return null;
}

export interface YieldedMass {
	normalizedMass: number;
	purchasingMass?: number;
}

/**
 * Applies the yield (waste factor) to a standardized mass, distinguishing between:
 * - `unit_weight` conversions (e.g. "1 avocado"), which represent the whole purchased
 *   unit — i.e. Gross Mass. The recipe/nutrition-facing Net Mass is derived forward
 *   by multiplying by yield.
 * - Any other conversion (explicit grams, volume+density), which represents what the
 *   recipe author put in the bowl — i.e. Net Mass. The purchasing Gross Mass is
 *   derived backward by dividing by yield.
 */
export function applyYield(
	mass: number,
	method: ConversionResult["method"],
	yieldFactor?: number,
): YieldedMass {
	if (yieldFactor === undefined || yieldFactor <= 0 || yieldFactor >= 1) {
		return { normalizedMass: mass };
	}
	if (method === "unit_weight") {
		return {
			normalizedMass: round2(mass * yieldFactor),
			purchasingMass: mass,
		};
	}
	return {
		normalizedMass: mass,
		purchasingMass: round2(mass / yieldFactor),
	};
}

/** The mass of one part of an amount, as `standardizeMass` found it. */
export interface TermMass {
	/** The part weighed: a family's total (`14 tbsp` for `1 cup - 2 tbsp`). */
	term: Term;
	/** Grams, always positive: `term.minus` says whether it is taken away. */
	mass: number;
	method: ConversionResult["method"];
	isEstimate: boolean;
}

/** What an amount weighs, term by term (`massOf`). */
export interface AmountMass {
	/** The terms whose mass is known, in their written order. */
	known: TermMass[];
	/** The terms whose mass is unknown (a volume with no density, a unit with no weight). */
	unknown: Term[];
}

/**
 * The terms an amount is weighed by: one per family (`termsByFamily`), its
 * terms added up (`termsTotal`), so `{1 cup - 2 tbsp}` is weighed as the
 * `14 tbsp` it amounts to, exactly as a quantity written that way. A family
 * whose terms do not add up (a term with no unit next to one with a unit)
 * keeps its terms as written; a negative total is a term taken away.
 */
function weighableTerms(terms: readonly Term[]): Term[] {
	return termsByFamily(terms).flatMap((group) => {
		const total = group.length > 1 ? termsTotal(group) : null;
		if (!total) return group;
		const n = termValueNumber(total.qty);
		return n !== null && n < 0
			? [{ value: -n, unit: total.unit, minus: true }]
			: [{ value: total.qty, unit: total.unit }];
	});
}

/**
 * The mass of an amount, family by family (`{1 cup + 20 g}`,
 * `{1 cup - 2 tbsp}`, see `weighableTerms`): each goes through
 * `standardizeMass`, so a sum over several families weighs what its parts
 * weigh, as occurrences written apart would. A term with no unit counts as
 * a piece (`unit`), like a quantity with none; a range counts by its middle.
 *
 * A term `standardizeMass` cannot weigh is listed in `unknown`, so a caller
 * tells a complete mass from a partial one: `{1 cup + 20 g}` of an
 * ingredient with no density is not 20 g.
 */
export function massOf(
	terms: readonly Term[],
	database: Record<string, IngredientData>,
	ingredientName?: string,
	overrides?: Record<string, number>,
	lang?: string,
): AmountMass {
	const result: AmountMass = { known: [], unknown: [] };
	for (const term of weighableTerms(terms)) {
		const amount = termValueNumber(term.value);
		const norm =
			amount === null
				? null
				: standardizeMass(
						amount,
						term.unit || "unit",
						database,
						ingredientName,
						overrides,
						lang,
					);
		if (norm) {
			result.known.push({
				term,
				mass: norm.mass,
				method: norm.method,
				isEstimate: norm.isEstimate,
			});
		} else {
			result.unknown.push(term);
		}
	}
	return result;
}

/** A complete mass, its waste factor applied (`weighAmount`). */
export interface WeighedAmount extends YieldedMass {
	method: ConversionResult["method"] | "estimate";
	isEstimate: boolean;
}

/**
 * What an amount weighs once its waste factor is applied, or `null` when
 * any term has no known mass (a partial mass would read as the whole: an
 * ingredient's `1 cup + 20 g` with no density is not 20 g), when there is
 * no term, or when the total is negative.
 *
 * The yield is applied term by term (`applyYield`): a unit weight is a
 * gross mass, any other a net one, and one sum can hold both. The method is
 * the terms' own when they share one, else `estimate` if any term is one,
 * else `explicit` if any term is, else `physical`.
 */
export function weighAmount(
	terms: readonly Term[],
	database: Record<string, IngredientData>,
	ingredientName?: string,
	overrides?: Record<string, number>,
	lang?: string,
	yieldFactor?: number,
): WeighedAmount | null {
	const { known, unknown } = massOf(
		terms,
		database,
		ingredientName,
		overrides,
		lang,
	);
	if (unknown.length > 0 || known.length === 0) return null;

	let normalizedMass = 0;
	let purchasingMass = 0;
	let hasPurchasing = false;
	for (const { term, mass, method } of known) {
		const sign = term.minus ? -1 : 1;
		const yielded = applyYield(mass, method, yieldFactor);
		normalizedMass += sign * yielded.normalizedMass;
		purchasingMass += sign * (yielded.purchasingMass ?? yielded.normalizedMass);
		if (yielded.purchasingMass !== undefined) hasPurchasing = true;
	}
	// A sum Gram accepted never weighs less than nothing; a guard all the same.
	if (normalizedMass < 0) return null;

	const methods = new Set(known.map((k) => k.method));
	const isEstimate = known.some((k) => k.isEstimate);
	const method =
		methods.size === 1
			? known[0]!.method
			: isEstimate
				? "estimate"
				: methods.has("explicit")
					? "explicit"
					: "physical";

	const weighed: WeighedAmount = { normalizedMass, method, isEstimate };
	if (hasPurchasing) weighed.purchasingMass = purchasingMass;
	return weighed;
}

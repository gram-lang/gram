import { slugify, round2 } from "@gram-lang/kitchen";
import type { Meta } from "@gram-lang/parser";
import { normalizeUnit, UNIT_CONVERSIONS } from "@gram-lang/i18n";

import { getIngredientData } from "./ingredient_db";
import type { IngredientData } from "./types";

/**
 * Mass Normalization Module
 *
 * Responsible for converting physical mass units into a standard Gram unit (g).
 */

interface ConversionResult {
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
	const from = normalizeUnit(fromUnit, lang);
	const to = normalizeUnit(toUnit, lang);
	if (from === to) return value;

	const massMap: Record<string, number> = UNIT_CONVERSIONS.mass.map;
	const volMap: Record<string, number> = UNIT_CONVERSIONS.volume.map;

	const fromMass = massMap[from];
	const toMass = massMap[to];
	if (fromMass !== undefined && toMass !== undefined) {
		return (value * fromMass) / toMass;
	}

	const fromVol = volMap[from];
	const toVol = volMap[to];
	if (fromVol !== undefined && toVol !== undefined) {
		return (value * fromVol) / toVol;
	}

	if (density === undefined || density <= 0) return null;

	// Cross-family: bridge through grams using the density (g/mL).
	if (fromMass !== undefined && toVol !== undefined) {
		const grams = value * fromMass;
		return grams / density / toVol;
	}
	if (fromVol !== undefined && toMass !== undefined) {
		const grams = value * fromVol * density;
		return grams / toMass;
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

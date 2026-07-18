import type { Usage } from "./types";
import { round2 } from "./utils";

export interface AggregatedIngredient {
	id: string;
	name: string;
	type?: string; // 'reference' for cross-section intermediates, undefined for regular ingredients
	preparation?: string | null;
	// Raw Usage.composite.parent name, when this entry is a composite child (e.g. "citron")
	parent?: string;
	// Raw Usage.composite.preparation — a preparation on the PARENT itself (e.g.
	// "cut in half"), distinct from this entry's own `preparation` above.
	parentPreparation?: string | null;
	// null = unmeasured (Rule 2: dedup); array = measured occurrences in order (Rule 1: addition)
	// Rule 3 (segregation): a given id can have both an unmeasured entry AND a measured entry simultaneously
	quantities: Array<{
		qty: NonNullable<Usage["qty"]>;
		unit?: string | null;
	}> | null;
	normalizedMass?: number;
	conversionMethod?: string;
	isEstimate?: boolean;
	bakersPercentage?: number;
}

// Fields shared by every fresh entry, whether measured or unmeasured — kept in
// one place so the measured/unmeasured branches below can never drift apart.
function createBaseEntry(
	ing: Usage,
	name: string,
): Pick<
	AggregatedIngredient,
	"id" | "name" | "type" | "preparation" | "parent" | "parentPreparation"
> {
	return {
		id: ing.id,
		name,
		type: ing.type,
		preparation: ing.preparation,
		parent: ing.composite?.parent,
		parentPreparation: ing.composite?.preparation,
	};
}

/**
 * Aggregates a flat list of section Usage items into display-ready entries:
 *
 *   Rule 1 — Addition:    measured + measured → one entry, quantities joined with '+'
 *   Rule 2 — Dedup:       unmeasured + unmeasured → one entry
 *   Rule 3 — Segregation: measured ≠ unmeasured → always two separate entries
 *
 * Insertion order from the source list is preserved.
 * Grouping is done by `id` AND `preparation`.
 */
export function aggregateSectionIngredients(
	ingredients: Usage[],
): AggregatedIngredient[] {
	const measuredByKey = new Map<string, AggregatedIngredient>();
	const unmeasuredByKey = new Map<string, AggregatedIngredient>();
	const order: AggregatedIngredient[] = [];

	for (const ing of ingredients) {
		if (ing.type === "composite" || ing.type === "alternative") continue;

		const name = ing.name ?? ing.id;
		const hasMeasuredQty = ing.qty != null;
		const key = ing.preparation ? `${ing.id}::${ing.preparation}` : ing.id;

		if (hasMeasuredQty) {
			const existing = measuredByKey.get(key);
			if (existing) {
				existing.quantities!.push({ qty: ing.qty!, unit: ing.unit ?? null });
				if (ing.normalizedMass) {
					existing.normalizedMass =
						(existing.normalizedMass || 0) + ing.normalizedMass;
					if (ing.isEstimate) existing.isEstimate = true;
				}
				// Baker's percentage is linear in mass for a fixed reference, so it
				// sums exactly like normalizedMass above — it must not just carry
				// over the first occurrence's value once more are merged in.
				if ((ing as any).bakersPercentage !== undefined) {
					existing.bakersPercentage = round2(
						(existing.bakersPercentage || 0) + (ing as any).bakersPercentage,
					);
				}
			} else {
				const entry: AggregatedIngredient = {
					...createBaseEntry(ing, name),
					quantities: [{ qty: ing.qty!, unit: ing.unit ?? null }],
					normalizedMass: ing.normalizedMass,
					conversionMethod: ing.conversionMethod,
					isEstimate: ing.isEstimate,
					bakersPercentage: (ing as any).bakersPercentage,
				};
				measuredByKey.set(key, entry);
				order.push(entry);
			}
		} else {
			if (!unmeasuredByKey.has(key)) {
				const entry: AggregatedIngredient = {
					...createBaseEntry(ing, name),
					quantities: null,
				};
				unmeasuredByKey.set(key, entry);
				order.push(entry);
			}
		}
	}

	return order;
}

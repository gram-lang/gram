import type { QuantityPart } from "./terms";
import type { StepToken, Usage } from "./types";
import { round2 } from "./utils";

export interface AggregatedIngredient {
	id: string;
	// Absent unless the source Usage carried its own name (e.g. an alternative
	// option) — createCleanUsage() never sets it for a regular ingredient, so
	// callers must fall back to a registry lookup by `id` for display, the way
	// the renderer's ingredient/cookware strategies already do.
	name?: string;
	type?: string; // 'reference' for cross-section intermediates, undefined for regular ingredients
	preparation?: string | null;
	// Raw Usage.composite.parent name, when this entry is a composite child (e.g. "citron")
	parent?: string;
	// Raw Usage.composite.preparation — a preparation on the PARENT itself (e.g.
	// "cut in half"), distinct from this entry's own `preparation` above.
	parentPreparation?: string | null;
	// null = unmeasured (Rule 2: dedup); array = measured mentions in order, one
	// per mention, never added up (Rule 1: listing)
	// Rule 3 (segregation): a given id can have both an unmeasured entry AND a measured entry simultaneously
	quantities: Array<{
		/** Absent for a sum with no single total (`{1 cup + 20 g}`, or refused). */
		qty?: NonNullable<Usage["qty"]>;
		unit?: string | null;
		/** The terms of a sum (`{1 cup + 1 tbsp}`), as on its `Usage`. Since 1.5.0. */
		parts?: QuantityPart[];
	}> | null;
	normalizedMass?: number;
	conversionMethod?: string;
	isEstimate?: boolean;
	bakersPercentage?: number;
	// Present when type === "alternative" — the raw per-option Usage objects
	// (each already shaped like a regular ingredient/cookware usage), passed
	// through untouched for the renderer's "alternative" strategy to join.
	options?: StepToken[];
}

// Fields shared by every fresh entry, whether measured or unmeasured — kept in
// one place so the measured/unmeasured branches below can never drift apart.
function createBaseEntry(
	ing: Usage,
	name: string | undefined,
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

type SectionQuantity = NonNullable<AggregatedIngredient["quantities"]>[number];

/**
 * One mention as a section lists it: its amount as the step wrote it (a sum
 * keeps its `parts`), never added to the others. Two mentions of `100 g` are
 * often two portions to weigh: the section shows both, the shopping list
 * adds them up.
 */
function quantityOfMention(ing: Usage): SectionQuantity {
	const quantity: SectionQuantity = {};
	if (ing.qty != null) quantity.qty = ing.qty;
	quantity.unit = ing.unit ?? null;
	if (ing.parts?.length) quantity.parts = ing.parts;
	return quantity;
}

/**
 * Aggregates a flat list of section Usage items into display-ready entries:
 *
 *   Rule 1 — Listing:     measured + measured → one entry listing every
 *                         mention as written (`100 g` and `100 g`: two
 *                         portions to weigh); the shopping list adds them up
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
		if (ing.type === "composite") continue;

		if (ing.type === "alternative") {
			// Every alternative group shares the literal id "alternative" (see
			// processAlternative in kitchen/src/processor.ts), so it can't go
			// through the measured/unmeasured id-keyed maps below without two
			// unrelated alternative groups in the same section colliding into
			// one merged entry. Each occurrence is its own standalone line —
			// the shopping list already treats alternatives the same way.
			order.push({
				id: ing.id,
				name: ing.name,
				type: ing.type,
				quantities: null,
				options: ing.options,
			});
			continue;
		}

		const name = ing.name;
		const hasMeasuredQty = ing.qty != null || !!ing.parts?.length;
		const key = ing.preparation ? `${ing.id}::${ing.preparation}` : ing.id;

		if (hasMeasuredQty) {
			const existing = measuredByKey.get(key);
			if (existing) {
				existing.quantities!.push(quantityOfMention(ing));
				if (ing.normalizedMass) {
					existing.normalizedMass =
						(existing.normalizedMass || 0) + ing.normalizedMass;
					if (ing.isEstimate) existing.isEstimate = true;
				}
				// Baker's percentage is linear in mass for a fixed reference, so it
				// sums exactly like normalizedMass above — it must not just carry
				// over the first occurrence's value once more are merged in.
				if (ing.bakersPercentage !== undefined) {
					existing.bakersPercentage = round2(
						(existing.bakersPercentage || 0) + ing.bakersPercentage,
					);
				}
			} else {
				const entry: AggregatedIngredient = {
					...createBaseEntry(ing, name),
					quantities: [quantityOfMention(ing)],
					normalizedMass: ing.normalizedMass,
					conversionMethod: ing.conversionMethod,
					isEstimate: ing.isEstimate,
					bakersPercentage: ing.bakersPercentage,
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

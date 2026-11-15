import type { StepToken, Usage } from "./types";
import { mergeTerms, type Term } from "@gram-lang/i18n";
import { isRefusedSum, termsOfParts, termsOfUsage } from "./terms";
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
	// null = unmeasured (Rule 2: dedup); array = measured occurrences in order (Rule 1: addition)
	// Rule 3 (segregation): a given id can have both an unmeasured entry AND a measured entry simultaneously
	quantities: Array<{
		qty: NonNullable<Usage["qty"]>;
		unit?: string | null;
		/** A term taken away (`- 2 tbsp` in `{1 cup - 2 tbsp}`). Since 1.5.0. */
		minus?: true;
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

/** A term as a section lists it. */
function quantityOfTerm(term: Term): SectionQuantity {
	return term.minus
		? { qty: term.value, unit: term.unit, minus: true }
		: { qty: term.value, unit: term.unit };
}

/**
 * What the occurrences of one entry add up to, kept apart until the entry is
 * complete: the terms that add up, and what is listed as written.
 */
interface EntryAmounts {
	/** The terms of every occurrence that adds up (`mergeTerms("unit")`). */
	terms: Term[];
	/**
	 * Listed as written, after the terms: a sum Gram refused (it counts for
	 * nothing, but the reader still sees it), a text (`{une pincée}`) or a
	 * relative quantity (`{10%}`).
	 */
	asWritten: SectionQuantity[];
}

function addOccurrence(amounts: EntryAmounts, ing: Usage): void {
	if (isRefusedSum(ing)) {
		amounts.asWritten.push(...termsOfParts(ing.parts).map(quantityOfTerm));
		return;
	}
	const terms = termsOfUsage(ing);
	if (terms.length > 0) amounts.terms.push(...terms);
	else amounts.asWritten.push({ qty: ing.qty!, unit: ing.unit ?? null });
}

/**
 * The quantities of an entry: the terms of one unit added up (`100 g` and
 * `100 g` give `200 g`, a term taken away comes off its own unit), terms
 * added before terms taken away, then what is listed as written.
 */
function entryQuantities(amounts: EntryAmounts): SectionQuantity[] {
	return [
		...mergeTerms(amounts.terms, "unit").map(quantityOfTerm),
		...amounts.asWritten,
	];
}

/**
 * Aggregates a flat list of section Usage items into display-ready entries:
 *
 *   Rule 1 — Addition:    measured + measured → one entry, the terms of each
 *                         unit added up (`100 g` + `100 g` → `200 g`), units
 *                         kept apart (`1 cup` + `2 tbsp`)
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
	const amountsOf = new Map<AggregatedIngredient, EntryAmounts>();

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
				addOccurrence(amountsOf.get(existing)!, ing);
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
					quantities: [],
					normalizedMass: ing.normalizedMass,
					conversionMethod: ing.conversionMethod,
					isEstimate: ing.isEstimate,
					bakersPercentage: ing.bakersPercentage,
				};
				const amounts: EntryAmounts = { terms: [], asWritten: [] };
				addOccurrence(amounts, ing);
				amountsOf.set(entry, amounts);
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

	for (const [entry, amounts] of amountsOf) {
		entry.quantities = entryQuantities(amounts);
	}

	return order;
}

import type {
	MiseEnPlaceItem,
	ProcessedSection,
	Registry,
	SectionMiseEnPlace,
	StepToken,
	TimeBreakdownItem,
	Usage,
} from "./types";
import { addToBreakdown, slugify } from "./utils";

// Tracks the ingredient's stable `id` rather than a display name — the label is
// resolved to a name via the registry at render time, the same way every other
// ingredient reference in the compiled output is (shopping list, section lists).
const countPrep = (
	item: StepToken | undefined,
): { duration: number; id?: string } => {
	let localTime = 0;
	if (!item || typeof item === "string") return { duration: 0 };

	let itemId = "id" in item ? item.id : undefined;

	const options = "options" in item ? item.options : undefined;
	if (options && Array.isArray(options)) {
		// For alternative choices, take the longest preparation path
		let maxOpt = 0;
		options.forEach((opt) => {
			const res = countPrep(opt);
			if (res.duration > maxOpt) {
				maxOpt = res.duration;
				if (res.id) itemId = res.id;
			}
		});
		localTime += maxOpt;
	} else if (
		!item.type &&
		"id" in item &&
		item.id &&
		"preparation" in item &&
		item.preparation
	) {
		// createCleanUsage never sets `.type` on a plain ingredient, so an
		// `item.type === "ingredient"` check would always be dead — this is
		// the only branch that ever actually adds the 2min preparation
		// overhead for a non-alternative ingredient.
		localTime += 2;
	}

	return { duration: localTime, id: itemId };
};

// Ids a usage touches: itself, every option of an alternative, and the parent
// of a composite (resolved through the same slugify the registry uses).
const collectUsageIds = (usage: Usage | StepToken, out: Set<string>): void => {
	if (!usage || typeof usage === "string" || !("id" in usage)) return;
	if (usage.id) out.add(usage.id);
	if ("composite" in usage && usage.composite?.parent) {
		out.add(slugify(usage.composite.parent));
	}
	if ("options" in usage && Array.isArray(usage.options)) {
		for (const opt of usage.options) collectUsageIds(opt, out);
	}
};

/**
 * Splits the mise en place cost by section. Each registry ingredient/cookware
 * is gathered by the first section that touches it (an id never touched goes
 * to the first section that has steps), and each ingredient `preparation` is
 * charged to the section it appears in. A section without a real step never
 * carries a cost (there would be nothing to schedule it before): its share
 * moves to the first section that has steps, and a recipe with no step at all
 * has no mise en place.
 */
export function computeMiseEnPlace(
	sections: ProcessedSection[],
	registry: Registry,
): SectionMiseEnPlace[] {
	const hasSteps = (sec: ProcessedSection) =>
		sec.steps.some((s) => s.type === "step");
	const fallbackIdx = sections.findIndex(hasSteps);
	// -1 when no section has a step: nothing can carry the cost.
	const resolveOwner = (idx: number | undefined): number =>
		idx !== undefined && sections[idx] && hasSteps(sections[idx])
			? idx
			: fallbackIdx;

	const ingredientOwner = new Map<string, number>();
	const cookwareOwner = new Map<string, number>();

	// The section that makes each intermediate (`->&dough`).
	const producerOf = new Map<string, number>();
	sections.forEach((sec, idx) => {
		if (!sec.intermediate_preparation) return;
		const id = slugify(sec.intermediate_preparation);
		if (!producerOf.has(id)) producerOf.set(id, idx);
	});

	sections.forEach((sec, idx) => {
		const touched = new Set<string>();
		for (const u of sec.ingredients) collectUsageIds(u, touched);
		for (const step of sec.steps) {
			if (step.type === "step") {
				for (const c of step.content) collectUsageIds(c, touched);
			}
		}
		for (const id of touched) {
			// An intermediate is fetched where it is used, not where it is made:
			// the section producing it doesn't count as a use.
			if (producerOf.get(id) === idx) continue;
			if (registry.ingredients.has(id) && !ingredientOwner.has(id)) {
				ingredientOwner.set(id, idx);
			}
		}

		const touchedCookware = new Set<string>();
		for (const u of sec.cookware) collectUsageIds(u, touchedCookware);
		for (const id of touchedCookware) {
			if (registry.cookware.has(id) && !cookwareOwner.has(id)) {
				cookwareOwner.set(id, idx);
			}
		}
	});

	// Every ingredient is gone and fetched (weighed, set on the counter) once,
	// in the first section that uses it. That holds for an intermediate too —
	// 100 g of `&dough` still has to be weighed out — but at the section that
	// uses it, not the one that makes it. An intermediate nobody reuses stays
	// with its own section, so the total never depends on how it is used.
	const ingredientCount = new Map<number, number>();
	for (const id of registry.ingredients.keys()) {
		const owner = resolveOwner(ingredientOwner.get(id) ?? producerOf.get(id));
		if (owner === -1) continue;
		ingredientCount.set(owner, (ingredientCount.get(owner) ?? 0) + 1);
	}
	const cookwareCount = new Map<number, number>();
	for (const id of registry.cookware.keys()) {
		const owner = resolveOwner(cookwareOwner.get(id));
		if (owner === -1) continue;
		cookwareCount.set(owner, (cookwareCount.get(owner) ?? 0) + 1);
	}

	const result: SectionMiseEnPlace[] = [];
	sections.forEach((sec, idx) => {
		const items: MiseEnPlaceItem[] = [];
		const ingredients = ingredientCount.get(idx) ?? 0;
		if (ingredients > 0) {
			items.push({
				kind: "gather",
				target: "ingredient",
				count: ingredients,
				duration: ingredients * 1,
			});
		}
		const cookware = cookwareCount.get(idx) ?? 0;
		if (cookware > 0) {
			items.push({
				kind: "gather",
				target: "cookware",
				count: cookware,
				duration: cookware * 1,
			});
		}

		const prepared = new Map<string, number>();
		for (const step of sec.steps) {
			if (step.type !== "step" || !step.content) continue;
			for (const c of step.content) {
				const prep = countPrep(c);
				if (prep.duration > 0 && prep.id) {
					prepared.set(prep.id, (prepared.get(prep.id) ?? 0) + prep.duration);
				}
			}
		}
		for (const [id, duration] of prepared) {
			// A preparation can sit on cookware too (e.g. a greased pan): the
			// step token doesn't say which, so the registry does.
			const type =
				!registry.ingredients.has(id) && registry.cookware.has(id)
					? "cookware"
					: "ingredient";
			items.push({ kind: "prepare", ref: { type, id }, duration });
		}

		if (items.length > 0) {
			result.push({
				section: idx,
				duration: items.reduce((sum, i) => sum + i.duration, 0),
				items,
			});
		}
	});
	return result;
}

/**
 * Calculates the total active preparation time (in minutes) for a recipe.
 *
 * Derived from `computeMiseEnPlace`: base lookup overhead (gathering
 * ingredients & cookware) plus active preparation times (e.g. chopping,
 * peeling) declared on ingredients.
 */
export function calculatePreparationTime(
	sections: ProcessedSection[],
	registry: Registry,
): { total: number; breakdown: TimeBreakdownItem[] } {
	const breakdown: TimeBreakdownItem[] = [];
	const mise = computeMiseEnPlace(sections, registry);

	let ingredients = 0;
	let cookware = 0;
	const prepared: TimeBreakdownItem[] = [];
	for (const entry of mise) {
		for (const item of entry.items) {
			if (item.kind === "gather") {
				if (item.target === "ingredient") ingredients += item.count;
				else cookware += item.count;
			} else {
				addToBreakdown(prepared, `prep_${item.ref.id}`, item.duration);
			}
		}
	}
	// Base overhead: 1 minute per unique ingredient and cookware item
	addToBreakdown(breakdown, "ingredients_overhead", ingredients * 1);
	addToBreakdown(breakdown, "cookware_overhead", cookware * 1);
	breakdown.push(...prepared);

	const total = breakdown.reduce((sum, b) => sum + b.duration, 0);
	return { total, breakdown };
}

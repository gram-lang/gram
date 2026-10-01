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
): { duration: number; id?: string; usageId?: string } => {
	let localTime = 0;
	if (!item || typeof item === "string") return { duration: 0 };

	let itemId = "id" in item ? item.id : undefined;
	let usageId = "_usageId" in item ? item._usageId : undefined;

	const options = "options" in item ? item.options : undefined;
	if (options && Array.isArray(options)) {
		// For alternative choices, take the longest preparation path
		let maxOpt = 0;
		options.forEach((opt) => {
			const res = countPrep(opt);
			if (res.duration > maxOpt) {
				maxOpt = res.duration;
				if (res.id) itemId = res.id;
				usageId = res.usageId;
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

	return { duration: localTime, id: itemId, usageId };
};

// The `_usageId`s of a section's usages, options of alternatives included.
// An ingredient and a piece of cookware read the same in a step's text (`#moule`
// and `@moule` are both `{ id: "moule" }`); the section's `ingredients` and
// `cookware` lists, whose entries share those `_usageId`s, tell them apart.
const usageIdsOf = (usages: Usage[], out = new Set<string>()): Set<string> => {
	for (const u of usages) {
		if (u._usageId) out.add(u._usageId);
		if (Array.isArray(u.options)) usageIdsOf(u.options as Usage[], out);
	}
	return out;
};

// Ids a usage touches: itself, every option of an alternative, and the parent
// of a composite (resolved through the same slugify the registry uses).
// Usages listed in `skip` (by `_usageId`) are left out. The group of an
// alternative (`a|b`) carries a generic id of its own, which is no registry
// entry: only its options count.
const collectUsageIds = (
	usage: Usage | StepToken,
	out: Set<string>,
	skip?: Set<string>,
): void => {
	if (!usage || typeof usage === "string" || !("id" in usage)) return;
	if ("_usageId" in usage && usage._usageId && skip?.has(usage._usageId)) {
		return;
	}
	const isAlternative = "options" in usage && Array.isArray(usage.options);
	if (usage.id && !isAlternative) out.add(usage.id);
	if ("composite" in usage && usage.composite?.parent) {
		out.add(slugify(usage.composite.parent));
	}
	if ("options" in usage && Array.isArray(usage.options)) {
		for (const opt of usage.options) collectUsageIds(opt, out, skip);
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
 *
 * Public API, like `calculatePreparationTime`: `compile()` returns its result as
 * `miseEnPlace`, and any `ProcessedSection[]` with its registry (e.g. one you
 * built yourself) can be run through it to get the same split. Its signature
 * is stable; how the cost is split between sections may still be refined in a
 * minor version, the same way a compiler fix is.
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

	// The section that makes each intermediate: declared on the section itself
	// (`## Dough ->&dough`) or at the end of one of its steps (`... ->&dough`).
	const producerOf = new Map<string, number>();
	const markProducer = (id: string, idx: number) => {
		if (!producerOf.has(id)) producerOf.set(id, idx);
	};
	sections.forEach((sec, idx) => {
		if (sec.intermediate_preparation) {
			markProducer(slugify(sec.intermediate_preparation), idx);
		}
		for (const step of sec.steps) {
			if (step.type !== "step") continue;
			for (const token of step.content) {
				if (typeof token !== "string" && "type" in token) {
					if (token.type === "declaration") markProducer(token.id, idx);
				}
			}
		}
	});

	sections.forEach((sec, idx) => {
		const cookwareUsages = usageIdsOf(sec.cookware);
		const touched = new Set<string>();
		for (const u of sec.ingredients) collectUsageIds(u, touched);
		for (const step of sec.steps) {
			if (step.type === "step") {
				for (const c of step.content) {
					collectUsageIds(c, touched, cookwareUsages);
				}
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

		const cookwareUsages = usageIdsOf(sec.cookware);
		const prepared = new Map<
			string,
			{ type: "ingredient" | "cookware"; id: string; duration: number }
		>();
		for (const step of sec.steps) {
			if (step.type !== "step" || !step.content) continue;
			for (const c of step.content) {
				const prep = countPrep(c);
				if (prep.duration <= 0 || !prep.id) continue;
				// A preparation can sit on cookware too (e.g. a greased pan). The
				// section's cookware list says so; the registry is only the
				// fallback for a usage without an id, and an ingredient and a
				// piece of cookware sharing a name stay two separate entries.
				const type =
					prep.usageId !== undefined
						? cookwareUsages.has(prep.usageId)
							? "cookware"
							: "ingredient"
						: !registry.ingredients.has(prep.id) &&
								registry.cookware.has(prep.id)
							? "cookware"
							: "ingredient";
				const key = `${type}:${prep.id}`;
				const entry = prepared.get(key);
				if (entry) entry.duration += prep.duration;
				else prepared.set(key, { type, id: prep.id, duration: prep.duration });
			}
		}
		for (const { type, id, duration } of prepared.values()) {
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
 *
 * `mise` is the section split when the caller already has it, so it isn't
 * computed twice.
 */
export function calculatePreparationTime(
	sections: ProcessedSection[],
	registry: Registry,
	mise: SectionMiseEnPlace[] = computeMiseEnPlace(sections, registry),
): {
	total: number;
	/** @deprecated Since 1.4.0, will be removed in 2.0.0. Read the `items` of `computeMiseEnPlace()` instead. (Ref: kitchen-prep-time-breakdown-signature) */
	breakdown: TimeBreakdownItem[];
} {
	const breakdown: TimeBreakdownItem[] = [];

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
	// @remove-in: 2.0.0 [kitchen-prep-time-breakdown-signature]
	return { total, breakdown };
}

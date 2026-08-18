import type { IngredientData } from "./types";
import { resolveCanonicalId } from "./ingredient_db";
import { round2, slugify } from "@gram-lang/kitchen";
import type { CompilationResult, ShoppingListItem } from "@gram-lang/kitchen";

type ShoppingListEntry = CompilationResult["shopping_list"][number];

function isStandardItem(item: ShoppingListEntry): item is ShoppingListItem {
	return (
		!!item &&
		item.type !== "composite" &&
		item.type !== "alternative" &&
		item.type !== "group"
	);
}

/**
 * Decides the display name for an ingredient once it's been resolved to a
 * canonical id. The database's `name` is only a same-word enrichment (e.g.
 * "flour" -> "Wheat Flour") when the recipe already used the canonical word
 * itself. When resolution went through an alias (e.g. "farine" -> "flour"),
 * the database's `name` is a *different* word — possibly a different
 * language entirely — so the recipe's own wording always wins instead.
 */
function resolveDisplayName(
	rawNameOrId: string,
	ownName: string | undefined,
	canonicalId: string,
	canonicalName: string | undefined,
): string | undefined {
	const isDirectMatch = slugify(rawNameOrId) === canonicalId;
	if (isDirectMatch && canonicalName) return canonicalName;
	return ownName ?? canonicalName;
}

/**
 * Re-groups the shopping list produced by `@gram-lang/kitchen` (which groups purely by
 * raw id + unit, with no knowledge of the ingredient database) by CANONICAL id,
 * merging aliased ingredients (e.g. "beurre"/"butter") and cross-unit entries
 * (e.g. "100g" + "1 cup") into a single line whenever every contributing entry
 * already has a resolved `normalizedMass` (in grams).
 *
 * When a group can't be fully resolved to a mass (e.g. one entry has no density/
 * unit_weight available), the entries are left separate but renamed to the
 * canonical id/name and flagged `multiUnit: true`, so renderers can still group
 * them visually. Composite and alternative entries pass through untouched —
 * their own MAX/SUM and first-choice resolution rules are handled upstream by
 * `@gram-lang/kitchen`.
 */
export function aggregateShoppingList(
	shoppingList: ShoppingListEntry[],
	database: Record<string, IngredientData>,
): ShoppingListEntry[] {
	const passthrough: ShoppingListEntry[] = [];
	const standard: ShoppingListItem[] = [];

	shoppingList.forEach((item) => {
		if (isStandardItem(item)) standard.push(item);
		else passthrough.push(item);
	});

	const order: string[] = [];
	const groups = new Map<string, ShoppingListItem[]>();
	standard.forEach((item) => {
		// Trust the compiler-assigned id first when it's already a real
		// database key — needed for a stocked import's synthetic leaf, whose
		// shopping-list `name` is a display override (the module's own title,
		// e.g. "Pâte sablée amande") that doesn't slugify back to `id`
		// ("pate", the local binding name the registry/synthetic-ingredient
		// entry is actually keyed by). Equivalent to the name-based lookup for
		// every ordinary ingredient, where `slugify(name) === id` always holds
		// by construction.
		const canonicalId = database[item.id]
			? item.id
			: resolveCanonicalId(item.name ?? item.id, database);
		if (!groups.has(canonicalId)) {
			groups.set(canonicalId, []);
			order.push(canonicalId);
		}
		groups.get(canonicalId)!.push(item);
	});

	const result: ShoppingListEntry[] = [];
	order.forEach((canonicalId) => {
		const items = groups.get(canonicalId)!;
		const canonicalName = database[canonicalId]?.name;

		if (items.length === 1) {
			const only = items[0]!;
			only.name = resolveDisplayName(
				only.name ?? only.id,
				only.name,
				canonicalId,
				canonicalName,
			);
			only.id = canonicalId;
			result.push(only);
			return;
		}

		const allHaveMass = items.every(
			(i) => typeof i.normalizedMass === "number",
		);
		if (allHaveMass) {
			const totalMass = items.reduce((sum, i) => sum + i.normalizedMass!, 0);
			const totalPurchasing = items.reduce(
				(sum, i) => sum + (i.purchasingMass ?? i.normalizedMass!),
				0,
			);

			const merged: ShoppingListItem = {
				id: canonicalId,
				name: resolveDisplayName(
					items[0]!.name ?? items[0]!.id,
					items[0]!.name,
					canonicalId,
					canonicalName,
				),
				qty: round2(totalMass),
				unit: "g",
				normalizedMass: round2(totalMass),
				isEstimate: items.some((i) => i.isEstimate),
			};
			if (Math.abs(totalPurchasing - totalMass) > 0.001) {
				merged.purchasingMass = round2(totalPurchasing);
			}
			if (items.every((i) => i.fixed)) merged.fixed = true;
			if (items.some((i) => i.relative)) merged.relative = true;

			// ShoppingListItem only ever carries `_usageIds` (plural, set by
			// kitchen's generateShoppingList) — the singular `_usageId` this
			// used to also check for is Usage's own field, never present here.
			const usageIds = items.flatMap((i) => i._usageIds ?? []);
			if (usageIds.length > 0) merged._usageIds = usageIds;

			const modifierUnion = new Set<string>();
			items.forEach((i) => {
				(i.modifiers ?? []).forEach((m) => {
					modifierUnion.add(m);
				});
			});
			// "optional" is an intersection, not a union, like `fixed` above: a
			// merged line is only optional if every contributing entry is —
			// otherwise a required 100g merged with an optional 10g garnish
			// would incorrectly mark the whole 110g line as skippable.
			const modifiers = [...modifierUnion].filter(
				(m) =>
					m !== "optional" ||
					items.every((i) => (i.modifiers ?? []).includes("optional")),
			);
			if (modifiers.length > 0) merged.modifiers = modifiers;

			const variableEntries = items.flatMap((i) => i.variable_entries ?? []);
			if (variableEntries.length > 0) merged.variable_entries = variableEntries;

			result.push(merged);
		} else {
			items.forEach((i) => {
				i.name = resolveDisplayName(
					i.name ?? i.id,
					i.name,
					canonicalId,
					canonicalName,
				);
				i.id = canonicalId;
				i.multiUnit = true;
				result.push(i);
			});
		}
	});

	return [...result, ...passthrough];
}

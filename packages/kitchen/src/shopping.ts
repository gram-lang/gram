import { slugify } from "./utils";
import {
	numericTotal,
	shoppingAmount,
	termsOfComposite,
	termsOfUsage,
	writeSum,
} from "./terms";
import { detectCycles } from "./graph";
import { ASTNodeType } from "@gram-lang/parser";
import {
	groupTerms,
	mergeKey,
	normalizeUnit,
	type Term,
	termsTotal,
} from "@gram-lang/i18n";
import type { ProcessedSection, Registry, Usage } from "./types";
import type { CompilerOptions } from "./core";
import { isPurchasableReference } from "./registry";

export interface ShoppingListItem {
	// Never actually set at construction — a plain aggregated ingredient has
	// no discriminant — but declared so code that checks `.type` uniformly
	// across every shopping-list entry shape (scale/engine.ts,
	// renderer's isAlternativeGroup/isCompositeItem) doesn't need a cast.
	type?: string;
	id: string;
	name?: string;
	/** The total; for a range, its middle (the bounds are in `range`). */
	qty?: number;
	/**
	 * The bounds of a total with a range in it, added up by their bounds
	 * (`2-3 g` and `200 g` give `202-203 g`, `qty` 202.5). Since 1.5.0.
	 */
	range?: { min: number; max: number };
	unit?: string | null;
	variable_entries?: string[];
	fixed?: boolean;
	relative?: boolean;
	multiUnit?: boolean;
	modifiers?: string[];
	// Internal fields for calculation
	// No longer set: the sum is kept as terms, outside the item. Still declared
	// so code that read it keeps type-checking.
	otherUnits?: Record<string, number>;
	variableParts?: string[];
	_usageIds?: string[];
	allFixed?: boolean;
	isRelative?: boolean;
	modifierSet?: Set<string>;
	// Set by @gram-lang/analyzer, not by kitchen itself — same fields as
	// Usage's own (see that type's comment), declared here too since
	// analyze() enriches shopping-list items of every shape in place.
	normalizedMass?: number;
	conversionMethod?: string;
	isEstimate?: boolean;
	purchasingMass?: number;
	bakersPercentage?: number;
}

export interface CompositeItem {
	type: "composite";
	id: string;
	// Absent while accumulating (built by generateShoppingList's step 5/6
	// below); always set by the time this leaves generateShoppingList.
	name?: string;
	qty: number; // calculated max parent qty
	usage: Partial<Usage>[];
	// Never actually set on a composite — always undefined — but declared so
	// `scale/engine.ts`'s uniform "is this shopping-list entry scalable?"
	// checks (shared with ShoppingListItem/Usage) can read them without a cast.
	// A composite parent's own total is always a valid, unfixed, single-unit
	// scale target (see engine.ts's findStandardItem).
	fixed?: boolean;
	relative?: boolean;
	multiUnit?: boolean;
	unit?: string | null;
	modifiers?: string[];
	// Set by @gram-lang/analyzer's Baker's Percentage pass, generic over
	// every shopping-list entry shape — never actually meaningful for a
	// composite parent in practice, but declared for the same reason as
	// fixed/relative/multiUnit above.
	bakersPercentage?: number;
	// Set by @gram-lang/analyzer on the composite parent itself (summed from
	// its children's own normalizedMass, not read off unit_weight) — see
	// ShoppingListItem's identical fields for why they're declared here.
	normalizedMass?: number;
	conversionMethod?: string;
	isEstimate?: boolean;
	purchasingMass?: number;
}

/**
 * Format raw quantity AST nodes (fractions, ranges, variables, relative quantities)
 * into human-readable strings for display in the shopping list.
 */
function formatQuantity(q: Usage["qty"]): string | number {
	if (!q) return "";
	if (typeof q === "number" || typeof q === "string") return q;

	// Handle objects
	if (q.type === "single") return q.value;
	if (q.type === "range") return q.text || `${q.value}`;
	if (q.type === "fraction") return q.text || `${q.value}`;
	if (q.type === ASTNodeType.RelativeQuantity) {
		return `${q.percent}% of ${q.target}`;
	}

	return JSON.stringify(q);
}

/**
 * Working accumulator for a composite parent while `generateShoppingList` is
 * still folding sub-ingredient usages into it — kept separate from
 * `CompositeItem` so that type never has to carry build-only state (it used
 * to, as optional `_`-prefixed fields cleared before the item left this
 * function).
 */
interface CompositeAccumulator {
	id: string;
	subUsageMap: Map<string, number>;
	usageAccumulator: Map<string, Partial<Usage>>;
	// Direct (non-composite) usage of the parent ingredient itself (e.g. "3
	// eggs, 2 used as yolks") — set once the parent's own standardList entry
	// is folded in, consumed when the accumulator is finalized.
	directAddQty?: number;
}

/**
 * A usage as the shopping list adds it up: itself, or, for a sum over
 * several ladders (`{1 cup + 20 g}`, `{1 cup + 10 ml}`), one copy per ladder,
 * each holding the terms of that ladder and what they amount to, as if they
 * had been written apart.
 */
function byLadder(item: Usage): Usage[] {
	const groups = groupTerms(termsOfUsage(item), "ladder");
	if (groups.length <= 1) return [item];
	return groups.map((terms) => writeSum({ ...item }, terms));
}

/**
 * Main entry point for shopping list generation.
 * Iterates through all compiled sections and merges identical ingredients by ID,
 * aggregates compatible quantities, handles composite/parent sub-recipes, and flags circular references.
 */
export function generateShoppingList(
	sections: ProcessedSection[],
	registry: Registry,
	_options?: CompilerOptions,
): (ShoppingListItem | CompositeItem | Usage)[] {
	const listMap = new Map<string, ShoppingListItem>();
	// The terms each entry of `listMap` adds up, by the same key: one ladder
	// (`cup` and `tbsp`), or one unit on no ladder (its spellings merged), so
	// they always amount to a single number.
	const termsByKey = new Map<string, Term[]>();
	const compositeMap = new Map<string, CompositeAccumulator>();
	const alternatives: Usage[] = [];
	// The usages whose share of a composite parent is already counted.
	const sharedParent = new Set<string>();

	const circularIds = detectCycles(sections);

	sections.forEach((sec) => {
		sec.ingredients.forEach((item) => {
			if (item.type === "alternative") {
				alternatives.push(item);
				return;
			}

			if (circularIds.has(item.id)) {
				item.isCircular = true;
			}

			if (!isPurchasableReference(item.type, registry.ingredients.get(item.id)))
				return;

			// A sum over several ladders (`{1 cup + 20 g}`) is bought as one
			// amount per ladder, as if they had been written apart.
			byLadder(item).forEach(addToList);
		});
	});

	function addToList(item: Usage) {
		if (item.composite) {
			const parentId = slugify(item.composite.parent);
			if (!compositeMap.has(parentId)) {
				compositeMap.set(parentId, {
					id: parentId,
					subUsageMap: new Map(),
					usageAccumulator: new Map(),
				});
			}
			const comp = compositeMap.get(parentId)!;

			let declParentQty = 1;
			if (item.composite?.quantity || item.composite?.parts) {
				const numQ = numericTotal(termsOfComposite(item.composite));
				if (numQ !== null) declParentQty = numQ;
			}

			const subId = item.id;
			// A child split by ladder (`byLadder`) draws on its parent once.
			if (!item._usageId || !sharedParent.has(item._usageId)) {
				if (item._usageId) sharedParent.add(item._usageId);
				const currentParentTotal = comp.subUsageMap.get(subId) || 0;
				comp.subUsageMap.set(subId, currentParentTotal + declParentQty);
			}

			// Spellings of one unit (`cup` / `cups`, `c.à.s` / `tbsp`) share an
			// entry, shown with the first spelling met.
			const uKey = `${subId}::${normalizeUnit(item.unit)}`;

			if (!comp.usageAccumulator.has(uKey)) {
				comp.usageAccumulator.set(uKey, {
					id: subId,
					unit: item.unit,
					// Left undefined (not 0) until a measured usage is seen, so a
					// composite child written bare (e.g. `@jus<@citron{1/2}`, no
					// quantity of its own) doesn't display as "(0)" — it stays
					// unmeasured, like any other bare ingredient.
					qty: undefined,
					alias: item.alias,
				});
			}
			const uEntry = comp.usageAccumulator.get(uKey)!;

			const numQ = numericTotal(termsOfUsage(item));
			if (numQ !== null) {
				uEntry.qty = (typeof uEntry.qty === "number" ? uEntry.qty : 0) + numQ;
			}
			return;
		}

		const id = item.id;

		const unit = item.unit || "";
		const isGhost = item.formula?.isGhost === true;
		// The usage's terms, kept only when they amount to a number: a
		// ghost formula has none to add, and a term without a number goes
		// to the variable parts below, as written.
		const terms = isGhost ? [] : termsOfUsage(item);
		const numericQty = numericTotal(terms);

		// Group by ID AND ladder (and ghost status): the units of one ladder
		// (`cup` and `tbsp`, `g` and `kg`) add up in one entry, in the
		// smallest unit written; a unit on no ladder groups with its own
		// spellings only (`gousse` and `gousses` stay apart). Two systems
		// (`cup` and `ml`) or two families keep an entry each (`multiUnit`).
		const key = `${id}::${mergeKey(unit || null, "ladder")}::${isGhost ? "ghost" : "real"}`;

		if (!listMap.has(key)) {
			const name = registry.ingredients.get(id)?.name || item.name;

			listMap.set(key, {
				id: id,
				name: name,
				unit: unit,
				variableParts: [],
				_usageIds: [],
			});
		}

		const existing = listMap.get(key)!;
		if (item._usageId) {
			existing._usageIds!.push(item._usageId);
		}

		// Track whether every contributing usage is protected (@= or a
		// TextQuantity like "a pinch"), and whether any is a relative
		// (formula-derived) quantity — both disqualify this ingredient
		// as a --scale reference target (see @gram-lang/kitchen's ScaleEngine).
		existing.allFixed = item.fixed ? (existing.allFixed ?? true) : false;
		if (item.formula) existing.isRelative = true;
		// Propagate modifiers (e.g. the `*` baker's-percentage reference marker)
		// so consumers reading the shopping list — not just per-usage AST nodes —
		// can find it too.
		if (item.modifiers && item.modifiers.length > 0) {
			if (!existing.modifierSet) existing.modifierSet = new Set();
			item.modifiers.forEach((m: string) => {
				existing.modifierSet?.add(m);
			});
		}

		if (isGhost) {
			// isGhost is only ever set from `item.formula.isGhost` above, so
			// `item.formula` is always truthy here — the `.qty`/`.value`
			// fallback below it was dead code (also, `.value` doesn't exist
			// on every Usage["qty"] variant, e.g. RelativeQuantityAST).
			const text = item.formula?.raw ?? "";
			const display = `${text} ❓`;
			existing.variableParts!.push(`(${display})`);
		} else if (numericQty !== null) {
			const entryTerms = termsByKey.get(key);
			if (entryTerms) entryTerms.push(...terms);
			else termsByKey.set(key, [...terms]);
		} else if (item.qty) {
			const qStr = formatQuantity(item.qty);
			const uStr = unit ? ` ${unit}` : "";
			existing.variableParts!.push(`${qStr}${uStr}`);
		} else if (unit && !item.parts?.length) {
			// A quantity in words (`{une pincée}`, `{to taste}`): no number,
			// so the whole text is its unit. Bought as written.
			existing.variableParts!.push(unit);
		}

		if (!isGhost && item.isCircular) {
			existing.variableParts!.push("⚠️ Circular Ref.");
		}
	}

	const standardList = [...listMap.entries()].map(([key, item]) => {
		const res: ShoppingListItem = {
			id: item.id,
			name: item.name,
		};
		if (item._usageIds && item._usageIds.length > 0) {
			res._usageIds = item._usageIds;
		}
		if (item.allFixed) res.fixed = true;
		if (item.isRelative) res.relative = true;
		if (item.modifierSet && item.modifierSet.size > 0)
			res.modifiers = [...item.modifierSet];

		const terms = termsByKey.get(key);
		if (terms) {
			Object.assign(res, shoppingAmount(termsTotal(terms), item.unit || null));
		}

		if (item.variableParts && item.variableParts.length > 0) {
			res.variable_entries = [...item.variableParts];
		}

		return res;
	});

	// Flag ingredients split across incompatible units (e.g. 500g here, 2 cups
	// elsewhere): since the grouping key above already includes the unit, each
	// unit produces its own separate entry with the same `id` — so ambiguity
	// has to be detected *across* entries, not within one.
	const unitsById = new Map<string, Set<string | null>>();
	standardList.forEach((item) => {
		if (!unitsById.has(item.id)) unitsById.set(item.id, new Set());
		unitsById.get(item.id)!.add(item.unit ?? null);
	});
	standardList.forEach((item) => {
		if ((unitsById.get(item.id)?.size ?? 0) > 1) item.multiUnit = true;
	});

	const finalStandardList: ShoppingListItem[] = [];

	standardList.forEach((stdItem) => {
		if (compositeMap.has(stdItem.id)) {
			const comp = compositeMap.get(stdItem.id)!;

			let addQty = 0;
			if (stdItem.qty) {
				addQty = stdItem.qty;
			}

			const directUsageKey = `__direct_${stdItem.id}`;
			comp.usageAccumulator.set(directUsageKey, {
				id: stdItem.id,
				alias: "Direct Use",
				qty: stdItem.qty,
				unit: stdItem.unit,
			});

			comp.directAddQty = addQty;
		} else {
			finalStandardList.push(stdItem);
		}
	});

	const compositeList: CompositeItem[] = [...compositeMap.values()].map((c) => {
		let maxQ = 0;
		for (const q of c.subUsageMap.values()) {
			if (q > maxQ) maxQ = q;
		}

		if (c.directAddQty) {
			maxQ += c.directAddQty;
		}

		const parentName = registry.ingredients.get(c.id)?.name || c.id;

		return {
			type: "composite",
			id: c.id,
			name: parentName,
			qty: maxQ,
			usage: [...c.usageAccumulator.values()],
		};
	});

	return [...finalStandardList, ...compositeList, ...alternatives];
}

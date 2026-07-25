import { slugify, getNumericQty, round2 } from "./utils";
import { detectCycles } from "./graph";
import { ASTNodeType } from "@gram-lang/parser";
import type { ProcessedSection, Registry, Usage } from "./types";
import type { CompilerOptions } from "./core";

export interface ShoppingListItem {
	// Never actually set at construction — a plain aggregated ingredient has
	// no discriminant — but declared so code that checks `.type` uniformly
	// across every shopping-list entry shape (scale/engine.ts,
	// renderer's isAlternativeGroup/isCompositeItem) doesn't need a cast.
	type?: string;
	id: string;
	name?: string;
	qty?: number;
	unit?: string | null;
	variable_entries?: string[];
	fixed?: boolean;
	relative?: boolean;
	multiUnit?: boolean;
	modifiers?: string[];
	// Internal fields for calculation
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
	const compositeMap = new Map<string, CompositeAccumulator>();
	const alternatives: Usage[] = [];

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

			// Skip pure variable references (they don't go onto a grocery list)
			if (item.type === "reference") return;

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
				if (item.composite?.quantity) {
					const numQ = getNumericQty(item.composite.quantity);
					if (numQ !== null) declParentQty = numQ;
				}

				const subId = item.id;
				const currentParentTotal = comp.subUsageMap.get(subId) || 0;
				comp.subUsageMap.set(subId, currentParentTotal + declParentQty);

				const uUnit = item.unit || "";
				const uKey = `${subId}::${uUnit}`;

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

				const numQ = getNumericQty(item.qty);
				if (numQ !== null) {
					uEntry.qty = (typeof uEntry.qty === "number" ? uEntry.qty : 0) + numQ;
				}
				return;
			}

			const id = item.id;

			let numericQty: number | null = null;
			const unit = item.unit || "";
			let isGhost = false;

			if (item.formula) {
				if (item.formula.isGhost) {
					isGhost = true;
				} else {
					const numQ = getNumericQty(item.qty);
					if (numQ !== null) numericQty = numQ;
				}
			} else {
				const numQ = getNumericQty(item.qty);
				if (numQ !== null) numericQty = numQ;
			}

			// Group by ID AND unit (and ghost status) to prevent semantic data loss
			// where secondary units were stringified into variable_entries.
			const key = `${id}::${unit}::${isGhost ? "ghost" : "real"}`;

			if (!listMap.has(key)) {
				const name = registry.ingredients.get(id)?.name || item.name;

				listMap.set(key, {
					id: id,
					name: name,
					unit: unit,
					otherUnits: {},
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
				const u = unit;
				if (!existing.otherUnits![u]) existing.otherUnits![u] = 0;
				existing.otherUnits![u] += numericQty;
			} else {
				if (item.qty) {
					const qStr = formatQuantity(item.qty);
					const uStr = unit ? ` ${unit}` : "";
					existing.variableParts!.push(`${qStr}${uStr}`);
				}
			}

			if (!isGhost && item.isCircular) {
				existing.variableParts!.push("⚠️ Circular Ref.");
			}
		});
	});

	const standardList = [...listMap.values()].map((item) => {
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

		const units = Object.keys(item.otherUnits!);
		const primaryUnit = units[0];
		if (primaryUnit !== undefined) {
			res.qty = round2(item.otherUnits![primaryUnit] || 0);
			res.unit = primaryUnit || null;
		}

		const hasOther = Object.keys(item.otherUnits!).length > 0;

		const extraEntries: string[] = [];
		if (hasOther) {
			const units = Object.keys(item.otherUnits!);
			for (let i = 1; i < units.length; i++) {
				const u = units[i];
				if (u === undefined) continue;
				const uStr = u ? ` ${u}` : "";
				extraEntries.push(`${round2(item.otherUnits![u] || 0)}${uStr}`);
			}
		}

		const allVars = [...extraEntries, ...(item.variableParts || [])];
		if (allVars.length > 0) {
			res.variable_entries = allVars;
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

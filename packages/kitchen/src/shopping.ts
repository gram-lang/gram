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
}

export interface CompositeItem {
	type: "composite";
	id: string;
	// Absent while accumulating (built by generateShoppingList's step 5/6
	// below); always set by the time this leaves generateShoppingList.
	name?: string;
	qty: number; // calculated max parent qty
	usage: Partial<Usage>[];
	// Only present on the in-progress accumulator kept in `compositeMap`
	// during generateShoppingList — deliberately absent from the finished
	// item returned in the shopping list itself (internal build state, not
	// part of its public shape).
	_subUsageMap?: Map<string, number>;
	_usageAccumulator?: Map<string, Partial<Usage>>;
	// Internal accumulator for a direct (non-composite) usage of the parent
	// ingredient itself (e.g. "3 eggs, 2 used as yolks") — set in step 5,
	// consumed in step 6 below.
	_directAddQty?: number;
	// Never actually set on a composite — always undefined — but declared so
	// `scale/engine.ts`'s uniform "is this shopping-list entry scalable?"
	// checks (shared with ShoppingListItem/Usage) can read them without a cast.
	// A composite parent's own total is always a valid, unfixed, single-unit
	// scale target (see engine.ts's findStandardItem).
	fixed?: boolean;
	relative?: boolean;
	multiUnit?: boolean;
	unit?: string | null;
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
	const compositeMap = new Map<string, CompositeItem>();
	const alternatives: Usage[] = [];

	// Detect circular dependencies globally
	const circularIds = detectCycles(sections);

	sections.forEach((sec) => {
		sec.ingredients.forEach((item) => {
			// 1. Separate alternatives to be rendered separately at the end
			if (item.type === "alternative") {
				alternatives.push(item);
				return;
			}

			if (circularIds.has(item.id)) {
				item.isCircular = true;
			}

			// Skip pure variable references (they don't go onto a grocery list)
			if (item.type === "reference") return;

			// 2. Handle composite sub-recipe ingredients
			if (item.composite) {
				const parentId = slugify(item.composite.parent);
				if (!compositeMap.has(parentId)) {
					compositeMap.set(parentId, {
						type: "composite",
						id: parentId,
						qty: 0,
						usage: [],
						_subUsageMap: new Map(),
						_usageAccumulator: new Map(),
					});
				}
				const comp = compositeMap.get(parentId)!;

				// Accumulate declared parent batch requirements (default to 1)
				let declParentQty = 1;
				if (item.composite?.quantity) {
					const numQ = getNumericQty(item.composite.quantity);
					if (numQ !== null) declParentQty = numQ;
				}

				const subId = item.id;
				// Always populated at construction (compositeMap.set above) —
				// only the *finished* CompositeItem returned to callers omits them.
				const currentParentTotal = comp._subUsageMap!.get(subId) || 0;
				comp._subUsageMap!.set(subId, currentParentTotal + declParentQty);

				// Accumulate child quantities inside the sub-recipe
				const uUnit = item.unit || "";
				const uKey = `${subId}::${uUnit}`;

				if (!comp._usageAccumulator!.has(uKey)) {
					comp._usageAccumulator!.set(uKey, {
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
				const uEntry = comp._usageAccumulator!.get(uKey)!;

				const numQ = getNumericQty(item.qty);
				if (numQ !== null) {
					uEntry.qty = (typeof uEntry.qty === "number" ? uEntry.qty : 0) + numQ;
				}
				return;
			}

			// 3. Normal ingredient aggregation
			const id = item.id;

			// Extract numeric quantities if resolvable
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

			// (Numeric extraction moved up above key generation)

			// Push ghosts, variables, and circular warnings to alternative descriptions
			if (isGhost) {
				// isGhost is only ever set from `item.formula.isGhost` above, so
				// `item.formula` is always truthy here — the `.qty`/`.value`
				// fallback below it was dead code (also, `.value` doesn't exist
				// on every Usage["qty"] variant, e.g. RelativeQuantityAST).
				const text = item.formula?.raw ?? "";
				const display = `${text} ❓`;
				existing.variableParts!.push(`(${display})`);
			} else if (numericQty !== null) {
				// Sum numeric quantities under matching units
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

	// 4. Transform and round aggregated items into a clean standard shopping list schema
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

	// 4.5. Flag ingredients split across incompatible units (e.g. 500g here,
	// 2 cups elsewhere): since the grouping key above already includes the
	// unit, each unit produces its own separate entry with the same `id` —
	// so ambiguity has to be detected *across* entries, not within one.
	const unitsById = new Map<string, Set<string | null>>();
	standardList.forEach((item) => {
		if (!unitsById.has(item.id)) unitsById.set(item.id, new Set());
		unitsById.get(item.id)!.add(item.unit ?? null);
	});
	standardList.forEach((item) => {
		if ((unitsById.get(item.id)?.size ?? 0) > 1) item.multiUnit = true;
	});

	// 5. Merge direct ingredient usages into their composite parent sub-recipes
	const finalStandardList: ShoppingListItem[] = [];

	standardList.forEach((stdItem) => {
		if (compositeMap.has(stdItem.id)) {
			const comp = compositeMap.get(stdItem.id)!;

			let addQty = 0;
			if (stdItem.qty) {
				addQty = stdItem.qty;
			}

			const directUsageKey = `__direct_${stdItem.id}`;
			comp._usageAccumulator!.set(directUsageKey, {
				id: stdItem.id,
				alias: "Direct Use",
				qty: stdItem.qty,
				unit: stdItem.unit,
			});

			comp._directAddQty = addQty;
		} else {
			finalStandardList.push(stdItem);
		}
	});

	// 6. Finalize composite parent sub-recipe item listings
	const compositeList: CompositeItem[] = [...compositeMap.values()].map((c) => {
		let maxQ = 0;
		for (const q of c._subUsageMap!.values()) {
			if (q > maxQ) maxQ = q;
		}

		if (c._directAddQty) {
			maxQ += c._directAddQty;
		}

		c.qty = maxQ;
		const parentName = registry.ingredients.get(c.id)?.name || c.id;

		// Deliberately excludes _subUsageMap/_usageAccumulator/_directAddQty —
		// internal accumulator state, not part of a finished shopping-list item.
		const cRes: CompositeItem = {
			type: "composite",
			id: c.id,
			name: parentName,
			qty: c.qty,
			usage: [...c._usageAccumulator!.values()],
		};

		return cRes;
	});

	return [...finalStandardList, ...compositeList, ...alternatives];
}

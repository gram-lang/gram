import { normalizeUnit } from "@gram-lang/i18n";
import { slugify, scaleQty, round2 } from "../utils";
import type { CompilationResult, Usage } from "../types";
import type { ShoppingListItem, CompositeItem } from "../shopping";
import {
	type ScaleRequest,
	type ScaleResolution,
	type UnitConverter,
	InvalidFactorError,
	IngredientNotFoundError,
	NestedOnlyTargetError,
	AlternativeTargetError,
	FixedIngredientError,
	RelativeTargetError,
	AmbiguousMultiUnitError,
	NonNumericTargetError,
	UnitMismatchError,
} from "./types";

// A shopping-list entry is one of 3 real shapes (see CompilationResult):
// a plain aggregated ingredient/cookware (ShoppingListItem), a composite
// sub-recipe parent (CompositeItem), or a Usage — the last one covers an
// alternative-ingredient group (`type: "alternative"`, `options: [...]`,
// pushed into the shopping list as a Usage in shopping.ts), since there is
// no dedicated "AlternativeGroup" type in this package (kitchen finding
// F-011/F-016: Usage.type is a real discriminant in practice, just not
// modeled as one yet).
type ShoppingListEntry = CompilationResult["shopping_list"][number];

function isPositiveFinite(n: number): boolean {
	return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function findNestedParent(
	shoppingList: ShoppingListEntry[],
	id: string,
): string | undefined {
	for (const item of shoppingList) {
		if (item && item.type === "composite" && "usage" in item) {
			const sub = item.usage.find((u) => u && u.id === id);
			if (sub) return item.id;
		}
	}
	return undefined;
}

/** Finds the sibling option ids if `id` is one option inside an alternative-ingredient group. */
function findAlternativeSiblings(
	shoppingList: ShoppingListEntry[],
	id: string,
): string[] | undefined {
	for (const item of shoppingList) {
		if (item && item.type === "alternative" && "options" in item) {
			const options = item.options ?? [];
			const usageOptions = options.filter(
				(o): o is Usage => typeof o === "object" && o !== null && "id" in o,
			);
			if (usageOptions.some((o) => o.id === id)) {
				return usageOptions.filter((o) => o.id !== id).map((o) => o.id);
			}
		}
	}
	return undefined;
}

// A composite (sub-recipe) parent's own total is a well-defined absolute
// quantity — same as any other aggregated ingredient — so it's a valid scale
// target. Only its *nested* children (see findNestedParent) and alternative
// groups (see findAlternativeSiblings) are excluded — a plain Usage only
// ever appears in the shopping list as an alternative-group container (see
// ShoppingListEntry's own comment), so excluding `type === "alternative"`
// also rules out Usage in practice; the type predicate makes that explicit.
function findStandardItem(
	shoppingList: ShoppingListEntry[],
	id: string,
): ShoppingListItem | CompositeItem | undefined {
	return shoppingList.find(
		(i): i is ShoppingListItem | CompositeItem =>
			!!i && i.type !== "alternative" && i.id === id,
	);
}

/**
 * Resolves a scaling request into a single multiplier. This is the one place
 * in the ecosystem that validates a `target` request against fixed (@=),
 * relative, nested-composite-child, alternative-group, and multi-unit
 * ingredients — every consumer (CLI, Playground, etc.) should go through this
 * instead of re-deriving these rules against the shopping list itself.
 */
export function resolveScaleFactor(
	compiled: CompilationResult | null,
	request: ScaleRequest,
	convertUnit?: UnitConverter,
): ScaleResolution {
	if (request.type === "factor") {
		if (!isPositiveFinite(request.value))
			throw new InvalidFactorError(request.value);
		return { factor: request.value, resolvedFrom: "factor" };
	}

	if (!isPositiveFinite(request.qty)) {
		throw new InvalidFactorError(
			request.qty,
			`Invalid target quantity "${request.qty}" for "${request.id}". Must be a positive number.`,
		);
	}

	const id = slugify(request.id);
	const shoppingList: ShoppingListEntry[] = compiled?.shopping_list ?? [];

	const siblings = findAlternativeSiblings(shoppingList, id);
	if (siblings) throw new AlternativeTargetError(id, siblings);

	const nestedParent = findNestedParent(shoppingList, id);
	if (nestedParent) throw new NestedOnlyTargetError(id, nestedParent);

	const item = findStandardItem(shoppingList, id);
	if (!item) {
		const available = shoppingList
			.filter((i) => i && i.type !== "alternative")
			.map((i) => i.id);
		throw new IngredientNotFoundError(id, available);
	}

	if (item.fixed) {
		throw new FixedIngredientError(
			id,
			typeof item.qty === "string" ? "text" : "protected",
		);
	}
	if (item.relative) throw new RelativeTargetError(id);
	if (item.multiUnit) throw new AmbiguousMultiUnitError(id);
	if (typeof item.qty !== "number") throw new NonNumericTargetError(id);
	if (item.qty === 0) {
		throw new InvalidFactorError(
			0,
			`"${id}" has a quantity of 0 and cannot be used as a scale reference.`,
		);
	}

	const itemUnit: string | null = item.unit || null;
	const requestedUnit = request.unit;
	const normItem = itemUnit ? normalizeUnit(itemUnit) : null;
	const normReq = requestedUnit ? normalizeUnit(requestedUnit) : null;

	let targetQtyInItemUnit = request.qty;
	let unitConverted = false;

	if (normReq !== normItem) {
		if (!requestedUnit || !itemUnit || !convertUnit) {
			throw new UnitMismatchError(id, requestedUnit, itemUnit);
		}
		const converted = convertUnit(request.qty, requestedUnit, itemUnit);
		if (converted === null)
			throw new UnitMismatchError(id, requestedUnit, itemUnit);
		targetQtyInItemUnit = converted;
		unitConverted = true;
	}

	const factor = targetQtyInItemUnit / item.qty;
	if (!isPositiveFinite(factor)) {
		throw new InvalidFactorError(
			factor,
			`Computed scale factor for "${id}" is invalid (${factor}).`,
		);
	}

	return { factor, resolvedFrom: "target", targetId: id, unitConverted };
}

// Real call sites pass a Usage, a Partial<Usage> (a composite's `.usage`
// entries), or a StepToken (which includes plain strings — the `typeof
// item !== "object"` guard below already handles that case safely) — no
// single nominal type covers all of them, so this narrows once, at the
// runtime-verified "is an object" boundary, same pattern as
// formatElement's `element: unknown`.
function mutateUsage(
	item: unknown,
	factor: number,
	scaled: WeakSet<object>,
): void {
	if (!item || typeof item !== "object") return;
	if (scaled.has(item)) return; // already scaled — same Usage object is shared
	// between section.ingredients and its inline step token (see processIngredient
	// in processor.ts, which pushes and returns the same object); without this
	// guard it would be scaled twice (factor²) here.
	const usage = item as Partial<Usage>;
	if (usage.fixed) return; // @= modifier or TextQuantity — never scaled
	if ("qty" in usage && usage.qty !== undefined) {
		usage.qty = scaleQty(usage.qty, factor);
	}
	scaled.add(item);
}

/**
 * Applies a resolved factor to a CompilationResult. Pure: the input is never
 * mutated (via structuredClone), so callers can safely re-apply different
 * factors to the same original result — e.g. a live scale slider — without
 * ever compounding onto a previous scale or leaking scratch state into the
 * input AST's shared objects (like `meta`).
 */
export function applyScale(
	result: CompilationResult,
	factor: number,
): CompilationResult {
	if (factor === 1) return result;

	const cloned = structuredClone(result);
	const basePortions = result.meta?.portions;
	// structuredClone preserves shared references (e.g. a section ingredient's
	// Usage object is the very same object as its inline step token) — track
	// what's already been scaled so a shared object is never scaled twice.
	const scaled = new WeakSet<object>();

	// Frontmatter values (Meta) are always string | string[] — see parser
	// finding I3(3) — never a genuine `number`, so scaling only ever applies
	// to the string form (e.g. `portions: "4"`).
	if (cloned.meta && typeof basePortions === "string") {
		const num = parseFloat(basePortions);
		if (!Number.isNaN(num)) cloned.meta.portions = String(round2(num * factor));
	}

	for (const item of cloned.shopping_list ?? []) {
		if (!item || typeof item !== "object") continue;
		if (item.type === "alternative" && "options" in item) {
			for (const opt of item.options ?? []) mutateUsage(opt, factor, scaled);
		} else if (item.type === "composite" && "usage" in item) {
			if (typeof item.qty === "number") {
				// scaleQty(number, ...) always returns a number — its broader
				// Usage["qty"] return type only matters for the AST-object inputs.
				item.qty = scaleQty(item.qty, factor) as number;
			}
			for (const u of item.usage ?? []) mutateUsage(u, factor, scaled);
		} else {
			mutateUsage(item, factor, scaled);
		}
	}

	// Audit 2026-07-22, finding F-001: cookware was never scaled explicitly
	// here — it only happened to work when applyScale ran *inside* compile()
	// (before cleanObject destroys the shared references between
	// result.cookware / section.cookware / the step's inline token), so
	// `applyScale(compile(ast), f)` silently left cookware unscaled while
	// `compile(ast, { scaleFactor: f })` didn't. `fixed:false` set on cookware
	// by createCleanUsage means it's meant to be scalable like any ingredient.
	// mutateUsage's WeakSet guard makes this safe to call again on an object
	// already scaled via the step-token pass below, whether or not the two
	// are still the same shared reference.
	for (const cw of cloned.cookware ?? []) mutateUsage(cw, factor, scaled);

	for (const section of cloned.sections ?? []) {
		for (const ing of section.ingredients ?? [])
			mutateUsage(ing, factor, scaled);
		for (const cw of section.cookware ?? []) mutateUsage(cw, factor, scaled);
		for (const stepItem of section.steps ?? []) {
			if (!stepItem || stepItem.type === "comment") continue;
			for (const token of stepItem.content ?? []) {
				if (!token || typeof token !== "object") continue;
				// Ingredient usage tokens have an 'id' and no token-type discriminator
				if ("id" in token && !("type" in token))
					mutateUsage(token, factor, scaled);
			}
		}
	}

	cloned.scaleFactor = (result.scaleFactor ?? 1) * factor;

	return cloned;
}

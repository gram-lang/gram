import {
	type QuantityValueAST,
	type QuantityAST,
	type RelativeQuantityAST,
	type IngredientAST,
	type CookwareAST,
	ASTNodeType,
} from "@gram-lang/parser";
import type { Usage, UsageComposite } from "./types";
import { resolveTimeUnit, TIME_TO_MINUTES } from "@gram-lang/i18n";
import type { CompilerOptions } from "./core";
// Imported from "./scale/types" (not the "./scale" barrel) to avoid a cycle:
// "./scale" re-exports engine.ts, which itself imports from this file.
import { InvalidFactorError } from "./scale/types";

/**
 * Deterministic short hash (djb2), used as a slug fallback when a name has no
 * letters/digits left to slugify (e.g. an emoji-only or purely symbolic
 * title) — a fixed 'unknown' fallback would collide across every such name.
 */
const shortHash = (input: string): string => {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36).slice(0, 8);
};

/**
 * Normalizes user-inputted strings (like ingredient names) into robust
 * identifiers (slugs), used globally as keys/IDs (e.g., "basmati-rice" from
 * "Basmati Rice") for reliable lookups and comparisons across ingredients and
 * databases.
 *
 * Latin diacritics are folded to their base letter via NFD normalization
 * (e.g. "crème" -> "creme"), but non-Latin letters (CJK, Cyrillic, Arabic…)
 * have no such decomposition and are preserved as-is via `\p{L}`/`\p{N}`
 * rather than stripped — two recipes named in different non-Latin scripts
 * must not collide onto the same id.
 */
export const slugify = (text: string | number): string => {
	const slug = text
		.toString()
		.toLowerCase()
		.replace(/œ/g, "oe")
		.replace(/æ/g, "ae")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return slug || shortHash(text.toString());
};

/**
 * Simplifies complex parsed Quantity AST structures into compact JSON-friendly formats.
 *
 * Extract raw numbers from simple single-value nodes, or preserve ranges and fractions
 * as clean objects. Explicitly ignores RelativeQuantities since their evaluation is
 * deferred to the analyzer.
 */
export const minifyQuantity = (
	q: QuantityValueAST | QuantityAST | RelativeQuantityAST | null | undefined,
): number | QuantityValueAST | undefined => {
	if (!q) return undefined;

	if (q.type === ASTNodeType.RelativeQuantity) return undefined;

	if (q.type === ASTNodeType.Quantity) {
		if (q.value && q.value.type === "single") return q.value.value;
		return q.value;
	}

	if (q.type === "single" && q.value !== undefined) return q.value;
	return q;
};

/**
 * Generates a unique, deterministic `_usageId` for a Usage object. Shared by
 * every ingredient/cookware/reference usage across the compiler so ids never
 * collide, and compilation is reproducible (no snapshot flakiness).
 *
 * `counter` must be a fresh `{ value: 0 }` created per compile() call (see
 * `Context.usageCounter`) — never a module-level singleton, otherwise ids
 * leak across unrelated compilations sharing the same process.
 */
export const nextUsageId = (counter: { value: number }): string =>
	String(++counter.value);

/**
 * Standardizes a raw step/section ingredient or cookware item into a clean, unified `Usage` object.
 *
 * Maps modifier symbols (?, -, &, *) to semantic names, handles fixed quantity states,
 * extracts cleaned quantities/units, and retains metadata like parent composite scopes or custom aliases.
 */
export const createCleanUsage = (
	item: IngredientAST | CookwareAST,
	id: string,
	counter: { value: number },
	_options?: CompilerOptions,
): Usage => {
	const obj: Usage = { id, _usageId: nextUsageId(counter) };
	const qtyNode = item.quantity;
	let cleanQty: number | QuantityValueAST | string | undefined;

	if (qtyNode) {
		if (qtyNode.type === ASTNodeType.TextQuantity) {
			cleanQty = qtyNode.value;
		} else if (qtyNode.type === ASTNodeType.Quantity) {
			cleanQty = minifyQuantity(qtyNode.value || qtyNode);
		} else {
			cleanQty = minifyQuantity(qtyNode);
		}
	}

	if (cleanQty !== undefined) obj.qty = cleanQty;
	if (qtyNode && qtyNode.type === ASTNodeType.Quantity && qtyNode.unit) {
		obj.unit = qtyNode.unit;
	}

	if (item.modifiers && item.modifiers.length > 0) {
		const MODIFIER_MAP: Record<string, string> = {
			"?": "optional",
			"-": "hidden",
			"&": "reference",
			"*": "bakers_percentage",
		};
		obj.modifiers = item.modifiers.map((m: string) => MODIFIER_MAP[m] || m);
	}

	// CookwareAST.quantity is always a QuantityAST (mandatory, unlike
	// IngredientAST's union); the `item.type` check narrows `item`, but
	// `qtyNode` was captured before that, so it still needs its own check.
	// Two independent checks (not if/else-if): a cookware quantity explicitly
	// marked non-fixed (`fixed === false`) only ever clears the flag; an
	// ingredient's `@=` (`fixed === true`) only ever sets it — cookware never
	// takes the "set true" path here, matching the original branching.
	if (
		item.type === ASTNodeType.Cookware &&
		qtyNode &&
		qtyNode.type === ASTNodeType.Quantity &&
		qtyNode.fixed === false
	) {
		obj.fixed = false;
	}
	if (
		item.type !== ASTNodeType.Cookware &&
		qtyNode &&
		qtyNode.type === ASTNodeType.Quantity &&
		qtyNode.fixed === true
	) {
		obj.fixed = true;
	}

	if (qtyNode && qtyNode.type === ASTNodeType.TextQuantity) {
		obj.qty = qtyNode.value;
		obj.fixed = true;
	}

	if (item.alias) obj.alias = item.alias;
	if (item.preparation) obj.preparation = item.preparation;

	if (item.type !== ASTNodeType.Cookware && item.composite) {
		const comp: UsageComposite = { parent: item.composite.parent };
		if (item.composite.quantity) {
			const compQty = item.composite.quantity;
			const minified = minifyQuantity(compQty);
			if (minified !== undefined) comp.quantity = minified;
			if (compQty.unit) comp.unit = compQty.unit;
		}
		if (item.composite.preparation)
			comp.preparation = item.composite.preparation;
		obj.composite = comp;
	}

	return obj;
};

/**
 * Recursively cleans a compiled output object by removing `null` and `undefined` properties.
 *
 * Retains empty arrays for structural core fields (`ingredients`, `cookware`, `steps`, `sections`, etc.)
 * to preserve a guaranteed API schema for consumers (avoiding undefined references),
 * while stripping other empty arrays to keep the JSON output lightweight and neat.
 */
// Recurses over an arbitrary JSON-shaped compiled-output tree — genuinely
// `unknown` at every level, not any one AST/Usage/section type.
export const cleanObject = (obj: unknown): unknown => {
	if (obj === null || obj === undefined) return undefined;
	if (Array.isArray(obj)) {
		const cleanedArr = obj
			.map(cleanObject)
			.filter((x) => x !== undefined && x !== null);
		return cleanedArr;
	}
	if (typeof obj === "object") {
		const res: Record<string, unknown> = {};
		for (const key in obj) {
			const val = (obj as Record<string, unknown>)[key];
			const cleanedVal = cleanObject(val);
			if (cleanedVal !== null && cleanedVal !== undefined) {
				if (Array.isArray(cleanedVal) && cleanedVal.length === 0) {
					const keepKeys = [
						"ingredients",
						"cookware",
						"steps",
						"sections",
						"shopping_list",
						"warnings",
						// Always present in the compiled output, even when empty.
						"miseEnPlace",
						"blocks",
						"sessions",
						// The task graph lists what each task waits for, nothing included.
						"tasks",
						"after",
					];
					if (!keepKeys.includes(key)) continue;
				}
				res[key] = cleanedVal;
			}
		}
		return res;
	}
	return obj;
};

/**
 * Converts a recipe time quantity AST (timer or active duration) into a unified number of minutes.
 *
 * Supports ranges (takes the average), simple numbers, and fractions, and performs
 * conversions from hours ('h') or seconds ('s') based on the resolved time unit.
 */
// Both real call sites (processRetroPlanning, the timer duration in
// processSections) construct this exact `{ value, unit }` wrapper — never a
// raw QuantityAST (with its own `.type`/`.value` nesting), so there is no
// separate "AST object" branch to handle.
interface TimeQuantity {
	value?: number | string | QuantityValueAST | null;
	unit?: string;
}

/**
 * The longest duration Gram plans with: 1000 years, in minutes. It is not a
 * judgement on recipes (a solera runs for decades): it is a technical bound.
 * Past about 10^9 days a duration stops being exact, and past 10^15 it comes
 * out as 0 minutes, `Infinity` or `NaN` — which is `null` in the compiled JSON.
 * A longer duration is capped here, and `compile()` raises
 * `DURATION_OUT_OF_RANGE` for it.
 */
export const MAX_DURATION_MINUTES = 1000 * 365 * 24 * 60;

/** The duration `qty` asks for, in minutes, before any capping. */
const rawMinutes = (qty: TimeQuantity | null | undefined): number => {
	if (!qty || qty.value === undefined || qty.value === null) return 0;

	let val: number | string | QuantityValueAST = qty.value;
	if (typeof val === "object") {
		if (val.type === "single" || val.type === "fraction") val = val.value;
		else if (val.type === "range") val = (val.range.min + val.range.max) / 2;
	}
	if (typeof val !== "number") return 0;

	const u = resolveTimeUnit(qty.unit || "");

	// Time conversions to minutes — factors owned by @gram-lang/i18n (Phase
	// 17), alongside the unit-name resolution above.
	const factor = TIME_TO_MINUTES[u];
	return factor !== undefined ? val * factor : val;
};

/** True when `qty` asks for more than `MAX_DURATION_MINUTES` (in either direction). */
export const isDurationTooLong = (
	qty: TimeQuantity | null | undefined,
): boolean => Math.abs(rawMinutes(qty)) > MAX_DURATION_MINUTES;

/**
 * The longest duration, expressed in `unit` (`min`, `h`, `d`…), for writing
 * the capped value back where a quantity is kept as written.
 */
export const maxDurationIn = (unit: string): number =>
	MAX_DURATION_MINUTES / (TIME_TO_MINUTES[resolveTimeUnit(unit)] ?? 1);

/** The shortest and longest duration `qty` allows, in minutes, each capped like `quantityToMinutes`. */
export const quantityToMinutesRange = (
	qty: TimeQuantity | null | undefined,
): { min: number; max: number } => {
	const val = qty?.value;
	if (val && typeof val === "object" && val.type === "range") {
		const { min, max } = val.range;
		const lo = quantityToMinutes({
			value: Math.min(min, max),
			unit: qty?.unit,
		});
		const hi = quantityToMinutes({
			value: Math.max(min, max),
			unit: qty?.unit,
		});
		return { min: lo, max: hi };
	}
	const minutes = quantityToMinutes(qty);
	return { min: minutes, max: minutes };
};

export const quantityToMinutes = (
	qty: TimeQuantity | null | undefined,
): number => {
	const minutes = rawMinutes(qty);
	if (Number.isNaN(minutes)) return 0;
	return Math.max(
		-MAX_DURATION_MINUTES,
		Math.min(MAX_DURATION_MINUTES, minutes),
	);
};

/**
 * Multiplies a compiled quantity value by a scale factor.
 * Handles plain numbers, single/range/fraction QuantityValueAST objects.
 * String quantities (TextQuantity) and undefined values are left unchanged.
 *
 * `text`/`numerator`/`denominator` capture the original source string (e.g. "1/2")
 * and are only valid for the unscaled value, so they're cleared here rather than
 * carried over stale — display code must fall back to the scaled numeric `value`.
 *
 * The scale *factor* is validated (`isPositiveFinite` in scale/engine.ts,
 * `CompilerOptionsSchema`), but the *product* never was —
 * `scaleQty(500, 1e308)` silently produced `Infinity`,
 * which serializes to JSON `null`. Every multiplication here now goes through
 * `scaleValue`, which throws `InvalidFactorError` on overflow instead, and
 * applies `round2` uniformly so scaled quantities don't carry float noise
 * (`110.00000000000001`) — previously only `applyScale`'s `meta.portions`
 * was rounded, not the quantities themselves.
 */
export const scaleQty = (qty: Usage["qty"], factor: number): Usage["qty"] => {
	if (factor === 1) return qty;

	const scaleValue = (value: number): number => {
		const scaled = value * factor;
		if (!Number.isFinite(scaled)) {
			throw new InvalidFactorError(
				factor,
				`Scaling by a factor of ${factor} overflowed a quantity to a non-finite value.`,
			);
		}
		return round2(scaled);
	};

	if (typeof qty === "number") return scaleValue(qty);
	if (!qty || typeof qty !== "object") return qty;

	if (qty.type === "single" && typeof qty.value === "number") {
		return { ...qty, value: scaleValue(qty.value), text: undefined };
	}
	if (qty.type === "range") {
		return {
			...qty,
			value: typeof qty.value === "number" ? scaleValue(qty.value) : qty.value,
			range: qty.range
				? { min: scaleValue(qty.range.min), max: scaleValue(qty.range.max) }
				: qty.range,
			text: undefined,
		};
	}
	if (qty.type === "fraction" && typeof qty.value === "number") {
		// `numerator`/`denominator` are required, non-optional fields on the
		// "fraction" variant of QuantityValueAST — setting them `undefined`
		// while keeping `type: "fraction"` produced a structurally malformed
		// value (`{type:"fraction", value:1}`, no numerator/denominator).
		// Scaling breaks the clean numerator/denominator relationship anyway
		// (the doc comment above already says display must fall back to the
		// scaled numeric `value`), so this becomes a "single" value instead —
		// the type that actually matches what's left. Routed through
		// `scaleValue` (not a raw multiply) for the same overflow/rounding
		// protection as every other branch here (kitchen finding F-015).
		return { type: "single", value: scaleValue(qty.value) };
	}
	return qty;
};

/**
 * Rounds a mass/quantity value to 2 decimal places, returning a `number`
 * (not a string). Centralizes the `parseFloat(x.toFixed(2))` idiom used
 * throughout kitchen/analyzer so there is a single, documented rounding rule
 * to port when the compiler is reimplemented in another language: `toFixed`
 * uses round-half-away-from-zero on the value's shortest decimal
 * representation, which differs from IEEE round-half-to-even on exact ties.
 */
export const round2 = (value: number): number => parseFloat(value.toFixed(2));

// Lives in the scheduler, which builds the timeline breakdowns with it.
export { addToBreakdown } from "@gram-lang/scheduler";

export const getNumericQty = (
	q: Usage["qty"] | null | undefined,
): number | null => {
	if (q === undefined || q === null) return null;
	if (typeof q === "number") return q;
	if (typeof q !== "object") return null; // string (TextQuantity's cleaned value)

	// RelativeQuantityAST/TextQuantityAST have no "fraction"/"range"/"single"
	// variant — only a real QuantityValueAST does.
	if (q.type === "fraction" || q.type === "range" || q.type === "single") {
		return q.value ?? null;
	}
	return null;
};

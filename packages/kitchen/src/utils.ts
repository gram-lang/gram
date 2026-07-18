import { type QuantityValueAST, ASTNodeType } from "@gram-lang/parser";
import type { Usage } from "./types";
import { resolveTimeUnit } from "@gram-lang/i18n";
import type { CompilerOptions } from "./core";

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
	q: any,
): number | QuantityValueAST | undefined => {
	if (!q) return undefined;
	if (typeof q === "number") return q;

	// Check for specific AST types or general structures
	if (q.type === "single" && q.value !== undefined) return q.value;
	if (q.type === "range" || q.type === "fraction") return q;

	// If it's a full QuantityAST
	if (q.type === ASTNodeType.Quantity) {
		if (q.value && q.value.type === "single") return q.value.value;
		return q.value;
	}

	// Explicitly ignore RelativeQuantity for minification in this context
	if (q.type === ASTNodeType.RelativeQuantity) return undefined;

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
	item: any,
	id: string,
	counter: { value: number },
	_options?: CompilerOptions,
): Usage => {
	const obj: Usage = { id, _usageId: nextUsageId(counter) };
	const qtyNode = item.quantity;
	let cleanQty: any;

	if (qtyNode) {
		// If it's a TextQuantity, we use the value directly
		if (qtyNode.type === ASTNodeType.TextQuantity) {
			cleanQty = qtyNode.value;
		} else {
			cleanQty = minifyQuantity(qtyNode.value || qtyNode);
		}
	}

	if (cleanQty !== undefined) obj.qty = cleanQty;
	if (qtyNode?.unit) obj.unit = qtyNode.unit;

	if (item.modifiers && item.modifiers.length > 0) {
		const MODIFIER_MAP: Record<string, string> = {
			"?": "optional",
			"-": "hidden",
			"&": "reference",
			"*": "bakers_percentage",
		};
		obj.modifiers = item.modifiers.map((m: string) => MODIFIER_MAP[m] || m);
	}

	if (item.type === ASTNodeType.Cookware) {
		if (qtyNode && qtyNode.fixed === false) obj.fixed = false;
	} else {
		if (qtyNode && qtyNode.fixed === true) obj.fixed = true;
	}

	// Special handling for TextQuantity override
	if (qtyNode && qtyNode.type === ASTNodeType.TextQuantity) {
		obj.qty = qtyNode.value;
		obj.fixed = true;
	}

	if (item.alias) obj.alias = item.alias;
	if (item.preparation) obj.preparation = item.preparation;

	if (item.composite) {
		const comp: any = {};
		if (item.composite.parent) comp.parent = item.composite.parent;
		if (item.composite.quantity) {
			const compQty = item.composite.quantity;
			const minified = minifyQuantity(compQty);
			if (minified !== undefined) comp.quantity = minified;
			if (compQty.unit) comp.unit = compQty.unit;
		}
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
export const cleanObject = (obj: any): any => {
	if (obj === null || obj === undefined) return undefined;
	if (Array.isArray(obj)) {
		const cleanedArr = obj
			.map(cleanObject)
			.filter((x) => x !== undefined && x !== null);
		return cleanedArr;
	}
	if (typeof obj === "object") {
		const res: any = {};
		for (const key in obj) {
			const val = obj[key];
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
export const quantityToMinutes = (qty: any): number => {
	if (!qty) return 0;

	let val: number = 0;
	let unit: string = "";

	// Handle AST objects
	if (typeof qty === "object") {
		if (qty.type === ASTNodeType.Quantity && qty.value) {
			const sub = qty.value;
			if (sub.type === "single") val = sub.value as number;
			if (sub.type === "fraction") val = sub.value as number;
			if (sub.type === "range" && sub.range)
				val = (sub.range.min + sub.range.max) / 2;
			unit = qty.unit || "";
		} else if (qty.value !== undefined) {
			// Fallback for simple objects
			let raw = qty.value;
			if (typeof raw === "object" && raw !== null) {
				if (raw.type === "single") raw = raw.value;
				else if (raw.type === "fraction") raw = raw.value;
				else if (raw.type === "range" && raw.range)
					raw = (raw.range.min + raw.range.max) / 2;
			}
			val = raw;
			unit = qty.unit || "";
		}
	} else {
		return 0;
	}

	if (typeof val !== "number") return 0;

	const u = resolveTimeUnit(unit);

	// Time conversions to minutes
	if (u === "d") return val * 60 * 24;
	if (u === "h") return val * 60;
	if (u === "m") return val;
	if (u === "s") return val / 60;

	return val;
};

/**
 * Multiplies a compiled quantity value by a scale factor.
 * Handles plain numbers, single/range/fraction QuantityValueAST objects.
 * String quantities (TextQuantity) and undefined values are left unchanged.
 *
 * `text`/`numerator`/`denominator` capture the original source string (e.g. "1/2")
 * and are only valid for the unscaled value, so they're cleared here rather than
 * carried over stale — display code must fall back to the scaled numeric `value`.
 */
export const scaleQty = (qty: any, factor: number): any => {
	if (factor === 1) return qty;
	if (typeof qty === "number") return qty * factor;
	if (!qty || typeof qty !== "object") return qty;

	if (qty.type === "single" && typeof qty.value === "number") {
		return { ...qty, value: qty.value * factor, text: undefined };
	}
	if (qty.type === "range") {
		return {
			...qty,
			value: typeof qty.value === "number" ? qty.value * factor : qty.value,
			range: qty.range
				? { min: qty.range.min * factor, max: qty.range.max * factor }
				: qty.range,
			text: undefined,
		};
	}
	if (qty.type === "fraction" && typeof qty.value === "number") {
		return {
			...qty,
			value: qty.value * factor,
			text: undefined,
			numerator: undefined,
			denominator: undefined,
		};
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

export const getNumericQty = (q: any): number | null => {
	if (q === undefined || q === null) return null;
	if (typeof q === "number") return q;

	const val = q.type === ASTNodeType.Quantity ? q.value : q;
	if (val && typeof val === "object") {
		if (
			val.type === "fraction" ||
			val.type === "range" ||
			val.type === "single"
		) {
			return val.value !== null ? val.value : null;
		}
	} else if (typeof val === "number") {
		return val;
	}
	return null;
};

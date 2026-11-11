import type { GramLocale } from "@gram-lang/i18n";
import { UNIT_CONVERSIONS } from "@gram-lang/i18n";

/** What the scale section reads of the playground. */
export interface ScaleState {
	shoppingList?: ShoppingItem[];
	scaleFactorString?: string;
	scaleTargetId: string | null;
	scaleTargetQty: number | null;
	scaleTargetUnit: string;
}

/** An ingredient of the shopping list, as the section offers it as a target. */
export interface ShoppingItem {
	id: string;
	name: string;
	qty?: number;
	unit?: string;
}

/** Every unit a target quantity can be written in. */
export const knownUnits: string[] = Array.from(
	new Set([
		...Object.keys(UNIT_CONVERSIONS.mass.map),
		...Object.keys(UNIT_CONVERSIONS.volume.map),
	]),
);

/** Whether the scale is anything but 100% of the whole recipe. */
export function isScaleModified(state: ScaleState): boolean {
	return Boolean(
		(state.scaleFactorString && state.scaleFactorString !== "100") ||
			state.scaleTargetId,
	);
}

/** What the scale is, in a few words: the tooltip of the section's dot. */
export function scaleBadgeTitle(state: ScaleState, t: GramLocale): string {
	if (state.scaleTargetId && state.shoppingList) {
		const item = state.shoppingList.find((i) => i.id === state.scaleTargetId);
		const qtyStr =
			state.scaleTargetQty !== null
				? `${state.scaleTargetQty}${state.scaleTargetUnit ? ` ${state.scaleTargetUnit}` : ""}`
				: "";
		const name = item?.name || state.scaleTargetId;
		return `${t.playground.badges.byIngredient}: ${name}${qtyStr ? ` (${qtyStr})` : ""}`;
	}
	const factor = state.scaleFactorString || "100";
	return `${t.playground.options.scaleGlobal}: ${factor}%`;
}

/**
 * The quantity a cook types, as a number: "300", "1.5" or "3/4". `null` when it
 * is empty or cannot be read (a fraction with a zero or a missing part).
 */
export function parseScaleQuantity(text: string): number | null {
	if (!text) return null;
	let parsed: number | null = null;
	if (text.includes("/")) {
		const parts = text.split("/");
		if (parts.length === 2) {
			const n = Number.parseFloat(parts[0] as string);
			const d = Number.parseFloat(parts[1] as string);
			if (!Number.isNaN(n) && !Number.isNaN(d) && d !== 0) parsed = n / d;
		}
	} else {
		parsed = Number.parseFloat(text);
	}
	return parsed !== null && !Number.isNaN(parsed) ? parsed : null;
}

/**
 * What choosing an ingredient as the target sets: the ingredient, its unit, and
 * its quantity when it is a number. Nothing more when it is cleared.
 */
export function targetChange(
	id: string,
	shoppingList: ShoppingItem[] | undefined,
): { id: string | null; unit?: string; qty?: number | null } {
	const change: { id: string | null; unit?: string; qty?: number | null } = {
		id: id || null,
	};
	if (id && shoppingList) {
		const item = shoppingList.find((i) => i.id === id);
		if (item) {
			change.unit = item.unit || "";
			change.qty = item.qty && typeof item.qty === "number" ? item.qty : null;
		}
	}
	return change;
}

/** The units that start with what is typed, then those that contain it; all of them when empty. */
export function matchingUnits(units: string[], typed: string): string[] {
	const query = (typed || "").trim().toLowerCase();
	if (!query) return units;
	const startsWith: string[] = [];
	const contains: string[] = [];
	for (const unit of units) {
		const lower = unit.toLowerCase();
		if (lower.startsWith(query)) startsWith.push(unit);
		else if (lower.includes(query)) contains.push(unit);
	}
	return [...startsWith, ...contains];
}

/** The unit list under its field: whether it is open, and which unit is highlighted (-1: none). */
export interface UnitListState {
	open: boolean;
	highlighted: number;
}

/** What a key does to the unit list. */
export interface UnitKeyResult extends UnitListState {
	/** Whether the key's usual behavior is stopped. */
	preventDefault: boolean;
	/** The index of the unit to pick. */
	select?: number;
	/** Whether the scale is applied. */
	submit?: boolean;
}

/**
 * What a key does to the unit list of `count` units: the arrows open it and
 * move in it, Enter picks the highlighted unit or, with none, applies the scale,
 * Escape closes it, Tab leaves it.
 */
export function unitKey(
	key: string,
	state: UnitListState,
	count: number,
): UnitKeyResult {
	const { open, highlighted } = state;
	const same = { open, highlighted, preventDefault: false };
	switch (key) {
		case "ArrowDown":
			if (!open) return { open: true, highlighted: 0, preventDefault: true };
			if (count > 0) {
				return {
					open,
					highlighted: Math.min(highlighted + 1, count - 1),
					preventDefault: true,
				};
			}
			return { ...same, preventDefault: true };
		case "ArrowUp":
			if (!open) {
				return { open: true, highlighted: count - 1, preventDefault: true };
			}
			if (count > 0) {
				return {
					open,
					highlighted: Math.max(highlighted - 1, 0),
					preventDefault: true,
				};
			}
			return { ...same, preventDefault: true };
		case "Enter":
			if (open && highlighted >= 0 && highlighted < count) {
				return { ...same, preventDefault: true, select: highlighted };
			}
			return { open: false, highlighted, preventDefault: false, submit: true };
		case "Escape":
			if (open) return { open: false, highlighted, preventDefault: true };
			return same;
		case "Tab":
			return { open: false, highlighted, preventDefault: false };
		default:
			return same;
	}
}

/**
 * The overall scale, as the percentage field writes it ("150", "37.5"), that
 * turns the recipe's own portions into `portions`. `null` for a count that is
 * not a positive number, or a recipe that declares no portions.
 */
export function factorForPortions(
	portions: number,
	base: number | null | undefined,
): string | null {
	if (!base || base <= 0 || !Number.isFinite(portions) || portions <= 0) {
		return null;
	}
	return ((portions / base) * 100).toFixed(2).replace(/\.?0+$/, "");
}

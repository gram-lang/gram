/**
 * Timers and section anchors, read from what the recipe wrote (`raw`) with
 * `parseDuration` (@gram-lang/i18n): `1h30`, `1:30 h`, `5'30"`, `1h30-2h`.
 * The grammar's quantity/unit split is never used for the duration.
 *
 * A duration Gram cannot read is never guessed: it gives a warning and counts
 * for nothing. An unknown unit keeps `INVALID_UNIT`, a number alone keeps
 * `MISSING_UNIT` (as before); every other reason is `INVALID_DURATION`.
 */

import {
	type DurationFailure,
	type DurationResult,
	type DurationUnit,
	parseDuration,
	resolveTimeUnit,
} from "@gram-lang/i18n";
import type { QuantityValueAST } from "@gram-lang/parser";

/** The unit a compiled timer or anchor is written in. */
export type DisplayUnit = "d" | "h" | "min" | "s";

export const DISPLAY_UNIT: Record<DurationUnit, DisplayUnit> = {
	d: "d",
	h: "h",
	m: "min",
	s: "s",
};

/** Exact factors, so `5'30"` gives 330 s and not 330.00000000000006. */
const SECONDS: Record<DurationUnit, number> = {
	d: 86400,
	h: 3600,
	m: 60,
	s: 1,
};

/**
 * Why a duration is refused with `INVALID_DURATION`: a reason of
 * `parseDuration`, or one that only applies to a section anchor.
 */
export type InvalidDurationReason =
	| Exclude<DurationFailure, "empty" | "missingUnit" | "unknownUnit">
	| "anchorRange"
	| "anchorSeconds";

/** What went wrong, as the compiler reports it. */
export type DurationProblem =
	| { code: "MISSING_UNIT" }
	| { code: "INVALID_UNIT"; unit: string }
	| { code: "INVALID_DURATION"; reason: InvalidDurationReason };

type Parsed = Extract<DurationResult, { ok: true }>;

const problemOf = (
	result: Extract<DurationResult, { ok: false }>,
): DurationProblem => {
	switch (result.reason) {
		case "empty":
		case "missingUnit":
			return { code: "MISSING_UNIT" };
		case "unknownUnit":
			return { code: "INVALID_UNIT", unit: result.unit ?? "" };
		default:
			return { code: "INVALID_DURATION", reason: result.reason };
	}
};

/** The smallest unit written on any side (`1h30-2h` → minutes). */
const smallestUnit = (parsed: Parsed): DurationUnit => {
	let smallest: DurationUnit = "d";
	for (const side of parsed.sides) {
		for (const part of side.parts) {
			if (SECONDS[part.unit] < SECONDS[smallest]) smallest = part.unit;
		}
	}
	return smallest;
};

/** A side's duration, counted in `unit`. */
const sideIn = (side: Parsed["sides"][number], unit: DurationUnit): number =>
	side.parts.reduce((sum, p) => sum + p.value * SECONDS[p.unit], 0) /
	SECONDS[unit];

/**
 * The duration as a quantity in the smallest unit written, so a program that
 * reads `quantity`/`unit` stays right: `1h20` is `80 min`, not `1.333 h`.
 */
const toQuantity = (
	parsed: Parsed,
): { quantity: QuantityValueAST; unit: DurationUnit } => {
	const unit = smallestUnit(parsed);
	const [first, second] = parsed.sides;
	const value = sideIn(first, unit);
	if (!second) return { quantity: { type: "single", value }, unit };
	const max = sideIn(second, unit);
	return {
		quantity: {
			type: "range",
			value: (value + max) / 2,
			range: { min: value, max },
		},
		unit,
	};
};

export type TimerReading =
	| { ok: true; quantity: QuantityValueAST; unit: DisplayUnit }
	| { ok: false; problem: DurationProblem };

/**
 * A timer's duration. `kept` is the grammar's quantity when the timer is
 * written as before (`10 min`, `1.5h`, `1-2 h`): its `quantity`/`unit` stay
 * exactly as they were. A new writing (`1h30`, `1:30 h`) gets its quantity
 * in the smallest unit written.
 */
export function readTimer(
	raw: string,
	kept?: { value?: QuantityValueAST | null; unit?: string | null },
): TimerReading {
	const parsed = parseDuration(raw);
	if (!parsed.ok) return { ok: false, problem: problemOf(parsed) };

	const keptUnit = kept?.unit ? resolveTimeUnit(kept.unit) : undefined;
	if (kept?.value && keptUnit && keptUnit in DISPLAY_UNIT) {
		return {
			ok: true,
			quantity: kept.value,
			unit: DISPLAY_UNIT[keptUnit as DurationUnit],
		};
	}
	const { quantity, unit } = toQuantity(parsed);
	return { ok: true, quantity, unit: DISPLAY_UNIT[unit] };
}

export type AnchorReading =
	| {
			ok: true;
			value: number;
			unit: Exclude<DisplayUnit, "s">;
			/** The number as written, for a single term (`1,5` in `-1,5h`). */
			text?: string;
	  }
	| { ok: false; problem: DurationProblem };

const SIGN = /^\s*-\s*/;
const LAST_WORD = /(\p{L}+)\.?\s*$/u;

/**
 * A section anchor (`-2h`, `-1j 12h`, `-1:30 h`): strictly negative, one
 * duration (no range), in days, hours and minutes (no seconds, no prime).
 * The value comes back positive; the sign is the caller's.
 */
export function readAnchor(raw: string): AnchorReading {
	const sign = SIGN.exec(raw);
	if (!sign) return { ok: false, problem: { code: "MISSING_UNIT" } };
	const body = raw.slice(sign[0].length);

	const parsed = parseDuration(body);
	if (!parsed.ok) return { ok: false, problem: problemOf(parsed) };
	if (parsed.range) {
		return {
			ok: false,
			problem: { code: "INVALID_DURATION", reason: "anchorRange" },
		};
	}

	const [side] = parsed.sides;
	if (side.form === "prime" || side.parts.some((p) => p.unit === "s")) {
		// `-30s`: a unit written out keeps the INVALID_UNIT it always gave.
		const word = side.form === "units" ? LAST_WORD.exec(body)?.[1] : undefined;
		if (word && resolveTimeUnit(word) === "s") {
			return { ok: false, problem: { code: "INVALID_UNIT", unit: word } };
		}
		return {
			ok: false,
			problem: { code: "INVALID_DURATION", reason: "anchorSeconds" },
		};
	}
	// Anticipation needs a duration: `-0h` means nothing.
	if (parsed.minutes === 0) {
		return { ok: false, problem: { code: "MISSING_UNIT" } };
	}

	// An anchor written with days stays in days (`-1j 12h` is `1.5 d`): only an
	// anchor in days opens a working day (`sectionDays` in task-graph.ts), so
	// `36 h` would move the section from the day before into the day itself.
	const unit = side.parts.some((p) => p.unit === "d")
		? "d"
		: smallestUnit(parsed);
	return {
		ok: true,
		value: sideIn(side, unit),
		unit: DISPLAY_UNIT[unit] as Exclude<DisplayUnit, "s">,
		...(side.parts.length === 1 && {
			text: body.match(/\d+(?:[.,]\d+)?/)?.[0],
		}),
	};
}

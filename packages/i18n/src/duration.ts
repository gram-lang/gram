/**
 * Durations as a recipe writes them: `1h30`, `1 hr 30 mins`, `1 heure 30`,
 * `1:30 h`, `5'30"`, `45 min - 1 h`. `parseDuration` reads one into minutes,
 * or says precisely why it will not: it never guesses, and never turns an
 * unclear duration into 0.
 *
 * Reading happens in two steps. The text is first cut into tokens by kind of
 * character (numbers, letters, primes, `:`, `+`, `-`), so spaces carry no
 * meaning (`1h30`, `1 h 30`, `1hr 30` read alike), except between a whole
 * number and a fraction (`1 1/2`). The token sequence is then checked against
 * the three forms (units, clock, primes) and the range rules.
 *
 * The units come from `TIME_DICTIONARIES`, every language at once: a timer
 * reads without knowing the language of the recipe.
 */

import { TIME_GLOBAL, TIME_TO_MINUTES } from "./time";

/** A canonical time unit: day, hour, minute, second. */
export type DurationUnit = "d" | "h" | "m" | "s";

/** How a duration is written: `1h30` (units), `1:30 h` (clock), `5'30"` (primes). */
export type DurationForm = "units" | "clock" | "prime";

/** One term of a duration, in the unit it was written in (`1h30` is `1 h` and `30 m`). */
export interface DurationPart {
	value: number;
	unit: DurationUnit;
}

/** One duration, or one side of a range. */
export interface DurationSide {
	minutes: number;
	parts: DurationPart[];
	form: DurationForm;
}

/**
 * Why a text is not a duration Gram reads:
 * - `empty`: nothing between the braces;
 * - `missingUnit`: a number with no unit at all (`30`, `1-2`);
 * - `unknownUnit`: a word right after a number that is not a time unit (`3 bananas`);
 * - `words`: any other word (`half an hour`, `1 heure et demie`, `about 10 min`);
 * - `multiplication`: `2 * 2 min`, left to `[Repeat]`;
 * - `iso8601`: `PT1H30M`, a notation for machines;
 * - `unexpected`: a character or a sign out of place (`1h, 30min`, `-10 min`, `1/0 h`);
 * - `ambiguousClock`: a two-part clock with no unit (`1:30`: hours or minutes?);
 * - `clockFormat`: a malformed clock (`1:5 h`, `1:30 d`, more than three parts);
 * - `unitOrder`: units not from the largest to the smallest (`30min 1h`);
 * - `duplicateUnit`: the same unit twice (`1h 2h`);
 * - `overflow60`: 60 or more after an hour or a minute (`1h75`, `1:75 h`);
 * - `decimalInCompound`: a decimal or a fraction in a duration of several terms (`1.5h30`);
 * - `decimalPrime`: a decimal or a fraction with a prime (`1.5'`);
 * - `bareNumber`: a number with no unit where none can be implied (`1j3`, `1 30 min`);
 * - `reversedRange`: a range written from the largest to the smallest (`2-1 h`):
 *   the minimum comes first, in the order of the text (logical order, so a
 *   right-to-left language writes it the same way);
 * - `emptyRange`: a range whose two sides are equal (`1-1 h`);
 * - `ambiguousRange`: a range where one side's unit cannot be told (`1-2h30`).
 */
export type DurationFailure =
	| "empty"
	| "missingUnit"
	| "unknownUnit"
	| "words"
	| "multiplication"
	| "iso8601"
	| "unexpected"
	| "ambiguousClock"
	| "clockFormat"
	| "unitOrder"
	| "duplicateUnit"
	| "overflow60"
	| "decimalInCompound"
	| "decimalPrime"
	| "bareNumber"
	| "reversedRange"
	| "emptyRange"
	| "ambiguousRange";

export type DurationResult =
	| {
			ok: true;
			/** The duration the schedule uses: the middle of a range. */
			minutes: number;
			range?: { min: number; max: number };
			/** One side, or the two sides of a range. */
			sides: [DurationSide] | [DurationSide, DurationSide];
	  }
	| {
			ok: false;
			reason: DurationFailure;
			/** The word read as a unit, for `unknownUnit`. */
			unit?: string;
	  };

type Failure = Extract<DurationResult, { ok: false }>;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * `int`: digits only (`30`). `decimal`: `1.5`, `1,5`. `fraction`: `1/2`, `½`,
 * `1½`, `1 1/2`. Only an `int` follows an hour or a minute without a unit, or
 * makes a clock.
 */
type NumKind = "int" | "decimal" | "fraction";

type Token =
	| { kind: "num"; value: number; text: string; num: NumKind; space: boolean }
	| { kind: "word"; text: string; unit?: DurationUnit }
	| { kind: "prime"; unit: "m" | "s" }
	| { kind: "colon" }
	| { kind: "plus" }
	| { kind: "dash" }
	| { kind: "star" };

const FRACTION_GLYPHS: Record<string, number> = {
	"¼": 1 / 4,
	"½": 1 / 2,
	"¾": 3 / 4,
	"⅓": 1 / 3,
	"⅔": 2 / 3,
	"⅕": 1 / 5,
	"⅖": 2 / 5,
	"⅗": 3 / 5,
	"⅘": 4 / 5,
	"⅙": 1 / 6,
	"⅚": 5 / 6,
	"⅛": 1 / 8,
	"⅜": 3 / 8,
	"⅝": 5 / 8,
	"⅞": 7 / 8,
};

const MINUTE_PRIMES = new Set(["'", "’", "′"]);
const SECOND_PRIMES = new Set(['"', "”", "″"]);
const DASHES = new Set(["-", "–"]);
const STARS = new Set(["*", "×"]);

const isDigit = (c: string | undefined) =>
	c !== undefined && c >= "0" && c <= "9";
const isLetter = (c: string | undefined) =>
	c !== undefined && /[\p{L}\p{M}]/u.test(c);

/** `PT1H30M`, `P1D`: ISO 8601, recognized only to say so. */
const ISO_8601 =
	/^p(?=\d|t\d)(\d+([.,]\d+)?[ymwd])*(t(\d+([.,]\d+)?[hms])+)?$/i;

const resolveUnit = (word: string): DurationUnit | undefined => {
	const unit = TIME_GLOBAL[word];
	return unit !== undefined && unit in TIME_TO_MINUTES
		? (unit as DurationUnit)
		: undefined;
};

/**
 * Cuts a duration into tokens: the step that makes `1h30`, `1 h 30` and
 * `1hr 30` the same sequence. A unit is any run of letters, in any script,
 * lowercased, with a `.` right after it dropped (`hr.`, `min.`, `Std.`).
 */
export function tokenizeDuration(
	text: string,
): { ok: true; tokens: Token[] } | Failure {
	const s = text.normalize("NFC");
	const tokens: Token[] = [];
	let space = false;
	let i = 0;

	while (i < s.length) {
		const c = s[i] as string;

		if (/\s/u.test(c)) {
			space = true;
			i++;
			continue;
		}

		if (isDigit(c) || c in FRACTION_GLYPHS) {
			let j = i;
			while (isDigit(s[j])) j++;
			let num: NumKind = "int";
			let value: number;
			if ((s[j] === "." || s[j] === ",") && isDigit(s[j + 1])) {
				j++;
				while (isDigit(s[j])) j++;
				num = "decimal";
				value = Number(s.slice(i, j).replace(",", "."));
			} else if (s[j] === "/" && j > i && isDigit(s[j + 1])) {
				const slash = j;
				j++;
				while (isDigit(s[j])) j++;
				const den = Number(s.slice(slash + 1, j));
				if (den === 0) return { ok: false, reason: "unexpected" };
				num = "fraction";
				value = Number(s.slice(i, slash)) / den;
			} else if (s[j] !== undefined && (s[j] as string) in FRACTION_GLYPHS) {
				const whole = j > i ? Number(s.slice(i, j)) : 0;
				value = whole + (FRACTION_GLYPHS[s[j] as string] as number);
				j++;
				num = "fraction";
			} else {
				value = Number(s.slice(i, j));
			}
			tokens.push({ kind: "num", value, text: s.slice(i, j), num, space });
			i = j;
		} else if (isLetter(c)) {
			let j = i;
			while (isLetter(s[j])) j++;
			const word = s.slice(i, j).toLowerCase();
			if (s[j] === ".") j++;
			tokens.push({ kind: "word", text: word, unit: resolveUnit(word) });
			i = j;
		} else if (MINUTE_PRIMES.has(c)) {
			// Two apostrophes are a second (`5'30''`).
			if (MINUTE_PRIMES.has(s[i + 1] as string)) {
				tokens.push({ kind: "prime", unit: "s" });
				i += 2;
			} else {
				tokens.push({ kind: "prime", unit: "m" });
				i++;
			}
		} else if (SECOND_PRIMES.has(c)) {
			tokens.push({ kind: "prime", unit: "s" });
			i++;
		} else if (c === ":") {
			tokens.push({ kind: "colon" });
			i++;
		} else if (c === "+") {
			tokens.push({ kind: "plus" });
			i++;
		} else if (DASHES.has(c)) {
			tokens.push({ kind: "dash" });
			i++;
		} else if (STARS.has(c)) {
			tokens.push({ kind: "star" });
			i++;
		} else {
			return { ok: false, reason: "unexpected" };
		}
		space = false;
	}

	return { ok: true, tokens: mergeMixedFractions(tokens) };
}

/**
 * `1 1/2` and `1 ½` are one number: the only place where a space means
 * something. A whole number followed by a fraction it is not glued to.
 */
function mergeMixedFractions(tokens: Token[]): Token[] {
	const out: Token[] = [];
	for (const token of tokens) {
		const prev = out[out.length - 1];
		if (
			token.kind === "num" &&
			token.num === "fraction" &&
			token.space &&
			token.value < 1 &&
			prev?.kind === "num" &&
			prev.num === "int"
		) {
			out[out.length - 1] = {
				...prev,
				value: prev.value + token.value,
				text: `${prev.text} ${token.text}`,
				num: "fraction",
			};
		} else {
			out.push(token);
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const RANK: Record<DurationUnit, number> = { d: 0, h: 1, m: 2, s: 3 };

/** The unit a bare number takes after a term: minutes after an hour, seconds after a minute. */
const IMPLIED: Partial<Record<DurationUnit, DurationUnit>> = { h: "m", m: "s" };

const partMinutes = ({ value, unit }: DurationPart) =>
	unit === "s" ? value / 60 : value * (TIME_TO_MINUTES[unit] as number);

const makeSide = (parts: DurationPart[], form: DurationForm): DurationSide => ({
	minutes: parts.reduce((sum, part) => sum + partMinutes(part), 0),
	parts,
	form,
});

type NumToken = Extract<Token, { kind: "num" }>;

/**
 * What one side of a duration turned out to be. A bare number (`1` in `1-2 h`)
 * or a bare two-part clock (`1:30` in `1:30-2:00 h`) is not a duration yet: it
 * may take its unit from the other side of a range.
 */
type Analysis =
	| { kind: "bare"; num: NumToken }
	| { kind: "bareClock"; nums: [NumToken, NumToken] }
	| {
			kind: "side";
			side: DurationSide;
			/** Set for a single term (`2 h`, `7'`): the unit a bare left side may take. */
			single?: { unit: DurationUnit; prime: boolean };
			/** Set for a two-part clock (`2:00 h`): the unit a bare left clock may take. */
			clockUnit?: DurationUnit;
	  }
	| Failure;

const fail = (reason: DurationFailure): Failure => ({ ok: false, reason });

function analyzeSide(tokens: Token[]): Analysis {
	if (tokens.some((t) => t.kind === "colon")) return analyzeClock(tokens);
	return analyzeTerms(tokens);
}

/** `h:mm:ss`, or `h:mm h` / `m:ss min`. */
function analyzeClock(tokens: Token[]): Analysis {
	const nums: NumToken[] = [];
	let k = 0;
	for (;;) {
		const t = tokens[k];
		if (t?.kind !== "num") return fail("clockFormat");
		nums.push(t);
		k++;
		if (tokens[k]?.kind !== "colon") break;
		k++;
	}
	const rest = tokens.slice(k);
	const unitToken = rest[0];
	if (
		nums.length < 2 ||
		nums.length > 3 ||
		rest.length > 1 ||
		(unitToken && unitToken.kind !== "word")
	) {
		return fail("clockFormat");
	}
	const [first, ...others] = nums as [NumToken, ...NumToken[]];
	if (first.num !== "int") return fail("clockFormat");
	for (const n of others) {
		if (n.num !== "int" || n.text.length !== 2) return fail("clockFormat");
	}
	if (others.some((n) => n.value >= 60)) return fail("overflow60");

	const unit = unitToken?.kind === "word" ? unitToken.unit : undefined;
	const values = nums.map((n) => n.value);
	if (nums.length === 3) {
		if (unitToken && unit !== "h") return fail("clockFormat");
		const [h, m, s] = values as [number, number, number];
		const parts: DurationPart[] = [
			{ value: h, unit: "h" },
			{ value: m, unit: "m" },
			{ value: s, unit: "s" },
		];
		return { kind: "side", side: makeSide(parts, "clock") };
	}
	if (!unitToken)
		return { kind: "bareClock", nums: nums as [NumToken, NumToken] };
	if (unit !== "h" && unit !== "m") return fail("clockFormat");
	return {
		kind: "side",
		side: clockSide(values[0] as number, values[1] as number, unit),
		clockUnit: unit,
	};
}

const clockSide = (a: number, b: number, unit: "h" | "m"): DurationSide =>
	makeSide(
		[
			{ value: a, unit },
			{ value: b, unit: unit === "h" ? "m" : "s" },
		],
		"clock",
	);

/** `1h30`, `1 hr 30 min`, `2 j 4 h`, `1h + 30min`, `5'30"`. */
function analyzeTerms(tokens: Token[]): Analysis {
	const parts: DurationPart[] = [];
	let primes = 0;
	let k = 0;

	while (k < tokens.length) {
		const num = tokens[k];
		if (num?.kind !== "num") return fail("unexpected");
		const next = tokens[k + 1];

		// A number with no unit after it.
		if (next?.kind !== "word" && next?.kind !== "prime") {
			if (next !== undefined) return fail("bareNumber");
			if (parts.length === 0) return { kind: "bare", num };
			const prev = tokens[k - 1];
			const last = parts[parts.length - 1] as DurationPart;
			const implied = IMPLIED[last.unit];
			if (prev?.kind === "plus" || !implied) return fail("bareNumber");
			if (num.num !== "int") return fail("decimalInCompound");
			if (num.value >= 60) return fail("overflow60");
			parts.push({ value: num.value, unit: implied });
			k++;
			break;
		}

		const unit = next.unit as DurationUnit;
		if (next.kind === "prime") {
			if (num.num !== "int") return fail("decimalPrime");
			primes++;
		}
		const last = parts[parts.length - 1];
		if (last) {
			if (last.unit === unit) return fail("duplicateUnit");
			if (RANK[last.unit] > RANK[unit]) return fail("unitOrder");
		}
		parts.push({ value: num.value, unit });
		k += 2;

		if (tokens[k]?.kind === "plus") {
			if (tokens[k + 1]?.kind !== "num") return fail("unexpected");
			k++;
		}
	}

	if (
		parts.length > 1 &&
		tokens.some((t) => t.kind === "num" && t.num !== "int")
	) {
		return fail("decimalInCompound");
	}
	const terms = tokens.filter((t) => t.kind === "word" || t.kind === "prime");
	const side = makeSide(parts, primes === terms.length ? "prime" : "units");
	if (parts.length === 1) {
		const only = parts[0] as DurationPart;
		return {
			kind: "side",
			side,
			single: { unit: only.unit, prime: primes === 1 },
		};
	}
	return { kind: "side", side };
}

// ---------------------------------------------------------------------------
// parseDuration
// ---------------------------------------------------------------------------

/**
 * Reads a duration as a recipe writes it, in any language Gram knows:
 * `parseDuration("1h30")` is `{ ok: true, minutes: 90, … }`,
 * `parseDuration("1:30")` is `{ ok: false, reason: "ambiguousClock" }`.
 *
 * A range keeps both sides and gives its middle as `minutes`, as the schedule
 * uses it. No sign is read (an anchor's `-` is the caller's), and no duration
 * is capped: that is the compiler's job.
 */
export function parseDuration(text: string): DurationResult {
	const trimmed = text.trim();
	if (trimmed === "") return fail("empty");
	if (ISO_8601.test(trimmed.replace(/\s/gu, ""))) return fail("iso8601");

	const tokenized = tokenizeDuration(trimmed);
	if (!tokenized.ok) return tokenized;
	const { tokens } = tokenized;

	// Words and stars first, left to right: they say most about what went wrong.
	for (let k = 0; k < tokens.length; k++) {
		const t = tokens[k] as Token;
		const prev = tokens[k - 1];
		if (t.kind === "star") return fail("multiplication");
		if (t.kind !== "word") continue;
		// `2 x 5 min`: an x between two numbers is a multiplication sign.
		if (
			t.text === "x" &&
			prev?.kind === "num" &&
			tokens[k + 1]?.kind === "num"
		) {
			return fail("multiplication");
		}
		if (prev?.kind !== "num") return fail("words");
		if (!t.unit) return { ok: false, reason: "unknownUnit", unit: t.text };
	}

	const dashes = tokens.filter((t) => t.kind === "dash").length;
	if (dashes === 0) {
		const a = analyzeSide(tokens);
		if ("ok" in a) return a;
		if (a.kind === "bare") return fail("missingUnit");
		if (a.kind === "bareClock") return fail("ambiguousClock");
		return { ok: true, minutes: a.side.minutes, sides: [a.side] };
	}

	const dash = tokens.findIndex((t) => t.kind === "dash");
	const leftTokens = tokens.slice(0, dash);
	const rightTokens = tokens.slice(dash + 1);
	if (dashes > 1 || leftTokens.length === 0 || rightTokens.length === 0) {
		return fail("unexpected");
	}
	return parseRange(analyzeSide(leftTokens), analyzeSide(rightTokens));
}

function parseRange(left: Analysis, right: Analysis): DurationResult {
	if ("ok" in left) return left;
	if ("ok" in right) return right;
	if (left.kind === "bare" && right.kind === "bare") return fail("missingUnit");
	if (left.kind === "bareClock" && right.kind === "bareClock") {
		return fail("ambiguousClock");
	}
	if (right.kind !== "side") return fail("ambiguousRange");

	let min: DurationSide;
	if (left.kind === "side") {
		min = left.side;
	} else if (left.kind === "bare") {
		// `1-2 h`, `5-7'`: the left number takes the unit of a single right term.
		const single = right.single;
		if (!single) return fail("ambiguousRange");
		if (single.prime && left.num.num !== "int") return fail("decimalPrime");
		min = makeSide(
			[{ value: left.num.value, unit: single.unit }],
			right.side.form,
		);
	} else {
		// `1:30-2:00 h`: the left clock takes the unit of the right clock.
		const unit = right.clockUnit;
		if (unit !== "h" && unit !== "m") return fail("ambiguousRange");
		min = clockSide(left.nums[0].value, left.nums[1].value, unit);
	}

	const max = right.side;
	if (min.minutes > max.minutes) return fail("reversedRange");
	if (min.minutes === max.minutes) return fail("emptyRange");
	return {
		ok: true,
		minutes: (min.minutes + max.minutes) / 2,
		range: { min: min.minutes, max: max.minutes },
		sides: [min, max],
	};
}

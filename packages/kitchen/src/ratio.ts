import {
	convertUnitInFamily,
	isMeasureUnit,
	isTermValue,
	sameCountUnit,
	type Term,
	type TermValue,
} from "@gram-lang/i18n";
import type { UnitConverter } from "./scale/types";
import { termsOfUsage } from "./terms";
import type {
	PendingRatio,
	ProcessedSection,
	ProcessedTimer,
	RatioFormula,
	RatioSpec,
	StepToken,
	Usage,
} from "./types";
import { type Warning, WarningCode, pushWarning } from "./warnings";
import {
	isDurationTooLong,
	maxDurationIn,
	quantityToMinutes,
	round2,
} from "./utils";

/**
 * Why a ratio is not resolved:
 * - `deferred`: kitchen cannot tell, the analyzer may (a density, a unit
 *   weight, a target that is itself a share);
 * - `noTargetQuantity`: the target is written with no amount;
 * - `incompatibleUnits`: the two units never measure the same thing
 *   (`clove` and `slice`, a weight and a named piece, `g of`);
 * - `missingDensity`: across mass and volume, with no density;
 * - `missingUnitWeight`: between pieces and a weight, with no unit weight;
 * - `wholeUseAmbiguous`, `producerMassUnknown`: an intermediate used whole,
 *   when its mass cannot be told (analyzer);
 * - `stepProducer`: an intermediate used whole that a step makes
 *   (`Mix … ->&dough`), not a section: only a section's mass is weighed
 *   (analyzer). Since 1.5.0.
 */
export type RatioFailure =
	| "deferred"
	| "noTargetQuantity"
	| "incompatibleUnits"
	| "missingDensity"
	| "missingUnitWeight"
	| "wholeUseAmbiguous"
	| "producerMassUnknown"
	| "stepProducer";

export type RatioResolution =
	| { ok: true; amount: Term }
	| { ok: false; reason: RatioFailure };

/** A converter for one target: a density and a unit weight belong to an ingredient. */
export type TargetConverter = (targetId: string) => UnitConverter;

/** Kitchen's converter: within one family only (`g` and `kg`, `ml` and `l`). */
export const kitchenConverter =
	(lang?: string): TargetConverter =>
	() =>
	(value, fromUnit, toUnit) =>
		convertUnitInFamily(value, fromUnit, toUnit, lang);

/**
 * A unit followed by a linking word (`g de`, `g of`, `g d'`): the unit takes
 * several words, so `{1 / 100 g de @&farine}` reads `g de` as its unit.
 */
const LINKING_WORD = /\s(?:de|du|des|of|d['’])$/iu;

/** A unit that names a measure, or a count (no unit, a piece, a clove...). */
const isCount = (unit: string | null, lang?: string) =>
	!isMeasureUnit(unit, lang);

/** True for no unit at all, or a spelling of "a piece". */
const isPiece = (unit: string | null, lang?: string) =>
	isCount(unit, lang) && sameCountUnit(unit, null, lang);

/** The bounds of a value: a range's, or the number twice. */
function bounds(value: TermValue): { min: number; max: number } {
	if (typeof value === "number") return { min: value, max: value };
	if (value.type === "range") return value.range;
	return { min: value.value, max: value.value };
}

/**
 * `value` times a factor that may itself be a range: a range comes out
 * whenever either side is one, its middle in `value`. Rounded to 2 decimals,
 * as scaling rounds.
 */
function multiply(
	value: TermValue,
	factor: { min: number; max: number },
): TermValue {
	const v = bounds(value);
	const lo = round2(v.min * factor.min);
	const hi = round2(v.max * factor.max);
	if (lo === hi) return { type: "single", value: lo };
	return {
		type: "range",
		value: round2((lo + hi) / 2),
		range: { min: lo, max: hi },
	};
}

/**
 * Why a target term does not convert into the denominator's unit, once the
 * converter could not: across mass and volume a density is missing, between
 * pieces and a weight a unit weight is, and a named piece (`clove`) never
 * weighs a weight.
 */
function failureOf(
	denominator: string | null,
	target: string | null,
	lang?: string,
): RatioFailure {
	const denCount = isCount(denominator, lang);
	const targetCount = isCount(target, lang);
	if (!denCount && !targetCount) return "missingDensity";
	if (denCount && !isPiece(denominator, lang)) return "incompatibleUnits";
	return "missingUnitWeight";
}

/**
 * Resolves one ratio against the terms of its target: each term converted
 * into the denominator's unit (two counts only match when they name the same
 * thing, `clove` and `cloves`), added up (ranges kept), divided by the
 * denominator, then the numerator multiplied by it.
 *
 * `final` says whether a failed conversion is final (analyzer, which brings
 * the densities and unit weights) or may still resolve later (kitchen: then
 * `deferred`). Two counts that differ never resolve, in either mode.
 */
export function resolveRatio(
	spec: RatioSpec,
	targetTerms: Term[],
	convert: UnitConverter,
	final: boolean,
	lang?: string,
): RatioResolution {
	const denUnit = spec.denominator.unit;
	if (denUnit && LINKING_WORD.test(denUnit)) {
		return { ok: false, reason: "incompatibleUnits" };
	}
	if (targetTerms.length === 0) {
		return { ok: false, reason: "noTargetQuantity" };
	}

	let lo = 0;
	let hi = 0;
	for (const term of targetTerms) {
		let factor: number | null;
		if (isCount(denUnit, lang) && isCount(term.unit, lang)) {
			if (!sameCountUnit(denUnit, term.unit, lang)) {
				return { ok: false, reason: "incompatibleUnits" };
			}
			factor = 1;
		} else {
			factor = convert(1, term.unit ?? "", denUnit ?? "");
		}
		if (factor === null) {
			return {
				ok: false,
				reason: final ? failureOf(denUnit, term.unit, lang) : "deferred",
			};
		}
		const { min, max } = bounds(term.value);
		const sign = term.minus ? -1 : 1;
		lo += sign * min * factor;
		hi += sign * max * factor;
	}

	const per = spec.denominator.value;
	if (!(lo > 0) || !(hi > 0) || !(per > 0)) {
		return { ok: false, reason: "noTargetQuantity" };
	}
	return {
		ok: true,
		amount: {
			value: multiply(spec.numerator.value, { min: lo / per, max: hi / per }),
			unit: spec.numerator.unit,
		},
	};
}

/** A ratio that did not resolve, for the caller to turn into a warning. */
export interface RatioProblem {
	/** The ingredient, reference or timer that holds the ratio. */
	item: string;
	target: string;
	reason: Exclude<RatioFailure, "deferred"> | "durationTooLong";
	/** For `incompatibleUnits`: the denominator's unit as written. */
	unit?: string | null;
	spec: RatioSpec;
}

export interface RatioPassResult {
	/** A timer's duration changed: the schedule has to be laid out again. */
	timersChanged: boolean;
	problems: RatioProblem[];
}

/** The pending node `qty` keeps for a ratio not resolved. */
export function pendingRatio(spec: RatioSpec): PendingRatio {
	const term = (
		value: RatioSpec["numerator"]["value"] | null,
		unit: string | null,
	) => (unit ? { value, unit } : { value });
	return {
		type: "RatioQuantity",
		numerator: term(spec.numerator.value, spec.numerator.unit),
		denominator: term(
			{ type: "single", value: spec.denominator.value },
			spec.denominator.unit,
		),
		target: spec.target,
		referenceType: spec.referenceType,
		raw: spec.raw,
	} as PendingRatio;
}

const ratioOf = (usage: Usage): RatioSpec | undefined =>
	usage.formula && "ratio" in usage.formula
		? (usage.formula as RatioFormula).ratio
		: undefined;

/** Its amount still comes from another one: a share or a ratio not resolved. */
const isPending = (usage: Usage) =>
	usage.formula !== undefined && !isTermValue(usage.qty);

const isUsage = (token: StepToken): token is Usage =>
	typeof token === "object" && token !== null && "id" in token;

const isRatioTimer = (token: StepToken): token is ProcessedTimer =>
	typeof token === "object" &&
	token !== null &&
	"type" in token &&
	token.type === "timer" &&
	"ratio" in token &&
	token.ratio !== undefined;

/**
 * Where a usage looks for its target: an earlier option of its own
 * alternative when one has that id (`@butter{100 g}|@oil{80 / 100 g
 * @&butter}`), else the section's own mentions.
 */
function poolOf(
	spec: RatioSpec,
	earlierOptions: Usage[] | undefined,
	mentions: Usage[],
): Usage[] {
	return earlierOptions?.some((o) => o.id === spec.targetId)
		? earlierOptions
		: mentions;
}

export interface ResolveOptions {
	/** `kitchen` defers what needs a density or a unit weight; `analyzer` decides. */
	mode: "kitchen" | "analyzer";
	lang?: string;
	/**
	 * What an intermediate used whole weighs (`Roll out the &dough`, no
	 * amount written in the section): the terms to count from, or why it
	 * cannot be told. Only the analyzer knows a section's mass; without it,
	 * such a ratio waits (`deferred`).
	 */
	wholeUse?: (
		spec: RatioSpec,
	) => { terms: Term[] } | { reason: RatioFailure } | null;
}

/**
 * The one resolution of every ratio of a recipe, recalculated from what was
 * written (never from an amount already resolved), so it can run again on
 * scaled quantities or with a database. Section by section: the section's
 * ingredients and references first (alternatives' options included), in the
 * order of their dependencies, then every step token (the same values: the
 * same spec against the same mentions), timers included.
 *
 * A resolved ratio takes its numerator's unit (`5` eggs, `15 g` of salt) or,
 * on a timer, its duration. One not resolved keeps its pending node (and a
 * timer no duration). Pure apart from writing on `sections`; warnings are
 * the caller's: `problems` lists what will not resolve (in kitchen mode,
 * only `incompatibleUnits`, which no database can fix).
 */
export function resolveRatios(
	sections: ProcessedSection[],
	convertFor: TargetConverter,
	options: ResolveOptions,
): RatioPassResult {
	const final = options.mode === "analyzer";
	const problems: RatioProblem[] = [];
	let timersChanged = false;

	const resolveIn = (
		spec: RatioSpec,
		pool: Usage[],
		self?: Usage,
	): RatioResolution => {
		const targets = pool.filter((o) => o.id === spec.targetId && o !== self);
		if (targets.some(isPending)) return { ok: false, reason: "deferred" };
		let terms = targets.flatMap((t) => termsOfUsage(t));
		// An intermediate only used whole here: its section's mass, if known.
		if (
			terms.length === 0 &&
			targets.length > 0 &&
			spec.referenceType === "variable"
		) {
			const whole = options.wholeUse?.(spec);
			if (!whole)
				return { ok: false, reason: final ? "noTargetQuantity" : "deferred" };
			if ("reason" in whole) return { ok: false, reason: whole.reason };
			terms = whole.terms;
		}
		return resolveRatio(
			spec,
			terms,
			convertFor(spec.targetId),
			final,
			options.lang,
		);
	};

	// No unit is an absent `unit` (what `cleanObject` leaves), so a second
	// pass writes exactly what the first did.
	const writeUsage = (usage: Usage, spec: RatioSpec, res: RatioResolution) => {
		usage.qty = res.ok ? res.amount.value : pendingRatio(spec);
		const unit = res.ok ? res.amount.unit : null;
		if (unit) usage.unit = unit;
		else delete usage.unit;
	};

	const report = (item: string, spec: RatioSpec, res: RatioResolution) => {
		if (res.ok || res.reason === "deferred") return;
		if (!final && res.reason !== "incompatibleUnits") return;
		problems.push({
			item,
			target: spec.target,
			reason: res.reason,
			...(res.reason === "incompatibleUnits" && {
				unit: spec.denominator.unit,
			}),
			spec,
		});
	};

	sections.forEach((sec) => {
		const mentions = sec.ingredients;

		// The ratios of the section's own list, each with the earlier options
		// of its alternative (when it is an option).
		const entries: { usage: Usage; spec: RatioSpec; earlier?: Usage[] }[] = [];
		for (const item of mentions) {
			if (item.type === "alternative") {
				const earlier: Usage[] = [];
				for (const opt of item.options ?? []) {
					if (!isUsage(opt)) continue;
					const spec = ratioOf(opt);
					if (spec) entries.push({ usage: opt, spec, earlier: [...earlier] });
					earlier.push(opt);
				}
				continue;
			}
			const spec = ratioOf(item);
			if (spec) entries.push({ usage: item, spec });
		}

		// Start again from what was written, then resolve in the order of the
		// dependencies: a ratio waits while its target is itself pending.
		for (const { usage, spec } of entries) {
			writeUsage(usage, spec, { ok: false, reason: "deferred" });
		}
		let waiting = entries.filter(
			({ usage, spec }) => !spec.isGhost && !usage.isCircular,
		);
		let progress = true;
		while (progress && waiting.length > 0) {
			progress = false;
			const still: typeof waiting = [];
			for (const entry of waiting) {
				const res = resolveIn(
					entry.spec,
					poolOf(entry.spec, entry.earlier, mentions),
					entry.usage,
				);
				if (!res.ok && res.reason === "deferred") {
					still.push(entry);
					continue;
				}
				writeUsage(entry.usage, entry.spec, res);
				progress = true;
			}
			waiting = still;
		}

		// The step tokens: the same specs against the same mentions. Problems
		// are read here, where each ratio is written once.
		const resolveToken = (usage: Usage, earlier?: Usage[]) => {
			const spec = ratioOf(usage);
			if (!spec) return;
			if (spec.isGhost || usage.isCircular) {
				writeUsage(usage, spec, { ok: false, reason: "deferred" });
				return;
			}
			const res = resolveIn(spec, poolOf(spec, earlier, mentions), usage);
			writeUsage(usage, spec, res);
			report(usage.name || usage.id, spec, res);
		};

		for (const step of sec.steps) {
			if (step.type !== "step") continue;
			for (const token of step.content) {
				if (isRatioTimer(token)) {
					const before = token.minutes;
					resolveTimer(token, mentions, resolveIn, problems, final);
					if (token.minutes !== before) timersChanged = true;
				} else if (isUsage(token) && token.type === "alternative") {
					const earlier: Usage[] = [];
					for (const opt of token.options ?? []) {
						if (!isUsage(opt)) continue;
						resolveToken(opt, [...earlier]);
						earlier.push(opt);
					}
				} else if (isUsage(token)) {
					resolveToken(token);
				}
			}
		}
	});

	return { timersChanged, problems };
}

/**
 * A proportional time: its duration, or none while its target's amount is
 * unknown. Capped like any timer (`DURATION_OUT_OF_RANGE`).
 */
function resolveTimer(
	timer: ProcessedTimer,
	mentions: Usage[],
	resolveIn: (spec: RatioSpec, pool: Usage[]) => RatioResolution,
	problems: RatioProblem[],
	final: boolean,
) {
	const spec = timer.ratio as RatioSpec;
	delete timer.quantity;
	delete timer.unit;
	delete timer.minutes;
	if (spec.isGhost) return;

	const res = resolveIn(spec, mentions);
	const item = timer.name || "Timer";
	if (!res.ok) {
		if (
			res.reason !== "deferred" &&
			(final || res.reason === "incompatibleUnits")
		) {
			problems.push({
				item,
				target: spec.target,
				reason: res.reason,
				...(res.reason === "incompatibleUnits" && {
					unit: spec.denominator.unit,
				}),
				spec,
			});
		}
		return;
	}

	const unit = res.amount.unit ?? "min";
	let quantity = res.amount.value;
	if (isDurationTooLong({ value: quantity, unit })) {
		problems.push({
			item,
			target: spec.target,
			reason: "durationTooLong",
			spec,
		});
		quantity = maxDurationIn(unit);
	}
	timer.quantity = quantity;
	timer.unit = unit;
	timer.minutes = quantityToMinutes({ value: quantity, unit });
}

/**
 * The warnings of the ratios that will not resolve: `RELATIVE_QUANTITY_UNKNOWN_MASS`
 * with its reason, or `DURATION_OUT_OF_RANGE` for a proportional time past the
 * longest duration Gram plans with. Each points at the ratio.
 */
export function pushRatioWarnings(
	warnings: Warning[],
	problems: RatioProblem[],
): void {
	for (const problem of problems) {
		if (problem.reason === "durationTooLong") {
			pushWarning(warnings, WarningCode.DURATION_OUT_OF_RANGE, {
				type: "Timer",
				item: problem.item,
				loc: problem.spec.loc,
			});
			continue;
		}
		pushWarning(warnings, WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS, {
			targetName: problem.target,
			item: problem.item,
			reason: problem.reason,
			...(problem.unit !== undefined && { unit: problem.unit }),
			loc: problem.spec.loc,
		});
	}
}

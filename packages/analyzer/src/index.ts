export * from "./types";
// NUTRIENTS and its derived types are the single source of truth every
// consumer enumerates nutrients from (renderer rows, `gram db enrich`,
// `gram db lint`, `gram db search`, the LSP hover), so the schema module is
// public rather than analyzer-internal.
export * from "./schemas";
export * from "./usage_selection";
export * from "./ingredient_db";
export * from "./mass_standardization";
export * from "./nutrition";
export * from "./metrics";
export * from "./diff";
export * from "./shopping_aggregation";

import type {
	CompilationResult,
	Usage,
	ShoppingListItem,
	RegistryEntry,
	PercentFormula,
	RatioFailure,
	RatioFormula,
	RatioProblem,
	RatioSpec,
} from "@gram-lang/kitchen";
import type { Term } from "@gram-lang/i18n";
import {
	convertUnitInFamily,
	groupTerms,
	isMeasureUnit,
	isTermValue,
	mergeKey,
	termsTotal,
} from "@gram-lang/i18n";
import {
	termsOfUsage,
	WarningCode,
	round2,
	isPurchasableReference,
	pushRatioWarnings,
	pushWarning,
	shoppingAmount,
	variablePartsOf,
	recomputeSchedule,
	resolveRatios,
	slugify,
} from "@gram-lang/kitchen";
import type {
	AnalyzedCompilationResult,
	AnalyzedUsage,
	AnalyzedSection,
	IngredientData,
	AnalysisResult,
	AnalyzerOptions,
	NutritionMetrics,
	MassMetrics,
} from "./types";
import { calculateMassMetrics } from "./metrics";
import { calculateNutrition, type NutritionItem } from "./nutrition";
import {
	analyzerConverter,
	parseDensityOverrides,
	weighAmount,
	type WeighedAmount,
} from "./mass_standardization";
import { getIngredientData } from "./ingredient_db";
import { aggregateShoppingList } from "./shopping_aggregation";
import { AnalyzerOptionsSchema, IngredientDataSchema } from "./schemas";

export interface IngredientValidationIssue {
	key: string;
	message: string;
}

export interface IngredientValidationResult {
	data: Record<string, IngredientData>;
	rejected: IngredientValidationIssue[];
}

/**
 * Validates a raw ingredient database entry-by-entry rather than
 * all-or-nothing: one malformed entry (a typo, a bad density value) no
 * longer prevents every other valid ingredient from loading. Callers that
 * need to report exactly what's wrong (e.g. `gram db validate`) can surface
 * `rejected`; callers that just need a usable database (e.g. compiling a
 * recipe) can use `data` and warn.
 */
export function validateIngredientDatabase(
	rawDb: unknown,
): IngredientValidationResult {
	const data: Record<string, IngredientData> = {};
	const rejected: IngredientValidationIssue[] = [];

	if (rawDb === null || typeof rawDb !== "object") {
		rejected.push({
			key: "(root)",
			message: "Ingredient database must be an object.",
		});
		return { data, rejected };
	}

	for (const [key, value] of Object.entries(rawDb as Record<string, unknown>)) {
		const result = IngredientDataSchema.safeParse(value);
		if (result.success) {
			data[key] = result.data;
		} else {
			const message = result.error.issues
				.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
				.join("; ");
			rejected.push({ key, message });
		}
	}

	return { data, rejected };
}

/**
 * Standardizes a single ingredient-shaped usage's mass in place (qty/unit/
 * name/id → normalizedMass/conversionMethod/isEstimate/purchasingMass),
 * mirroring the per-item logic in `analyze()`'s first pass. Shared so an
 * alternative's options — each independently standardized, never summed,
 * since only ONE option is ever actually bought — don't duplicate this
 * across the section-level and shopping-list enrichment passes.
 */
function standardizeUsageMass(
	usage: Partial<Usage> & Pick<Usage, "id">,
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	enableYieldCalculation: boolean,
	lang?: string,
): void {
	const weighed = weighUsage(
		termsOfUsage(usage),
		usage,
		database,
		overrides,
		enableYieldCalculation,
		lang,
	);
	if (!weighed) return;

	usage.conversionMethod = weighed.method;
	usage.isEstimate = weighed.isEstimate;
	usage.normalizedMass = round2(weighed.normalizedMass);
	if (weighed.purchasingMass !== undefined) {
		usage.purchasingMass = round2(weighed.purchasingMass);
	}
}

/**
 * What `terms` of `usage`'s ingredient weigh (`weighAmount`), its waste
 * factor applied when yields are on: the whole usage, or the share of it a
 * shopping entry holds.
 */
function weighUsage(
	terms: readonly Term[],
	usage: Partial<Usage> & Pick<Usage, "id">,
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	enableYieldCalculation: boolean,
	lang?: string,
): WeighedAmount | null {
	const yieldFactor = enableYieldCalculation
		? getIngredientData(usage.id, database)?.physical?.yield
		: undefined;
	return weighAmount(
		terms,
		database,
		usage.name || usage.id,
		overrides,
		lang,
		yieldFactor,
	);
}

/**
 * Records `usage.id` as missing from the database, unless it's a reference
 * (intermediates aren't shopping-list items, so they're never "missing" data)
 * or has no id at all. Shared between top-level items and alternative options
 * — the only two shapes that currently need this check.
 */
function trackMissingIngredient(
	usage: { type?: string; id?: string },
	database: Record<string, IngredientData>,
	missingIngredientsSet: Set<string>,
	registry: Record<string, RegistryEntry>,
): void {
	if (!usage.id) return;
	if (!isPurchasableReference(usage.type, registry[usage.id])) return;
	if (!getIngredientData(usage.id, database)) {
		missingIngredientsSet.add(usage.id);
	}
}

/**
 * Pass 1: traverses all recipe sections to calculate physical ingredient
 * masses, mutating `sections` in place and returning the flat list of raw
 * ingredient usages (composites/alternatives excluded per-item as noted
 * below) that later passes fold into shopping-list and metric totals.
 */
function standardizeSectionMasses(
	sections: AnalyzedSection[],
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	opts: AnalyzerOptions,
	missingIngredientsSet: Set<string>,
	registry: Record<string, RegistryEntry>,
): AnalyzedUsage[] {
	const allRawIngredients: AnalyzedUsage[] = [];
	sections.forEach((sec) => {
		if (!sec.ingredients) sec.ingredients = [];
		sec.ingredients.forEach((item) => {
			if (item.type === "alternative" && Array.isArray(item.options)) {
				// Each option is a mutually-exclusive choice ("egg OR tofu") — the
				// group itself has no single mass, only whichever option is
				// actually bought. Standardize every option independently rather
				// than falling through to the qty/unit check below, which only
				// ever finds those fields on the wrapper's own top-level item
				// (never present for an alternative) and would silently no-op.
				item.options.forEach((opt) => {
					if (typeof opt === "string" || !("id" in opt) || !opt.id) return;
					trackMissingIngredient(
						opt,
						database,
						missingIngredientsSet,
						registry,
					);
					if (opts.enableMassStandardization !== false) {
						standardizeUsageMass(
							opt as Partial<Usage> & Pick<Usage, "id">,
							database,
							overrides,
							opts.enableYieldCalculation !== false,
							opts.lang,
						);
					}
				});
				allRawIngredients.push(item);
				return;
			}

			trackMissingIngredient(item, database, missingIngredientsSet, registry);

			// Perform physical mass normalization if enabled. Audit
			// 2026-07-22, analyzer finding B6/I10: this used to duplicate
			// standardizeUsageMass()'s sequence inline, but without its
			// round2() calls — the same usage ended up with an unrounded
			// normalizedMass here (e.g. 250.78328000000002) and a rounded
			// one once aggregated into the shopping list (250.78). Calling
			// the one shared function both places removes the divergence,
			// not just the site it was noticed at.
			if (opts.enableMassStandardization !== false) {
				standardizeUsageMass(
					item,
					database,
					overrides,
					opts.enableYieldCalculation !== false,
					opts.lang,
				);
			}
			// Same three-way reference classification as `trackMissingIngredient`
			// above — a stocked import's synthetic leaf counts toward the flat
			// list that feeds the global mass total, same as it already does
			// per-section (sec.metrics is computed straight from
			// sec.ingredients, never through this list); a true intermediate or
			// an undefined reference does not.
			if (isPurchasableReference(item.type, registry[item.id])) {
				allRawIngredients.push(item);
			}
		});
	});

	return allRawIngredients;
}

/** A usage whose amount comes from another one, with its alternative's earlier options. */
interface RelativeEntry {
	usage: AnalyzedUsage;
	/** For an option of an alternative: the options before it. */
	earlier?: AnalyzedUsage[];
}

/** Its amount still comes from another one: a share or a ratio not resolved. */
const isPendingUsage = (usage: Usage) =>
	usage.formula !== undefined && !isTermValue(usage.qty);

/**
 * The usages of a section whose amount comes from another one (a share, a
 * ratio): its ingredients and references, then the options of its
 * alternatives, each with the options before it.
 */
function relativeEntries(sec: AnalyzedSection): RelativeEntry[] {
	const entries: RelativeEntry[] = [];
	for (const item of sec.ingredients) {
		if (item.type === "alternative") continue;
		if (item.formula) entries.push({ usage: item });
	}
	for (const item of sec.ingredients) {
		if (item.type !== "alternative" || !Array.isArray(item.options)) continue;
		const earlier: AnalyzedUsage[] = [];
		for (const opt of item.options) {
			if (typeof opt === "string" || !("id" in opt) || !opt.id) continue;
			const option = opt as AnalyzedUsage;
			if (option.formula)
				entries.push({ usage: option, earlier: [...earlier] });
			earlier.push(option);
		}
	}
	return entries;
}

/**
 * The sections, each one after the sections that make the intermediates it
 * uses: an intermediate used whole takes the mass of the section that makes
 * it, which must be known first.
 */
function producersFirst(sections: AnalyzedSection[]): AnalyzedSection[] {
	const producerOf = new Map<string, number>();
	sections.forEach((sec, index) => {
		if (sec.intermediate_preparation)
			producerOf.set(slugify(sec.intermediate_preparation), index);
	});
	const order: AnalyzedSection[] = [];
	const seen = new Set<number>();
	const visit = (index: number) => {
		if (seen.has(index)) return;
		seen.add(index);
		for (const item of sections[index]!.ingredients) {
			const producer =
				item.type === "reference" ? producerOf.get(item.id) : undefined;
			if (producer !== undefined) visit(producer);
		}
		order.push(sections[index]!);
	};
	for (let index = 0; index < sections.length; index++) visit(index);
	return order;
}

/**
 * What an intermediate used whole in `sec` weighs (`Roll out the &dough`,
 * no amount written for it in the section): the mass of the section that
 * makes it, when that section declares it in its title and its mass is
 * complete. Refused when another section uses it too (who takes what?), and
 * when a step makes it (`stepProducer`): what a step makes has no mass of its
 * own yet.
 * `null` when the section does write an amount for it.
 */
function wholeUseMass(
	targetId: string,
	sec: AnalyzedSection,
	sections: AnalyzedSection[],
): { mass: number } | { reason: Exclude<RatioFailure, "deferred"> } | null {
	const usesOf = (s: AnalyzedSection) =>
		s.ingredients.filter((i) => i.type === "reference" && i.id === targetId);
	const here = usesOf(sec);
	if (here.length === 0 || here.some((i) => termsOfUsage(i).length > 0)) {
		return null;
	}
	if (sections.filter((s) => usesOf(s).length > 0).length > 1) {
		return { reason: "wholeUseAmbiguous" };
	}
	const producer = sections.find(
		(s) =>
			s.intermediate_preparation &&
			slugify(s.intermediate_preparation) === targetId,
	);
	if (
		!producer &&
		sections.some((s) =>
			s.steps.some(
				(step) =>
					step.type === "step" && step.intermediate_preparation === targetId,
			),
		)
	) {
		return { reason: "stepProducer" };
	}
	const metrics = producer?.metrics;
	if (!metrics || metrics.massStatus === "incomplete" || !metrics.totalMass) {
		return { reason: "producerMassUnknown" };
	}
	return { mass: metrics.totalMass };
}

/**
 * Pass 1.5: resolves what comes from another ingredient, mutating `sections`
 * in place: shares (`10% @&flour`, in grams) and ratios with units that
 * kitchen left waiting (`1 / 100 ml @&flour`: a density, a unit weight).
 * Must run after `standardizeSectionMasses`, whose masses it reads.
 *
 * In each section, in the order of the dependencies: a share waits while its
 * target is itself pending, so a share and a ratio can target each other's
 * results. Sections come after those that make the intermediates they use:
 * an intermediate used whole (`Roll out the &dough`) weighs the section that
 * makes it (an estimate: what went in the bowl, before cooking), so each
 * section's mass is computed right after its own pass.
 *
 * An alternative's options are resolved too, each one for itself: an option
 * never adds to the others, since only one is bought. An option may take a
 * share of an earlier option of the same group (`@butter{100 g}|@oil{80%
 * @&butter}`), which then wins over the section's own mentions.
 *
 * Returns whether a proportional time changed (the schedule is laid out
 * again) and the usages it resolved that kitchen had left waiting.
 */
function resolveRelativeQuantities(
	sections: AnalyzedSection[],
	warnings: CompilationResult["warnings"],
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	opts: AnalyzerOptions,
): { timersChanged: boolean } {
	const convertFor = analyzerConverter(database, overrides, opts.lang);
	let timersChanged = false;

	for (const sec of producersFirst(sections)) {
		const entries = relativeEntries(sec);
		const ratios = entries.filter(
			(e) => e.usage.formula && "ratio" in e.usage.formula,
		);
		let shares = entries.filter(
			(e) => e.usage.formula && "percent" in e.usage.formula,
		);
		const wholeUse = (spec: RatioSpec) => {
			const whole = wholeUseMass(spec.targetId, sec, sections);
			if (!whole || "reason" in whole) return whole;
			return { terms: [{ value: whole.mass, unit: "g" }] };
		};

		let problems: RatioProblem[] = [];
		let progress = true;
		while (progress) {
			progress = false;
			const waiting: RelativeEntry[] = [];
			for (const entry of shares) {
				const outcome = resolveShare(entry, sec, sections, warnings);
				if (outcome === "wait") waiting.push(entry);
				else progress = true;
			}
			shares = waiting;

			const resolvedBefore = ratios.filter(
				(e) => !isPendingUsage(e.usage),
			).length;
			const pass = resolveRatios([sec], convertFor, {
				mode: "analyzer",
				lang: opts.lang,
				wholeUse,
			});
			if (pass.timersChanged) timersChanged = true;
			problems = pass.problems;
			for (const { usage } of ratios) {
				if (isPendingUsage(usage)) {
					delete usage.normalizedMass;
					delete usage.conversionMethod;
					continue;
				}
				standardizeUsageMass(
					usage,
					database,
					overrides,
					opts.enableYieldCalculation !== false,
					opts.lang,
				);
				if (
					usage.normalizedMass !== undefined &&
					isEstimatedRatio(usage, sec, sections, overrides, opts.lang)
				) {
					usage.isEstimate = true;
				}
			}
			const resolvedAfter = ratios.filter(
				(e) => !isPendingUsage(e.usage),
			).length;
			if (resolvedAfter > resolvedBefore) progress = true;
		}

		// A share still waiting waits on a target that never resolved.
		for (const { usage } of shares) warnUnknownMass(usage, warnings);
		// What kitchen already said (two counts that differ) is not said twice.
		const said = (problem: RatioProblem) =>
			warnings.some(
				(w) =>
					w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS &&
					w.loc?.start === problem.spec.loc?.start &&
					w.loc?.uri === problem.spec.loc?.uri,
			);
		pushRatioWarnings(
			warnings,
			problems.filter((p) => !said(p)),
		);

		sec.metrics = calculateMassMetrics(sec.ingredients);
	}

	return { timersChanged };
}

/**
 * A resolved ratio is an estimate when what it counts from is one: a target
 * whose own mass is estimated, an intermediate used whole (what went in the
 * bowl, before cooking), or a conversion that took a density or a unit
 * weight from the database (the recipe's own `densities:` are exact).
 */
function isEstimatedRatio(
	usage: AnalyzedUsage,
	sec: AnalyzedSection,
	sections: AnalyzedSection[],
	overrides: Record<string, number>,
	lang?: string,
): boolean {
	const spec = (usage.formula as RatioFormula).ratio;
	const targets = sec.ingredients.filter(
		(o) => o.id === spec.targetId && o !== usage,
	);
	if (targets.some((t) => t.isEstimate)) return true;
	if (
		spec.referenceType === "variable" &&
		wholeUseMass(spec.targetId, sec, sections) !== null
	) {
		return true;
	}
	if (overrides[spec.targetId] !== undefined) return false;
	const per = spec.denominator.unit;
	return targets
		.flatMap((t) => termsOfUsage(t))
		.some(
			(term) =>
				(isMeasureUnit(per, lang) || isMeasureUnit(term.unit, lang)) &&
				convertUnitInFamily(1, term.unit, per, lang) === null,
		);
}

/** The 1.3.0 warning of a share whose target's mass is unknown. */
function warnUnknownMass(
	item: AnalyzedUsage,
	warnings: CompilationResult["warnings"],
): void {
	warnings.push({
		code: WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
		message: `Cannot compute relative quantity for '${item.name || item.id}' because the mass of target '${item.formula?.target}' is unknown.`,
		item: item.name || item.id,
	});
}

/**
 * Resolves one share (`10% @&flour`) against the mentions it may target, in
 * grams: `wait` while a target is itself pending.
 */
function resolveShare(
	entry: RelativeEntry,
	sec: AnalyzedSection,
	sections: AnalyzedSection[],
	warnings: CompilationResult["warnings"],
): "wait" | "done" {
	const item = entry.usage;
	const formula = item.formula as PercentFormula;
	const targetId = item.dependencies?.[0];
	const pool = entry.earlier?.some((o) => o.id === targetId)
		? entry.earlier
		: sec.ingredients;
	const targets = pool.filter((o) => o.id === targetId && o !== item);
	if (targets.some(isPendingUsage)) return "wait";

	let targetMass = 0;
	let estimate = false;
	for (const other of targets) {
		if (other.normalizedMass === undefined) continue;
		targetMass += other.normalizedMass;
		if (other.isEstimate) estimate = true;
	}

	// An intermediate used whole: the mass of the section that makes it.
	if (!(targetMass > 0) && targetId) {
		const qty = item.qty as { referenceType?: string } | undefined;
		const whole =
			qty?.referenceType === "variable"
				? wholeUseMass(targetId, sec, sections)
				: null;
		if (whole && "reason" in whole) {
			pushWarning(warnings, WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS, {
				targetName: formula.target,
				item: item.name || item.id,
				reason: whole.reason,
			});
			return "done";
		}
		if (whole) {
			targetMass = whole.mass;
			estimate = true;
		}
	}

	if (targetMass > 0) {
		item.normalizedMass = round2((formula.percent / 100) * targetMass);
		// `Usage.qty` accepts QuantityValueAST's "single"/"fraction"/"range"
		// variants, never a raw QuantityAST — the renderer's getQty() happened
		// to read `.value` off any shape. `unit` is the one place read from.
		item.qty = { type: "single", value: item.normalizedMass };
		item.unit = "g";
		item.conversionMethod = "relative";
		if (estimate) item.isEstimate = true;
	} else {
		warnUnknownMass(item, warnings);
	}
	return "done";
}

/**
 * Pass 1.8: syncs analyzed values back into step content objects using
 * `_usageId` (because cleanObject deep clones during compilation,
 * referential integrity between a section's ingredient list and its steps'
 * inline mentions is lost, so this re-links them by id).
 */
function syncEnrichedFieldsIntoSteps(sections: AnalyzedSection[]): void {
	sections.forEach((sec) => {
		const usageMap = new Map<string, AnalyzedUsage>();
		sec.ingredients.forEach((i) => {
			if (i._usageId) usageMap.set(i._usageId, i);
			// An alternative's own options carry the analyzed data (the group
			// itself has no single mass) — register them too, so the group's
			// inline step-text mention can look each option up the same way.
			if (i.type === "alternative" && Array.isArray(i.options)) {
				i.options.forEach((opt) => {
					if (typeof opt !== "string" && "_usageId" in opt && opt._usageId) {
						usageMap.set(opt._usageId, opt as AnalyzedUsage);
					}
				});
			}
		});
		if (sec.cookware) {
			sec.cookware.forEach((c) => {
				if (c._usageId) usageMap.set(c._usageId, c);
			});
		}

		const syncEnrichedFields = (
			target: Partial<Usage>,
			enriched: AnalyzedUsage,
		) => {
			if (enriched.normalizedMass !== undefined)
				target.normalizedMass = enriched.normalizedMass;
			if (enriched.qty !== undefined) target.qty = enriched.qty;
			if (enriched.unit !== undefined) target.unit = enriched.unit;
			if (enriched.conversionMethod !== undefined)
				target.conversionMethod = enriched.conversionMethod;
			if (enriched.isEstimate !== undefined)
				target.isEstimate = enriched.isEstimate;
			if (enriched.purchasingMass !== undefined)
				target.purchasingMass = enriched.purchasingMass;
		};

		sec.steps.forEach((step) => {
			if (step.type === "step" && Array.isArray(step.content)) {
				step.content.forEach((contentItem) => {
					if (!contentItem || typeof contentItem !== "object") return;

					if (
						"type" in contentItem &&
						contentItem.type === "alternative" &&
						"options" in contentItem &&
						Array.isArray(contentItem.options)
					) {
						contentItem.options.forEach((opt) => {
							if (typeof opt === "string" || !("_usageId" in opt)) return;
							const enriched = opt._usageId
								? usageMap.get(opt._usageId)
								: undefined;
							if (enriched) syncEnrichedFields(opt, enriched);
						});
						return;
					}

					if ("_usageId" in contentItem && contentItem._usageId) {
						const enriched = usageMap.get(contentItem._usageId);
						if (enriched) syncEnrichedFields(contentItem, enriched);
					}
				});
			}
		});
	});
}

/**
 * The mass a shopping entry holds of one usage. A usage is bought whole in
 * one entry, unless it is a sum over several ladders (`{1 cup + 20 g}`):
 * the shopping list then buys one entry per ladder (`byLadder` in kitchen),
 * each listing the usage, and each weighs only its own terms, never the
 * usage's whole mass (which would count the sum once per entry).
 */
function shareOfEntry(
	usage: AnalyzedUsage,
	entry: ShoppingListItem,
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	enableYieldCalculation: boolean,
	lang?: string,
): Pick<
	AnalyzedUsage,
	"normalizedMass" | "purchasingMass" | "isEstimate" | "conversionMethod"
> {
	const groups = groupTerms(termsOfUsage(usage), "ladder");
	if (groups.length <= 1) return usage;
	const key = mergeKey(entry.unit || null, "ladder");
	const terms = groups.find(
		(group) => mergeKey(group[0]?.unit || null, "ladder") === key,
	);
	const weighed = terms
		? weighUsage(
				terms,
				usage,
				database,
				overrides,
				enableYieldCalculation,
				lang,
			)
		: null;
	if (!weighed) return {};
	return {
		normalizedMass: round2(weighed.normalizedMass),
		purchasingMass:
			weighed.purchasingMass !== undefined
				? round2(weighed.purchasingMass)
				: undefined,
		isEstimate: weighed.isEstimate,
		conversionMethod: weighed.method,
	};
}

/**
 * Pass 2: enriches the master Shopping List with the same physical masses
 * computed per-section in pass 1 (composites/alternatives/plain items each
 * need their own aggregation rule), then resolves database aliases and
 * merges cross-unit entries for the same canonical ingredient (e.g.
 * "beurre"/"butter", or "100g" + "1 cup" of flour).
 */
function enrichShoppingList(
	shoppingList: CompilationResult["shopping_list"],
	allRawIngredients: AnalyzedUsage[],
	database: Record<string, IngredientData>,
	overrides: Record<string, number>,
	opts: AnalyzerOptions,
): CompilationResult["shopping_list"] {
	// The options of an alternative whose percentage pass 1.5 resolved, by
	// `_usageId`: the shopping list holds its own copy of each option.
	const resolvedOptions = new Map<string, AnalyzedUsage>();
	allRawIngredients.forEach((usage) => {
		if (usage.type !== "alternative" || !Array.isArray(usage.options)) return;
		usage.options.forEach((opt) => {
			if (typeof opt === "string" || !("_usageId" in opt)) return;
			const option = opt as AnalyzedUsage;
			if (option._usageId && option.conversionMethod === "relative") {
				resolvedOptions.set(option._usageId, option);
			}
		});
	});

	shoppingList.forEach((item) => {
		if (opts.enableMassStandardization !== false) {
			if (
				item.type === "composite" &&
				"usage" in item &&
				Array.isArray(item.usage)
			) {
				// For composites, sum children masses — NOT the parent unit weight.
				// e.g. 6 egg yolks + 1 direct egg → 6×17g + 1×50g = 152g, not 7×50g = 350g.
				let totalMass = 0;
				let totalPurchasing = 0;
				let hasEstimate = false;
				// Same duplication as the section-level pass above (finding
				// B6/I10): standardize each child through the one shared
				// function instead of re-deriving the same sequence inline.
				for (const child of item.usage) {
					if (!child.id) continue;
					standardizeUsageMass(
						child as Partial<Usage> & Pick<Usage, "id">,
						database,
						overrides,
						opts.enableYieldCalculation !== false,
						opts.lang,
					);
					if (child.normalizedMass !== undefined) {
						totalMass += child.normalizedMass;
						totalPurchasing += child.purchasingMass ?? child.normalizedMass;
						if (child.isEstimate) hasEstimate = true;
					}
				}
				if (totalMass > 0) {
					item.normalizedMass = round2(totalMass);
					item.isEstimate = hasEstimate;
					item.conversionMethod = hasEstimate ? "estimate" : "physical";
					if (Math.abs(totalPurchasing - totalMass) > 0.001) {
						item.purchasingMass = round2(totalPurchasing);
					}
				}
			} else if (
				item.type === "alternative" &&
				"options" in item &&
				Array.isArray(item.options)
			) {
				// Unlike a composite, an alternative's options are mutually
				// exclusive ("egg OR tofu") — standardize each independently
				// rather than summing into a single item.normalizedMass, which
				// would wrongly imply buying every option at once. Renderers and
				// calculateMassMetrics already read a per-option normalizedMass
				// directly (the latter picks options[0] as the representative
				// for aggregate totals), so no wrapper-level field is needed.
				// A StepToken option can be a plain string (e.g. free text) —
				// standardizeUsageMass needs an object with an `id`.
				item.options.forEach((opt) => {
					if (typeof opt === "string" || !("id" in opt) || !opt.id) return;
					// A percentage option was resolved on the section's copy
					// (pass 1.5): the shopping list buys that amount.
					const option = opt as Usage;
					const resolved = option._usageId
						? resolvedOptions.get(option._usageId)
						: undefined;
					if (resolved) {
						option.qty = resolved.qty;
						option.unit = resolved.unit;
						option.normalizedMass = resolved.normalizedMass;
						option.conversionMethod = resolved.conversionMethod;
						return;
					}
					standardizeUsageMass(
						opt,
						database,
						overrides,
						opts.enableYieldCalculation !== false,
						opts.lang,
					);
				});
			} else {
				// Neither composite nor alternative — the plain aggregated-
				// ingredient shape (ShoppingListItem), though the original code
				// also defensively read Usage's singular `_usageId` here, so
				// this keeps accepting both rather than assuming which one.
				const stdItem = item as ShoppingListItem & Partial<Usage>;
				const usageIds =
					stdItem._usageIds || (stdItem._usageId ? [stdItem._usageId] : []);
				const usages = allRawIngredients.filter(
					(u) => u._usageId && usageIds.includes(u._usageId),
				);
				let totalMass = 0;
				let totalPurchasing = 0;
				let hasEstimate = false;
				let hasRelativeResolved = false;

				usages.forEach((usage) => {
					const u = shareOfEntry(
						usage,
						stdItem,
						database,
						overrides,
						opts.enableYieldCalculation !== false,
						opts.lang,
					);
					if (u.normalizedMass !== undefined) {
						totalMass += u.normalizedMass;
						totalPurchasing += u.purchasingMass ?? u.normalizedMass;
						if (u.isEstimate) hasEstimate = true;
						if (u.conversionMethod === "relative") hasRelativeResolved = true;
					}
				});

				// A ratio kitchen left waiting and resolved here: the entry's
				// amount is written again from its usages' terms (in the
				// ratio's own unit, not in grams like a share), and what is
				// still not counted stays as written.
				const resolvedHere = usages.some(
					(u) =>
						u.formula &&
						"ratio" in u.formula &&
						isTermValue(u.qty) &&
						stdItem.variable_entries?.includes(u.formula.raw),
				);
				if (resolvedHere && !hasRelativeResolved) {
					const total = termsTotal(usages.flatMap((u) => termsOfUsage(u)));
					if (total) Object.assign(stdItem, shoppingAmount(total));
					const parts = usages
						.filter((u) => termsOfUsage(u).length === 0)
						.flatMap((u) => variablePartsOf(u));
					if (parts.length > 0) stdItem.variable_entries = parts;
					else delete stdItem.variable_entries;
				}

				if (totalMass > 0) {
					stdItem.normalizedMass = round2(totalMass);
					stdItem.isEstimate = hasEstimate;
					// Preserve 'relative' provenance even if only some contributing
					// usages were formula-derived: a mass partly built from another
					// ingredient's percentage can't be treated as a physical anchor
					// (e.g. for Baker's Math reference validation below).
					stdItem.conversionMethod = hasRelativeResolved
						? "relative"
						: hasEstimate
							? "estimate"
							: "physical";
					if (Math.abs(totalPurchasing - totalMass) > 0.001) {
						stdItem.purchasingMass = round2(totalPurchasing);
					}

					if (hasRelativeResolved) {
						stdItem.qty = stdItem.normalizedMass;
						stdItem.unit = "g";
						// What is still not counted (a quantity in words, a
						// share or ratio not resolved) stays as written.
						stdItem.variable_entries = usages
							.filter(
								(u) =>
									u.conversionMethod !== "relative" &&
									termsOfUsage(u).length === 0,
							)
							.flatMap((u) => variablePartsOf(u));
					}
				}
			}
		}
	});

	// 2.8. Resolve database aliases and merge cross-unit entries for the same
	// canonical ingredient (e.g. "beurre"/"butter", or "100g" + "1 cup" of flour).
	if (opts.enableMassStandardization !== false) {
		shoppingList = aggregateShoppingList(shoppingList, database);
	}

	return shoppingList;
}

/**
 * Pass 2.5: calculates Baker's Percentages (if a reference is defined),
 * mutating both the shopping list and the AST sections in place. Must run
 * after `enrichShoppingList` — it needs every item's final `normalizedMass`.
 */
function applyBakersMath(
	shoppingList: CompilationResult["shopping_list"],
	sections: AnalyzedSection[],
	opts: AnalyzerOptions,
	warnings: CompilationResult["warnings"],
): void {
	let bakersReferenceMass: number | null = null;

	if (opts.enableBakersMath !== false) {
		// Find reference by explicit option or by the `*` modifier
		let bakersReferenceItem: CompilationResult["shopping_list"][number] | null =
			null;
		for (const item of shoppingList) {
			if (
				(opts.bakersReference && item.id === opts.bakersReference) ||
				item.modifiers?.includes("bakers_percentage")
			) {
				bakersReferenceItem = item;
				break;
			}
		}

		if (
			bakersReferenceItem &&
			(bakersReferenceItem.conversionMethod === "relative" ||
				("relative" in bakersReferenceItem && bakersReferenceItem.relative))
		) {
			// The 100% base must be a physical anchor. A reference whose own amount
			// comes from another ingredient (a percentage, or since 1.5.0 a ratio)
			// can't also be the base — that's a circular definition, not a bug in
			// the math, so we refuse, disable Baker's Math for this run, and
			// explain why.
			warnings.push({
				code: WarningCode.INVALID_BAKERS_REFERENCE,
				message: `Cannot use '${bakersReferenceItem.name || bakersReferenceItem.id}' as the Baker's Percentage reference: its quantity is itself computed from another ingredient's percentage, not an absolute mass.`,
				item: bakersReferenceItem.name || bakersReferenceItem.id,
			});
		} else if (bakersReferenceItem) {
			bakersReferenceMass = bakersReferenceItem.normalizedMass || null;
		} else if (opts.bakersReference !== undefined) {
			// Baker's Math was explicitly requested (bare --bakers-math or
			// --bakers-reference=<id>) but nothing matched.
			warnings.push({
				code: WarningCode.NO_BAKERS_REFERENCE,
				message: `No Baker's Percentage reference found. Mark an ingredient with the \`*\` modifier, or pass --bakers-reference=<id>.`,
			});
		}

		if (bakersReferenceMass !== null && bakersReferenceMass > 0) {
			const computeBakers = (mass?: number) =>
				mass !== undefined
					? round2((mass / bakersReferenceMass!) * 100)
					: undefined;

			// Apply to shopping list
			shoppingList.forEach((item) => {
				const bp = computeBakers(item.normalizedMass);
				if (bp !== undefined) item.bakersPercentage = bp;
			});

			// Apply to AST sections
			if (Array.isArray(sections)) {
				sections.forEach((section) => {
					if (Array.isArray(section.ingredients)) {
						section.ingredients.forEach((item) => {
							const bp = computeBakers(item.normalizedMass);
							if (bp !== undefined) item.bakersPercentage = bp;
						});
					}
					if (Array.isArray(section.steps)) {
						section.steps.forEach((step) => {
							if (step && step.type === "step" && Array.isArray(step.content)) {
								step.content.forEach((node) => {
									// kitchen's createCleanUsage never sets `.type` on a
									// plain ingredient token, so `node.type ===
									// "ingredient"` was always false here — Baker's
									// Percentage never reached an ingredient's inline
									// step-text mention, only its section/shopping-list
									// entries. `id` present with no `type` is the same
									// "plain ingredient usage" signal kitchen itself
									// relies on elsewhere (e.g. scale/engine.ts).
									if (
										node &&
										typeof node !== "string" &&
										"id" in node &&
										node.id &&
										!node.type &&
										"normalizedMass" in node
									) {
										const bp = computeBakers(node.normalizedMass);
										if (bp !== undefined) node.bakersPercentage = bp;
									}
								});
							}
						});
					}
				});
			}
		}
	}
}

/**
 * Resolves how many portions the nutrition should be divided by: an explicit
 * caller override first, otherwise the recipe's own `portions:` frontmatter.
 *
 * Reading the frontmatter is the part that was missing — `analyze()` only ever
 * looked at the option, and the CLI was passing it the `--scale` factor, so the
 * documented "if the recipe declares portions: 4, divide by 4" never happened
 * for anyone.
 *
 * Frontmatter values are always `string | string[]` (the parser never coerces),
 * so only the string form can carry a count; `parseFloat` is deliberately
 * permissive about a trailing label ("4 servings" -> 4), matching how
 * `applyScale` reads the same field. The finite/positive guard is not
 * decorative: `portions: 0` would divide by zero.
 */
function resolvePortions(
	meta: CompilationResult["meta"],
	opts: AnalyzerOptions,
): number | undefined {
	if (opts.portions !== undefined) return opts.portions;

	const declared = meta?.portions;
	if (typeof declared !== "string") return undefined;

	const parsed = parseFloat(declared);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Pass 3: estimates a full nutritional profile (calories, macros) from the
 * fully-enriched shopping list, on every basis the recipe supports.
 */
function estimateNutrition(
	shoppingList: CompilationResult["shopping_list"],
	database: Record<string, IngredientData>,
	meta: CompilationResult["meta"],
	massStatus: MassMetrics["massStatus"],
	opts: AnalyzerOptions,
): NutritionMetrics | undefined {
	if (opts.enableNutritionalEstimation === false) return undefined;
	// shopping_list's declared type is kitchen's general
	// (CompositeItem | ShoppingListItem | Usage)[] — wider than
	// NutritionItem's AnalyzedUsage-based shape (e.g. `conversionMethod`
	// is a specific literal union there, plain `string` in kitchen's
	// type), but this analyzer-internal call always receives exactly the
	// analyzer-populated values calculateNutrition expects.
	return calculateNutrition(
		shoppingList as NutritionItem[],
		database,
		resolvePortions(meta, opts),
		massStatus,
	);
}

/**
 * Main entry point for recipe physical analysis.
 * Takes a pure structural CompilationResult and a macro-ingredient database,
 * then enriches it with calculated masses, yields, and nutritional profiles.
 */
export function analyze(
	result: CompilationResult,
	database: Record<string, IngredientData>,
	options?: AnalyzerOptions,
): AnalysisResult {
	const opts = AnalyzerOptionsSchema.parse(options || {});
	const missingIngredientsSet = new Set<string>();

	const sections: AnalyzedSection[] =
		typeof structuredClone === "function"
			? structuredClone(result.sections)
			: JSON.parse(JSON.stringify(result.sections));

	const overrides = parseDensityOverrides(result.meta);

	const allRawIngredients = standardizeSectionMasses(
		sections,
		database,
		overrides,
		opts,
		missingIngredientsSet,
		result.registry.ingredients,
	);

	// The passes below add their warnings to a copy: the compiled result is
	// never modified, so analyzing it again (LSP, playground) does not pile up
	// the same warnings.
	const warnings = [...result.warnings];

	const { timersChanged } = resolveRelativeQuantities(
		sections,
		warnings,
		database,
		overrides,
		opts,
	);

	// Mass metrics are computed only now, after pass 1.5. They used to run
	// straight after pass 1, on the very same objects — so an ingredient
	// expressed as `60% of &dough` had no normalizedMass yet, was counted as
	// missing, and was left out of totalMass while forcing massStatus to
	// "incomplete". Nutrition, computed further down from the enriched shopping
	// list, did include it: the two totals described different recipes.
	const globalMassMetrics = calculateMassMetrics(allRawIngredients);
	sections.forEach((sec) => {
		sec.metrics = calculateMassMetrics(sec.ingredients);
	});

	syncEnrichedFieldsIntoSteps(sections);

	let shopping_list: CompilationResult["shopping_list"] = result.shopping_list
		? structuredClone(result.shopping_list)
		: [];
	shopping_list = enrichShoppingList(
		shopping_list,
		allRawIngredients,
		database,
		overrides,
		opts,
	);

	applyBakersMath(shopping_list, sections, opts, warnings);

	const nutrition = estimateNutrition(
		shopping_list,
		database,
		result.meta,
		globalMassMetrics.massStatus,
		opts,
	);

	const nutritionWarnings = nutrition?.warnings || [];
	const allWarnings = [...warnings, ...nutritionWarnings];

	// A proportional time resolved here (`~{4 min / @&cutlet}` with a unit
	// weight) changes the schedule: laid out again on a copy, through the
	// same functions as `compile`. The compiled result stays untouched.
	const planned: Pick<
		CompilationResult,
		"sections" | "tasks" | "schedule" | "metrics"
	> = {
		sections,
		tasks: result.tasks,
		schedule: result.schedule,
		metrics: result.metrics,
	};
	if (timersChanged) {
		const copy = {
			...result,
			sections,
			tasks: structuredClone(result.tasks),
			schedule: structuredClone(result.schedule),
			metrics: structuredClone(result.metrics),
		};
		recomputeSchedule(copy);
		Object.assign(planned, copy);
	}

	// 4. Assemble and return the final structurally and physically enriched recipe package
	const analyzedResult: AnalyzedCompilationResult = {
		...result,
		warnings: allWarnings,
		sections: planned.sections as AnalyzedSection[],
		tasks: planned.tasks,
		schedule: planned.schedule,
		// shopping_list's working type is kitchen's general
		// (CompositeItem | ShoppingListItem | Usage)[] throughout this
		// function, but by this point every entry has actually been enriched
		// with analyzer's fields (conversionMethod's specific literal values,
		// etc.) — the same gap as the calculateNutrition() call above.
		shopping_list: shopping_list as AnalyzedCompilationResult["shopping_list"],
		metrics: {
			...planned.metrics,
			...globalMassMetrics,
			nutrition,
		},
	};

	return {
		result: analyzedResult,
		missingIngredients: Array.from(missingIngredientsSet),
	};
}

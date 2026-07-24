export * from "./types";
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
} from "@gram-lang/kitchen";
import { getNumericQty, WarningCode, round2 } from "@gram-lang/kitchen";
import type {
	AnalyzedCompilationResult,
	AnalyzedUsage,
	AnalyzedSection,
	IngredientData,
	AnalysisResult,
	AnalyzerOptions,
	NutritionMetrics,
} from "./types";
import { calculateMassMetrics } from "./metrics";
import { calculateNutrition, type NutritionItem } from "./nutrition";
import {
	standardizeMass,
	parseDensityOverrides,
	applyYield,
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
): void {
	const numericQty = getNumericQty(usage.qty);
	if (numericQty === null) return;

	const norm = standardizeMass(
		numericQty,
		usage.unit || "unit",
		database,
		usage.name || usage.id,
		overrides,
	);
	if (!norm) return;

	usage.conversionMethod = norm.method;
	usage.isEstimate = norm.isEstimate;

	const dbData = getIngredientData(usage.id, database);
	const yieldFactor = enableYieldCalculation
		? dbData?.physical?.yield
		: undefined;
	const yielded = applyYield(norm.mass, norm.method, yieldFactor);
	usage.normalizedMass = round2(yielded.normalizedMass);
	if (yielded.purchasingMass !== undefined) {
		usage.purchasingMass = round2(yielded.purchasingMass);
	}
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
): void {
	if (usage.type === "reference" || !usage.id) return;
	if (!getIngredientData(usage.id, database)) {
		missingIngredientsSet.add(usage.id);
	}
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

	// Deep clone the compiled sections to perform safe mutations while preserving internal references
	const sections: AnalyzedSection[] =
		typeof structuredClone === "function"
			? structuredClone(result.sections)
			: JSON.parse(JSON.stringify(result.sections));

	// Parse custom ingredient density overrides declared in YAML/Frontmatter metadata
	const overrides = parseDensityOverrides(result.meta);

	// 1. Traverse all recipe sections to calculate physical ingredient masses
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
					trackMissingIngredient(opt, database, missingIngredientsSet);
					if (opts.enableMassStandardization !== false) {
						standardizeUsageMass(
							opt as Partial<Usage> & Pick<Usage, "id">,
							database,
							overrides,
							opts.enableYieldCalculation !== false,
						);
					}
				});
				allRawIngredients.push(item);
				return;
			}

			trackMissingIngredient(item, database, missingIngredientsSet);

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
				);
			}
			if (item.type !== "reference") {
				allRawIngredients.push(item);
			}
		});

		// Calculate mass metrics specifically for this section
		sec.metrics = calculateMassMetrics(sec.ingredients);
	});

	// Compute the global recipe mass totals
	const globalMassMetrics = calculateMassMetrics(allRawIngredients);

	// 1.5. Secondary pass: resolve Relative Quantities
	sections.forEach((sec) => {
		sec.ingredients.forEach((item) => {
			if (item.formula?.target) {
				const targetId = item.dependencies?.[0];
				const isVariable = item.formula.raw.includes("% of &");

				let targetMass = 0;
				let foundMass = false;

				if (!isVariable && targetId) {
					sec.ingredients.forEach((other) => {
						if (other.id === targetId && other.normalizedMass !== undefined) {
							targetMass += other.normalizedMass;
							foundMass = true;
						}
					});
				}

				if (foundMass && targetMass > 0) {
					const calculatedMass = (item.formula.percent / 100) * targetMass;
					item.normalizedMass = round2(calculatedMass);
					// `Usage.qty` accepts QuantityValueAST's "single"/"fraction"/
					// "range" variants, never a raw QuantityAST (`type:
					// ASTNodeType.Quantity` = the literal string "Quantity") —
					// this happened to still render correctly only because
					// renderer's getQty() has an untyped fallback that reads
					// `.value` off *any* object shape, ignoring `.type`. `unit`
					// isn't part of QuantityValueAST either — `item.unit` below
					// is the real, and only, place that's read from.
					item.qty = { type: "single", value: item.normalizedMass };
					item.unit = "g";
					item.conversionMethod = "relative";
				} else {
					result.warnings.push({
						code: WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
						message: `Cannot compute relative quantity for '${item.name || item.id}' because the mass of target '${item.formula.target}' is unknown.`,
						item: item.name || item.id,
					});
				}
			}
		});
	});

	// 1.8. Sync analyzed values back into step content objects using _usageId
	// (Because cleanObject deep clones during compilation, referential integrity is lost)
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

	// 2. Traverse and enrich the master Shopping List
	let shopping_list: CompilationResult["shopping_list"] = result.shopping_list
		? structuredClone(result.shopping_list)
		: [];
	shopping_list.forEach((item) => {
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
					standardizeUsageMass(
						opt,
						database,
						overrides,
						opts.enableYieldCalculation !== false,
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

				usages.forEach((u) => {
					if (u.normalizedMass !== undefined) {
						totalMass += u.normalizedMass;
						totalPurchasing += u.purchasingMass ?? u.normalizedMass;
						if (u.isEstimate) hasEstimate = true;
						if (u.conversionMethod === "relative") hasRelativeResolved = true;
					}
				});

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
						stdItem.variable_entries = [];
					}
				}
			}
		}
	});

	// 2.8. Resolve database aliases and merge cross-unit entries for the same
	// canonical ingredient (e.g. "beurre"/"butter", or "100g" + "1 cup" of flour).
	if (opts.enableMassStandardization !== false) {
		shopping_list = aggregateShoppingList(shopping_list, database);
	}

	// 2.5 Calculate Baker's Percentages (if a reference is defined)
	let bakersReferenceMass: number | null = null;

	if (opts.enableBakersMath !== false) {
		// Find reference by explicit option or by the `*` modifier
		let bakersReferenceItem: CompilationResult["shopping_list"][number] | null =
			null;
		for (const item of shopping_list) {
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
			bakersReferenceItem.conversionMethod === "relative"
		) {
			// The 100% base must be a physical anchor. A reference whose own mass was
			// derived from another ingredient's percentage can't also be the base —
			// that's a circular definition, not a bug in the math, so we refuse
			// silently, disable Baker's Math for this run, and explain why.
			result.warnings.push({
				code: WarningCode.INVALID_BAKERS_REFERENCE,
				message: `Cannot use '${bakersReferenceItem.name || bakersReferenceItem.id}' as the Baker's Percentage reference: its quantity is itself computed from another ingredient's percentage, not an absolute mass.`,
				item: bakersReferenceItem.name || bakersReferenceItem.id,
			});
		} else if (bakersReferenceItem) {
			bakersReferenceMass = bakersReferenceItem.normalizedMass || null;
		} else if (opts.bakersReference !== undefined) {
			// Baker's Math was explicitly requested (bare --bakers-math or
			// --bakers-reference=<id>) but nothing matched.
			result.warnings.push({
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
			shopping_list.forEach((item) => {
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
									// Audit 2026-07-22, analyzer finding I1/§5(c):
									// kitchen's createCleanUsage never sets `.type`
									// on a plain ingredient token, so `node.type ===
									// "ingredient"` was always false here — Baker's
									// Percentage never reached an ingredient's
									// inline step-text mention, only its section/
									// shopping-list entries. `id` present with no
									// `type` is the same "plain ingredient usage"
									// signal kitchen itself relies on elsewhere
									// (e.g. scale/engine.ts).
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

	// 3. Estimate full nutritional profiles (calories, macros) based on portion counts
	let nutrition: NutritionMetrics | undefined;
	if (opts.enableNutritionalEstimation !== false) {
		// shopping_list's declared type is kitchen's general
		// (CompositeItem | ShoppingListItem | Usage)[] — wider than
		// NutritionItem's AnalyzedUsage-based shape (e.g. `conversionMethod`
		// is a specific literal union there, plain `string` in kitchen's
		// type), but this analyzer-internal call always receives exactly the
		// analyzer-populated values calculateNutrition expects.
		nutrition = calculateNutrition(
			shopping_list as NutritionItem[],
			database,
			opts.portions || 1,
		);
	}

	// 4. Assemble and return the final structurally and physically enriched recipe package
	const analyzedResult: AnalyzedCompilationResult = {
		...result,
		sections,
		shopping_list,
		metrics: {
			...result.metrics,
			...globalMassMetrics,
			nutrition,
		},
	};

	return {
		result: analyzedResult,
		missingIngredients: Array.from(missingIngredientsSet),
	};
}

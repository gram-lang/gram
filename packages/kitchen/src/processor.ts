import {
	minifyQuantity,
	createCleanUsage,
	isDurationTooLong,
	maxDurationIn,
	quantityToMinutes,
	quantityToMinutesRange,
	nextUsageId,
} from "./utils";
import {
	type ASTNode,
	type SectionAST,
	type StepAST,
	type CommentAST,
	type IngredientAST,
	type CookwareAST,
	type AlternativeAST,
	type ReferenceAST,
	type IntermediateDecl,
	type TimerAST,
	type TemperatureAST,
	type TextAST,
	type CompoundQuantityAST,
	ASTNodeType,
	type Location,
} from "@gram-lang/parser";
import type {
	Context,
	ProcessedSection,
	ProcessedStep,
	Usage,
	ProcessedStepItem,
	StepToken,
	ProcessedTimer,
	ProcessedTemperature,
	ProcessedComment,
	RetroPlanning,
	TimeBreakdownItem,
	DeferredImport,
	Schedule,
	SectionMiseEnPlace,
} from "./types";
import {
	type SchedulingDiagnostic,
	type StepSchedule,
	type TaskGraph,
	computeTimeline,
	layout,
	scheduleALAP,
	serializeTracks,
} from "@gram-lang/scheduler";
import {
	type StepFact,
	type TimerFact,
	buildTaskGraph,
	taskIds,
} from "./task-graph";
import { commitTimeline } from "./legacy-timings";
import { pushPassiveOverlapWarnings } from "./overlap-warnings";
import {
	isSameSchedulingProblem,
	pushSchedulingWarnings,
} from "./schedule-warnings";
import type { CompilerOptions } from "./core";
import type { RecipeRegistry } from "./registry";
import {
	looksLikeThousands,
	parseDuration,
	unitContainsQuantity,
} from "@gram-lang/i18n";
import { type Warning, WarningCode, pushWarning } from "./warnings";
import { looksLikeTwoQuantities, readSum } from "./compound";
import { writeSum } from "./terms";
import { type DurationProblem, readAnchor, readTimer } from "./durations";
import { detectIntermediateCycles } from "./graph";
import { calculatePreparationTime } from "./metrics";
import { analyzeMiseEnPlace } from "./mise-en-place";

export interface ProcessorContext extends Context {
	options?: CompilerOptions;
}

function checkModifiers(
	ctx: ProcessorContext,
	modifiers: string[],
	itemName: string,
	loc?: Location,
) {
	if (!modifiers) return;

	const seen = new Set<string>();
	for (const m of modifiers) {
		if (seen.has(m)) {
			pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
				item: itemName,
				combination: `Duplicated modifier '${m}'`,
				loc,
			});
		}
		seen.add(m);
	}

	const hasOpt = modifiers.includes("?");
	const hasImp = modifiers.includes("*");
	const hasHid = modifiers.includes("-");
	const hasRef = modifiers.includes("&");

	if (hasOpt && hasImp) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Optional (?) and Important (*)",
			loc,
		});
	}
	if (hasHid && hasImp) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Hidden (-) and Important (*)",
			loc,
		});
	}
	if (hasHid && hasRef) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Hidden (-) and Referenceable (&)",
			loc,
		});
	}
}

export type ProcessedBlockResult = StepToken;

type QuantityValue = NonNullable<TemperatureAST["value"]>;

/** How Gram read a number: `1`, or `1-2` for a range. */
function readAs(value: QuantityValue): string {
	return value.type === "range"
		? `${value.range.min}-${value.range.max}`
		: String(value.value);
}

/**
 * `{1,000 g}`: a comma a reader could take for a thousands separator. Gram
 * reads every comma between two digits as a decimal (the parser keeps the
 * number as written in `text`), so the quantity stays usable, 1 g here; the
 * warning says how it was read, in case a thousand was meant.
 */
function checkAmbiguousNumber(
	ctx: ProcessorContext,
	value: QuantityValue | null | undefined,
	item: string,
	loc?: Location,
) {
	if (value) checkAmbiguousText(ctx, value.text, readAs(value), item, loc);
}

/**
 * The same check on a number known only by its text and its value: a
 * percentage (`{1,000% &dough}`), a section anchor (`~{-1,000h}`). `text` is
 * the bare number, without sign, unit or `%`.
 */
function checkAmbiguousText(
	ctx: ProcessorContext,
	text: string | undefined,
	read: string,
	item: string,
	loc?: Location,
) {
	if (!text || !looksLikeThousands(text)) return;
	pushWarning(ctx, WarningCode.AMBIGUOUS_NUMBER, {
		value: text,
		read,
		suggestion: text.replace(/(\d),(\d{3})(?!\d)/g, "$1$2"),
		item,
		loc,
	});
}

/** The numbers of an element's `{…}`: one, or one per term of a sum. */
const quantityValues = (
	quantity: { type: ASTNodeType; value?: unknown } | null | undefined,
): QuantityValue[] => {
	if (quantity?.type === ASTNodeType.CompoundQuantity) {
		return (quantity as CompoundQuantityAST).terms.flatMap((term) =>
			term.value ? [term.value as QuantityValue] : [],
		);
	}
	const value = quantityValue(quantity);
	return value ? [value] : [];
};

/** The number of an element's `{…}`, when it has one. */
const quantityValue = (
	quantity: { type: ASTNodeType; value?: unknown } | null | undefined,
): QuantityValue | null =>
	quantity?.type === ASTNodeType.Quantity
		? ((quantity.value as QuantityValue | null) ?? null)
		: null;

/**
 * Every number an element holds (its own, a composite parent's). An
 * alternative's options come through `processBlockItem` one by one.
 */
function checkAmbiguousNumbers(
	item: StepAST["children"][number],
	ctx: ProcessorContext,
) {
	switch (item.type) {
		case ASTNodeType.Ingredient:
			for (const value of quantityValues(item.quantity))
				checkAmbiguousNumber(ctx, value, item.name, item.loc);
			if (item.quantity?.type === ASTNodeType.RelativeQuantity) {
				checkAmbiguousText(
					ctx,
					item.quantity.text,
					String(item.quantity.percent),
					item.name,
					item.loc,
				);
			}
			for (const value of quantityValues(item.composite?.quantity))
				checkAmbiguousNumber(
					ctx,
					value,
					item.composite?.parent ?? item.name,
					item.loc,
				);
			return;
		case ASTNodeType.Cookware:
		case ASTNodeType.Reference:
			for (const value of quantityValues(item.quantity))
				checkAmbiguousNumber(ctx, value, item.name, item.loc);
			return;
		case ASTNodeType.Timer:
			if (item.quantity?.type === ASTNodeType.Quantity) {
				checkAmbiguousNumber(
					ctx,
					quantityValue(item.quantity),
					item.name || "Timer",
					item.loc,
				);
			} else if (parseDuration(item.raw).ok) {
				// A natural timer the grammar keeps as text (`45 min - 1,000 h`):
				// its numbers are only in what was written. One that is not read
				// already says why (INVALID_DURATION).
				for (const text of item.raw.match(/\d+(?:[.,]\d+)?/g) ?? [])
					checkAmbiguousText(
						ctx,
						text,
						String(Number(text.replace(",", "."))),
						item.name || "Timer",
						item.loc,
					);
			}
			return;
		case ASTNodeType.Temperature:
			checkAmbiguousNumber(
				ctx,
				item.value,
				item.name || "Temperature",
				item.loc,
			);
			return;
	}
}

// Moved to `compound.ts`, which reads each term of a sum with it too.
export { looksLikeTwoQuantities } from "./compound";

/**
 * `{about 200g}`: with no number in front, the whole text is read as a unit,
 * so the quantity hides inside it (a number, then a known unit). Unflagged, it
 * had no mass and vanished from a scaled recipe. `{une pincée}` or
 * `{to taste}`, with no number, are words a cook means as such.
 */
export function hidesAQuantity(unit: string): boolean {
	return unitContainsQuantity(unit);
}

/**
 * The warnings of a sum of quantities (`{1 cup + 1 tbsp}`), each pointing at
 * its term: why it is refused (`INVALID_QUANTITY`), a unit that reads as two
 * quantities (`INVALID_UNIT`), an `oz` next to a volume (`OZ_AFTER_VOLUME`).
 * The compiled quantity comes from the same reading (`createCleanUsage`).
 */
function checkSum(
	ctx: ProcessorContext,
	quantity: { type: ASTNodeType } | null | undefined,
	item: string,
	loc: Location | undefined,
) {
	if (quantity?.type !== ASTNodeType.CompoundQuantity) return;
	const sum = readSum(quantity as CompoundQuantityAST, loc);
	for (const problem of sum.problems) {
		pushWarning(ctx, WarningCode.INVALID_QUANTITY, {
			value: problem.value,
			reason: problem.reason,
			...(problem.suggestion !== undefined
				? { suggestion: problem.suggestion }
				: {}),
			item,
			loc: problem.loc ?? loc,
		});
	}
	for (const unit of sum.twoQuantities) {
		pushWarning(ctx, WarningCode.INVALID_UNIT, {
			type: "Ingredient",
			value: unit.value,
			item,
			reason: "twoQuantities",
			loc: unit.loc ?? loc,
		});
	}
	if (sum.ozAfterVolume) {
		pushWarning(ctx, WarningCode.OZ_AFTER_VOLUME, {
			value: sum.ozAfterVolume.value,
			suggestion: "fl oz",
			item,
			loc: sum.ozAfterVolume.loc ?? loc,
		});
	}
}

function processIngredient(
	item: IngredientAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
): Usage {
	checkModifiers(ctx, item.modifiers, item.name, item.loc);
	checkSum(ctx, item.quantity, item.name, item.loc);
	checkSum(
		ctx,
		item.composite?.quantity,
		item.composite?.parent ?? item.name,
		item.loc,
	);

	const defaultUnit =
		(item.quantity && "unit" in item.quantity && item.quantity.unit) ||
		undefined;
	if (typeof defaultUnit === "string") {
		const hasNumber =
			item.quantity &&
			"value" in item.quantity &&
			item.quantity.value !== null &&
			item.quantity.value !== undefined;
		const reason = !hasNumber
			? hidesAQuantity(defaultUnit)
				? "hiddenQuantity"
				: undefined
			: looksLikeTwoQuantities(defaultUnit)
				? "twoQuantities"
				: undefined;
		if (reason) {
			pushWarning(ctx, WarningCode.INVALID_UNIT, {
				type: "Ingredient",
				value: defaultUnit,
				item: item.name,
				reason,
				loc: item.loc,
			});
		}
	}
	const id = registry.registerIngredient(
		item.name,
		defaultUnit ? { default_unit: defaultUnit } : undefined,
	);

	// Tag composite ingredients linked to a parent sub-recipe
	if (item.composite) {
		const parentId = registry.registerIngredient(item.composite.parent, {
			is_composite: true,
		});

		// A bare/generic child name (e.g. `@juice`) slugifies to the same
		// registry id regardless of which parent it's attached to — so the
		// same id resolving to two different parents means two physically
		// different substances are about to share one database entry (and
		// one nutrition/mass profile). Check before registerIngredient's
		// unconditional `existing.parent = data.parent` overwrite erases the
		// evidence.
		const childId = registry.getIngredientId(item.name);
		const existingChild = registry.ingredients.get(childId);
		if (
			existingChild?.is_composite &&
			existingChild.parent &&
			existingChild.parent !== parentId
		) {
			pushWarning(ctx, WarningCode.COMPOSITE_PARENT_CONFLICT, {
				childName: item.name,
				previousParent:
					registry.ingredients.get(existingChild.parent)?.name ??
					existingChild.parent,
				newParent: item.composite.parent,
				loc: item.loc,
			});
		}

		registry.registerIngredient(item.name, {
			is_composite: true,
			parent: parentId,
		});
	}

	// Process RelativeQuantity nodes (e.g. 50% of another ingredient/variable)
	if (item.quantity && item.quantity.type === ASTNodeType.RelativeQuantity) {
		const rel = item.quantity;
		const targetName = rel.target;
		const targetId = registry.getIngredientId(targetName);
		const percent = rel.percent;

		let isGhost = false;
		const formulaStr = `${percent}% of ${targetName}`;

		if (rel.referenceType === "variable") {
			if (!ctx.definedIntermediates.has(targetName)) {
				isGhost = true;
				pushWarning(ctx, WarningCode.VARIABLE_NOT_FOUND, {
					targetName,
					item: item.name,
					loc: item.loc,
				});
			}
		} else {
			const found = secIngredients.some((i) => i.id === targetId);
			if (!found) {
				isGhost = true;
				pushWarning(ctx, WarningCode.RELATIVE_QUANTITY_UNRESOLVED, {
					targetName,
					item: item.name,
					loc: item.loc,
				});
			}
		}

		const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
		// Defer evaluation to analyzer. The percentage's `text` stays in the
		// AST: the compiled JSON keeps the shape 1.3.0 published.
		const { text: _text, ...qty } = item.quantity;
		usage.qty = qty;
		usage.unit = null;

		if (targetId === id) {
			usage.isCircular = true;
			pushWarning(ctx, WarningCode.CIRCULAR_REFERENCE, {
				name: item.name,
				item: item.name,
				loc: item.loc,
			});
		}

		usage.dependencies = [targetId];
		usage.formula = {
			raw: formulaStr,
			target: targetName,
			percent: percent,
			isGhost: isGhost,
		};

		secIngredients.push(usage);
		return usage;
	}

	const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
	if (item.modifiers?.includes("&")) {
		if (!ctx.seenNames.has(item.name)) {
			pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, {
				prefix: "@&",
				name: item.name,
				item: item.name,
				loc: item.loc,
			});
		}
		if (ctx.definedIntermediates.has(item.name))
			ctx.usedIntermediates.add(item.name);
	} else {
		ctx.seenNames.add(item.name);
	}

	const hasQuantityValue = !!(
		item.quantity &&
		((item.quantity.type === ASTNodeType.Quantity &&
			(item.quantity.value !== null || item.quantity.unit !== null)) ||
			item.quantity.type === ASTNodeType.CompoundQuantity ||
			item.quantity.type === ASTNodeType.TextQuantity)
	);

	if (!item.modifiers?.includes("&") || hasQuantityValue) {
		secIngredients.push(usage);
	}

	return usage;
}

function processCookware(
	item: CookwareAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secCookware: Usage[],
): Usage {
	checkModifiers(ctx, item.modifiers, item.name, item.loc);

	const id = registry.registerCookware(item.name);
	const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
	secCookware.push(usage);
	return usage;
}

function processAlternative(
	item: AlternativeAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
	secCookware: Usage[],
): Usage {
	const processedOptions: ProcessedBlockResult[] = [];
	const tempIngredientsScope = [...secIngredients];
	const tempCookwareScope = [...secCookware];

	item.options.forEach((opt) => {
		const captureIngredients = [...tempIngredientsScope];
		const captureCookware = [...tempCookwareScope];

		const result = processBlockItem(
			opt,
			ctx,
			registry,
			captureIngredients,
			captureCookware,
		);
		if (result !== null) {
			processedOptions.push(result);

			if (typeof result !== "string") {
				// createCleanUsage never sets `.type` on a plain
				// ingredient/cookware Usage, so
				// `r.type === "ingredient"/"drink"/"cookware"` above were
				// dead branches — "drink" doesn't appear anywhere else in
				// the codebase. `opt.type` (the *AST* node, not the
				// processed Usage) is the reliable discriminant that was
				// available here all along.
				const r = result as Usage;
				if (opt.type === ASTNodeType.Cookware) {
					tempCookwareScope.push(r);
				} else {
					tempIngredientsScope.push(r);
				}
			}
		}
	});

	const usage: Usage = {
		id: "alternative",
		type: "alternative",
		options: processedOptions,
	};

	const firstOption = item.options[0];
	if (firstOption) {
		if (firstOption.type === ASTNodeType.Ingredient) {
			secIngredients.push(usage);
		} else if (firstOption.type === ASTNodeType.Cookware) {
			secCookware.push(usage);
		}
	}
	return usage;
}

function processReference(
	item: ReferenceAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
): Usage {
	// singleWordName stops at spaces but not punctuation, so "&crust." captures the trailing dot.
	// Strip trailing sentence punctuation before resolving the reference.
	const cleanName = item.name.replace(/[.,!?;:]+$/, "");
	const id = registry.getIngredientId(cleanName);
	if (!registry.ingredients.has(id)) {
		pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, {
			prefix: "&",
			name: item.displayName ?? cleanName,
			item: item.displayName ?? cleanName,
			loc: item.loc,
		});
	}
	if (ctx.definedIntermediates.has(cleanName))
		ctx.usedIntermediates.add(cleanName);

	const obj: Usage = {
		type: "reference",
		id,
		name: cleanName,
		_usageId: nextUsageId(ctx.usageCounter),
	};

	if (item.quantity) {
		if (item.quantity.type === ASTNodeType.Quantity) {
			if (item.quantity.value !== null || item.quantity.unit) {
				const cleanQty = minifyQuantity(item.quantity);
				if (cleanQty !== undefined) obj.qty = cleanQty;
				if (item.quantity.unit) obj.unit = item.quantity.unit;
			}
		} else if (item.quantity.type === ASTNodeType.TextQuantity) {
			obj.qty = item.quantity.value;
		} else if (item.quantity.type === ASTNodeType.CompoundQuantity) {
			const name = item.displayName ?? cleanName;
			checkSum(ctx, item.quantity, name, item.loc);
			const sum = readSum(item.quantity, item.loc);
			writeSum(obj, sum.terms, sum.problems.length > 0);
			if (item.quantity.fixed) obj.fixed = true;
		}
	}

	if (!ctx.currentSectionIntermediates.has(cleanName)) {
		secIngredients.push(obj);
	}

	return obj;
}

function processIntermediateDecl(
	item: IntermediateDecl,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
): ProcessedBlockResult {
	const id = registry.registerIngredient(item.name, {
		is_intermediate: true,
		displayName: item.displayName,
	});
	ctx.intermediateDecl = id;
	ctx.currentSectionIntermediates.add(item.name);
	return { type: "declaration", name: item.name, id };
}

function processTimer(
	item: TimerAST,
	ctx: ProcessorContext,
): ProcessedBlockResult {
	const obj: ProcessedTimer = { type: "timer" };
	if (item.name) obj.name = item.name;
	if (item.isPassive) obj.isPassive = true;
	obj.raw = item.raw;

	const name = item.name || "Timer";
	// The duration always comes from what was written. The grammar's quantity
	// is only kept when it already was a duration (`10 min`, `1-2 h`), so
	// those timers compile exactly as before.
	const kept =
		item.quantity.type === ASTNodeType.Quantity ? item.quantity : undefined;
	const reading = readTimer(item.raw, kept);
	if (!reading.ok) {
		// Refused: only `raw` is kept, and the timer counts for nothing,
		// never for a guessed or a zero duration given without a word.
		pushDurationProblem(
			ctx,
			reading.problem,
			"Timer",
			name,
			item.raw,
			item.loc,
		);
		return obj;
	}

	obj.quantity = reading.quantity;
	obj.unit = reading.unit;
	// Written back capped, so the quantity kept in the JSON agrees with the
	// duration the schedule was built on.
	if (isDurationTooLong({ value: obj.quantity, unit: obj.unit })) {
		pushWarning(ctx, WarningCode.DURATION_OUT_OF_RANGE, {
			type: "Timer",
			item: name,
			loc: item.loc,
		});
		obj.quantity = maxDurationIn(obj.unit);
	}
	obj.minutes = quantityToMinutes({ value: obj.quantity, unit: obj.unit });
	return obj;
}

/** The warning for a duration Gram does not read (see `durations.ts`). */
function pushDurationProblem(
	ctx: ProcessorContext,
	problem: DurationProblem,
	type: "Timer" | "RetroPlanning",
	item: string,
	raw: string,
	loc?: Location,
) {
	switch (problem.code) {
		case "MISSING_UNIT":
			pushWarning(ctx, WarningCode.MISSING_UNIT, { type, item, loc });
			return;
		case "INVALID_UNIT":
			pushWarning(ctx, WarningCode.INVALID_UNIT, {
				type,
				value: problem.unit,
				loc,
			});
			return;
		case "INVALID_DURATION":
			pushWarning(ctx, WarningCode.INVALID_DURATION, {
				type,
				value: raw,
				reason: problem.reason,
				item,
				loc,
			});
			return;
	}
}

/**
 * Only Celsius and Fahrenheit are supported. Accepts the unit with or
 * without the leading degree sign, case-insensitively, and normalizes to
 * the canonical `°C`/`°F` spelling regardless of how it was written.
 */
const TEMPERATURE_UNIT_PATTERN = /^°?([cf])$/i;

function normalizeTemperatureUnit(unit: string): string | null {
	const letter = TEMPERATURE_UNIT_PATTERN.exec(unit.trim())?.[1];
	return letter ? `°${letter.toUpperCase()}` : null;
}

function processTemperature(
	item: TemperatureAST,
	ctx: ProcessorContext,
): ProcessedBlockResult {
	const obj: ProcessedTemperature = { type: "temperature" };
	if (item.name) obj.name = item.name;
	if (item.text) {
		obj.text = item.text;
	} else {
		if (item.value) obj.quantity = item.value;
		if (item.unit) {
			const normalized = normalizeTemperatureUnit(item.unit);
			if (normalized) {
				obj.unit = normalized;
			} else {
				pushWarning(ctx, WarningCode.INVALID_UNIT, {
					type: "Temperature",
					value: item.unit,
					loc: item.loc,
				});
				obj.unit = item.unit;
			}
		} else {
			pushWarning(ctx, WarningCode.MISSING_UNIT, {
				type: "Temperature",
				item: item.name || "Temperature",
				loc: item.loc,
			});
		}
	}
	return obj;
}

function processRetroPlanning(
	section: SectionAST,
	ctx: ProcessorContext,
): RetroPlanning | undefined {
	const rp = section.retroPlanning;
	if (!rp) return undefined;

	const item = section.title || "Section";
	// The anchor itself (`~{-1h30}`), not the whole section; an AST built
	// before 1.5.0 has no `loc` on the anchor.
	const loc = rp.loc ?? section.loc;

	// Retro-planning only makes sense as anticipation ("prepare N time before
	// the rest"): a zero or positive offset has no clear meaning here, unlike
	// ~timer where a plain duration is the whole point. `readAnchor` refuses
	// both with MISSING_UNIT, as before.
	const reading = readAnchor(rp.raw);
	if (!reading.ok) {
		pushDurationProblem(
			ctx,
			reading.problem,
			"RetroPlanning",
			item,
			rp.raw,
			loc,
		);
		return { raw: rp.raw };
	}

	// Only an anchor that is kept: a dropped one was read as nothing, so how
	// its number was read does not matter yet.
	checkAmbiguousText(ctx, reading.text, String(reading.value), item, loc);

	let value = reading.value;
	const { unit } = reading;
	if (isDurationTooLong({ value, unit })) {
		pushWarning(ctx, WarningCode.DURATION_OUT_OF_RANGE, {
			type: "RetroPlanning",
			item,
			loc: loc,
		});
		value = maxDurationIn(unit);
	}

	return {
		raw: rp.raw,
		sign: -1,
		value,
		unit,
		minutes: -quantityToMinutes({ value, unit }),
	};
}

function processText(item: TextAST): ProcessedBlockResult {
	return item.value;
}

function processComment(item: CommentAST): ProcessedBlockResult {
	return { type: "comment", value: item.value, kind: item.kind };
}

// `ASTNode` now (correctly) also includes
// CompositeAST/QuantityAST/TextQuantityAST/RelativeQuantityAST,
// which only ever appear *nested* inside an Ingredient/Cookware/Reference/
// Timer node, never directly as a step's own child — narrowed to the real
// invariant (`StepAST["children"][number]`, which already covers both call
// sites: a step's own children, and an Alternative's `IngredientAST |
// CookwareAST` options) instead of the too-broad `ASTNode`, so the
// exhaustiveness check below stays meaningful.
export function processBlockItem(
	item: StepAST["children"][number] | null | undefined,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
	secCookware: Usage[],
): ProcessedBlockResult | null {
	if (!item) return null;
	checkAmbiguousNumbers(item, ctx);

	switch (item.type) {
		case ASTNodeType.Ingredient: {
			const ing = item as IngredientAST;
			return processIngredient(ing, ctx, registry, secIngredients);
		}
		case ASTNodeType.Cookware:
			return processCookware(item as CookwareAST, ctx, registry, secCookware);
		case ASTNodeType.Alternative: {
			const alt = item as AlternativeAST;
			return processAlternative(
				alt,
				ctx,
				registry,
				secIngredients,
				secCookware,
			);
		}
		case ASTNodeType.Reference:
			return processReference(
				item as ReferenceAST,
				ctx,
				registry,
				secIngredients,
			);
		case ASTNodeType.IntermediateDecl:
			return processIntermediateDecl(item as IntermediateDecl, ctx, registry);
		case ASTNodeType.Text:
			return processText(item as TextAST);
		case ASTNodeType.Timer:
			return processTimer(item as TimerAST, ctx);
		case ASTNodeType.Temperature:
			return processTemperature(item as TemperatureAST, ctx);
		case ASTNodeType.Comment:
			return processComment(item as CommentAST);
		default: {
			const _exhaustiveCheck: never = item;
			throw new Error(
				`Unhandled AST node type: ${(_exhaustiveCheck as { type?: string })?.type}`,
			);
		}
	}
}

/**
 * Groups a flat list of top-level AST children into a list of sections,
 * wrapping any run of non-`Section` nodes (bare steps/comments with no
 * heading) into a single synthetic untitled section placed first. Shared by
 * `processSections` and, in the module composer, by the rule that a module
 * without its own section must not spill bare steps into the host's own
 * untitled section — each side must group independently before splicing, or
 * an imported module's steps and the host's own bare steps would land in the
 * same section and cross-contaminate relative-quantity resolution.
 */
export function groupIntoSections(astChildren: ASTNode[]): ASTNode[] {
	const topLevelBlocks: ASTNode[] = [];
	const actualSections: ASTNode[] = [];

	for (const child of astChildren) {
		if (child.type === ASTNodeType.Section) {
			actualSections.push(child);
		} else {
			topLevelBlocks.push(child);
		}
	}

	const blocksToProcess = [...actualSections];
	if (topLevelBlocks.length > 0) {
		blocksToProcess.unshift({
			type: ASTNodeType.Section,
			title: null,
			children: topLevelBlocks,
		} as SectionAST);
	}

	return blocksToProcess;
}

/**
 * Main structural step/section processor.
 * Builds global scopes, registers intermediate recipe variables, schedules steps,
 * handles passive background tasks, and calculates active and total duration metrics.
 */
export function processSections(
	astChildren: ASTNode[],
	registry: RecipeRegistry,
	options?: CompilerOptions,
	imports: DeferredImport[] = [],
): {
	sections: ProcessedSection[];
	metrics: {
		idleTime: number;
		activeTime: number;
		activeBreakdown: TimeBreakdownItem[];
		totalBreakdown: TimeBreakdownItem[];
	};
	preparation: { total: number; breakdown: TimeBreakdownItem[] };
	miseEnPlace: SectionMiseEnPlace[];
	tasks: TaskGraph;
	schedule: Schedule;
} {
	const ctx: ProcessorContext = {
		warnings: registry.warnings,
		intermediateDecl: null,
		seenNames: new Set(),
		definedIntermediates: new Set(),
		usedIntermediates: new Set(),
		currentSectionIntermediates: new Set(),
		globalScopes: new Map(),
		usageCounter: { value: 0 },
		options,
	};

	// Register every `@use` binding as an intermediate up front, whether or
	// not module resolution actually happened. `compile()` never sees a
	// resolved module — that's `@gram-lang/modules`' job, running before
	// compile() and splicing the resolved sections in, at which point the
	// composed AST carries no `imports` at all. So non-empty `imports` here
	// unambiguously means "not resolved" (playground, `gram check` on a
	// standalone file, LSP mid-edit, or the module composer's own
	// per-module pre-pass) — one MODULE_NOT_FOUND per import instead of a
	// cascade of UNDEFINED_REFERENCE for every `&binding` used in the body.
	imports.forEach((decl) => {
		const isModuleSynthetic = decl.registryKind === "module_synthetic";
		decl.bindings.forEach((binding) => {
			registry.registerIngredient(
				binding.local,
				isModuleSynthetic
					? {
							is_module_synthetic: true,
							displayName: decl.title ?? binding.local,
						}
					: { is_intermediate: true },
			);
			ctx.globalScopes.set(binding.local, decl.specifier);
			ctx.definedIntermediates.add(binding.local);
		});
		if (!isModuleSynthetic) {
			pushWarning(ctx, WarningCode.MODULE_NOT_FOUND, {
				specifier: decl.specifier,
				loc: decl.loc,
			});
		}
	});

	const sections: ProcessedSection[] = [];
	const blocksToProcess: ASTNode[] = groupIntoSections(astChildren);

	const globalSchedules: StepSchedule[] = [];
	const stepFacts: StepFact[] = [];
	// Parallel to `sections`, kept only to recover a `.loc` for warnings raised
	// by the schedule module (see ./schedule) — `ProcessedSection` is the JSON
	// output shape and doesn't carry source locations.
	const sectionASTs: SectionAST[] = [];
	let globalActiveTime = 0;

	// --- PHASE 1: Forward Pass (Estimation & Flattening) ---
	blocksToProcess.forEach((node, sectionIndex) => {
		const sectionAST = node as SectionAST;
		sectionASTs.push(sectionAST);
		ctx.currentSectionIntermediates.clear();

		if (sectionAST.intermediateDecl) {
			const varName = sectionAST.intermediateDecl.name;
			if (ctx.globalScopes.has(varName)) {
				pushWarning(registry.warnings, WarningCode.SCOPE_CONFLICT, {
					varName: sectionAST.intermediateDecl.displayName ?? varName,
					section: sectionAST.title,
					loc: sectionAST.intermediateDecl?.loc,
				});
			} else {
				ctx.globalScopes.set(varName, sectionAST.title || "");
			}
			registry.registerIngredient(varName, {
				is_intermediate: true,
				displayName: sectionAST.intermediateDecl.displayName,
			});
			ctx.definedIntermediates.add(varName);
			ctx.currentSectionIntermediates.add(varName);
		}

		const sectionIngredients: Usage[] = [];
		const sectionCookware: Usage[] = [];
		const steps: ProcessedStepItem[] = [];

		const res: ProcessedSection = {
			title: sectionAST.title,
			ingredients: sectionIngredients,
			cookware: sectionCookware,
			steps,
		};

		if (sectionAST.intermediateDecl) {
			res.intermediate_preparation = sectionAST.intermediateDecl.name;
		}

		if (sectionAST.retroPlanning) {
			res.retro_planning = processRetroPlanning(sectionAST, ctx);
		}

		sections.push(res);

		sectionAST.children.forEach((block) => {
			if (block.type === ASTNodeType.Step) {
				let localActiveTime = 0;
				// The same step, as the task graph sees it: a timer written as a range is
				// planned on its longest figure when active, its shortest when passive
				// (`localActiveTime` and the timers' durations keep the average, for the
				// deprecated fields).
				let nominalActive = 0;
				const timerFacts: TimerFact[] = [];
				const stepPassiveTasks: StepSchedule["passiveTasks"] = [];
				const stepContentObjects: StepToken[] = [];
				const produced: string[] = [];
				const consumed: string[] = [];

				ctx.intermediateDecl = null;

				block.children.forEach((item) => {
					const processed = processBlockItem(
						item,
						ctx,
						registry,
						sectionIngredients,
						sectionCookware,
					);

					if (processed) {
						if (Array.isArray(processed)) {
							stepContentObjects.push(...processed);
						} else {
							stepContentObjects.push(processed);

							if (typeof processed !== "string" && "type" in processed) {
								if (processed.type === "reference" && processed.name) {
									consumed.push(processed.name);
								} else if (processed.type === "declaration" && processed.name) {
									produced.push(processed.name);
								} else if (
									processed.type === "timer" &&
									!("id" in processed) &&
									processed.quantity
								) {
									const time = {
										value: processed.quantity,
										unit: processed.unit,
									};
									const duration = quantityToMinutes(time);
									const { min, max } = quantityToMinutesRange(time);
									if (processed.isPassive) {
										timerFacts.push({
											...(processed.name && { track: processed.name }),
											offset: nominalActive,
											duration:
												min === max
													? { nominal: min }
													: { nominal: min, min, max },
										});
										stepPassiveTasks.push({
											taskId: taskIds.timer(
												sectionIndex,
												steps.length,
												stepPassiveTasks.length,
											),
											name: processed.name || "Timer",
											duration: duration,
											localOffset: localActiveTime,
											isNamed: !!processed.name,
											// Only set for genuinely named tracks — left undefined
											// for anonymous passive timers so the renderer's own
											// localized "Timer" fallback applies instead of a
											// hardcoded English string baked into the JSON.
											sourceName: processed.name || undefined,
										});
									} else {
										localActiveTime += duration;
										nominalActive += max;
									}
								}
							}
						}
					}
				});

				if (localActiveTime === 0 && stepPassiveTasks.length === 0) {
					localActiveTime = 2;
					nominalActive = 2;
				}

				let productionTime = localActiveTime;
				for (const task of stepPassiveTasks) {
					productionTime = Math.max(
						productionTime,
						task.localOffset + task.duration,
					);
				}

				const stepObj: ProcessedStep = {
					type: "step",
					content: stepContentObjects,
					timings: { start: 0, end: 0, activeDuration: localActiveTime },
					backgroundTasks: [],
				};
				if (block.action) stepObj.action = block.action;
				if (ctx.intermediateDecl) {
					stepObj.intermediate_preparation = ctx.intermediateDecl;
				}

				steps.push(stepObj);
				stepFacts.push({
					section: sectionIndex,
					step: steps.length - 1,
					active: nominalActive,
					timers: timerFacts,
					produced: [...produced],
					consumed: [...consumed],
				});
				globalSchedules.push({
					taskId: taskIds.step(sectionIndex, steps.length - 1),
					sectionIndex,
					stepIndex: steps.length - 1,
					isComment: false,
					localActiveTime,
					productionTime,
					produced,
					consumed,
					passiveTasks: stepPassiveTasks,
					ls: 0,
					lf: 0,
				});

				globalActiveTime += localActiveTime;
			} else if (block.type === ASTNodeType.Comment) {
				const commentObj: ProcessedComment = {
					type: "comment",
					value: block.value,
					kind: block.kind,
				};
				steps.push(commentObj);
				globalSchedules.push({
					taskId: taskIds.step(sectionIndex, steps.length - 1),
					sectionIndex,
					stepIndex: steps.length - 1,
					isComment: true,
					localActiveTime: 0,
					productionTime: 0,
					produced: [],
					consumed: [],
					passiveTasks: [],
					ls: 0,
					lf: 0,
				});
			}
		});
	});

	// `detectCycles` (./graph, used by
	// the shopping list for ingredient-formula dependencies) never saw the
	// language's other dependency domain — section-level `->&produced` /
	// `&consumed` intermediates — so an indirect cycle (`&a -> &b -> &a`)
	// went completely undetected. Same algorithm, fed the intermediate graph.
	const intermediateCycles = detectIntermediateCycles(sections);
	for (const name of intermediateCycles) {
		const decl = sectionASTs.find(
			(s) => s.intermediateDecl?.name === name,
		)?.intermediateDecl;
		pushWarning(registry.warnings, WarningCode.CIRCULAR_REFERENCE, {
			name,
			item: name,
			loc: decl?.loc,
		});
	}

	// Phases 2-4 (ALAP backward pass, named-track re-serialization, rebase +
	// commit) live in ./schedule — extracted so each is independently
	// unit-testable on synthetic StepSchedule arrays, without going through
	// the parser (audit 2026-07-22, kitchen finding F-004/P-001).
	// This legacy pass only feeds the deprecated fields (`timings`,
	// `backgroundTasks`, `metrics`); the default timeline comes from the task
	// graph below and never reads what it writes.
	const locationOf = (section: number) => sectionASTs[section]?.loc;

	const legacyDiagnostics: SchedulingDiagnostic[] = [];
	scheduleALAP(globalSchedules, sections, legacyDiagnostics);
	const scheduledPassiveTasks = serializeTracks(
		globalSchedules,
		legacyDiagnostics,
	);
	pushSchedulingWarnings(
		registry.warnings,
		legacyDiagnostics,
		sections,
		locationOf,
	);
	const legacyTimeline = computeTimeline(
		globalSchedules,
		scheduledPassiveTasks,
		sections,
	);
	const metrics = commitTimeline(legacyTimeline, sections, globalActiveTime);

	// Mise en place: one cost per section. With the steps, it makes the task
	// graph; the scheduler lays it out into the default timeline.
	const analysis = analyzeMiseEnPlace(sections, registry);
	const miseEnPlace = analysis.entries;
	const preparation = calculatePreparationTime(sections, registry, miseEnPlace);
	const tasks = buildTaskGraph(sections, stepFacts, analysis);
	const { schedule, diagnostics } = layout(tasks);
	// Problems only this timeline runs into (the legacy pass above reports the
	// others) must not be hidden: add their warnings to the official ones.
	const found: Warning[] = [];
	pushSchedulingWarnings(found, diagnostics, sections, locationOf);
	for (const w of found) {
		if (!registry.warnings.some((o) => isSameSchedulingProblem(o, w))) {
			registry.warnings.push(w);
		}
	}
	pushPassiveOverlapWarnings(
		registry.warnings,
		schedule,
		sections,
		new Set(registry.cookware.keys()),
		locationOf,
	);

	return {
		sections,
		metrics,
		preparation,
		miseEnPlace,
		tasks,
		schedule,
	};
}

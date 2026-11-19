import {
	minifyQuantity,
	createCleanUsage,
	isDurationTooLong,
	maxDurationIn,
	quantityToMinutes,
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
	type CheckpointAST,
	type TextAST,
	type CompoundQuantityAST,
	type RatioQuantityAST,
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
	ProcessedCheckpoint,
	ProcessedComment,
	RetroPlanning,
	TimeBreakdownItem,
	DeferredImport,
	RatioSpec,
	Schedule,
	SectionMiseEnPlace,
} from "./types";
import {
	kitchenConverter,
	pendingRatio,
	pushRatioWarnings,
	resolveRatios,
} from "./ratio";
import { type TaskGraph, layout } from "@gram-lang/scheduler";
import { buildTaskGraph } from "./task-graph";
import { planLegacy } from "./legacy-timings";
import { recipeTimings } from "./step-timing";
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
			checkRatioNumbers(ctx, item.quantity, item.name, item.loc);
			return;
		case ASTNodeType.Cookware:
			for (const value of quantityValues(item.quantity))
				checkAmbiguousNumber(ctx, value, item.name, item.loc);
			return;
		case ASTNodeType.Reference:
			for (const value of quantityValues(item.quantity))
				checkAmbiguousNumber(ctx, value, item.name, item.loc);
			checkRatioNumbers(ctx, item.quantity, item.name, item.loc);
			return;
		case ASTNodeType.Timer:
			if (item.quantity?.type === ASTNodeType.RatioQuantity) {
				// Its duration's numbers as written, then its denominator.
				if (parseDuration(item.quantity.durationRaw ?? "").ok) {
					for (const text of (item.quantity.durationRaw ?? "").match(
						/\d+(?:[.,]\d+)?/g,
					) ?? [])
						checkAmbiguousText(
							ctx,
							text,
							String(Number(text.replace(",", "."))),
							item.name || "Timer",
							item.loc,
						);
				}
				checkAmbiguousNumber(
					ctx,
					item.quantity.denominator.value,
					item.name || "Timer",
					item.loc,
				);
			} else if (item.quantity?.type === ASTNodeType.Quantity) {
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

/** The numbers of a ratio (`1,5 / 100 g @&flour`), numerator and denominator. */
function checkRatioNumbers(
	ctx: ProcessorContext,
	quantity: { type: ASTNodeType } | null | undefined,
	item: string,
	loc?: Location,
) {
	if (quantity?.type !== ASTNodeType.RatioQuantity) return;
	const ratio = quantity as RatioQuantityAST;
	checkAmbiguousNumber(ctx, ratio.numerator.value, item, loc);
	checkAmbiguousNumber(ctx, ratio.denominator.value, item, loc);
}

/** The numbers the parser refused in a `{…}` (`invalidNumber`), one per term of a sum. */
const refusedNumbers = (
	quantity: { type: ASTNodeType } | null | undefined,
): { text: string; loc?: Location }[] => {
	if (!quantity) return [];
	if (quantity.type === ASTNodeType.CompoundQuantity) {
		return (quantity as CompoundQuantityAST).terms.flatMap((term) =>
			term.invalidNumber ? [{ text: term.invalidNumber, loc: term.loc }] : [],
		);
	}
	if (quantity.type === ASTNodeType.RatioQuantity) {
		const ratio = quantity as RatioQuantityAST;
		return ratioRefusedNumbers(ratio).map((text) => ({ text, loc: ratio.loc }));
	}
	const text = (quantity as { invalidNumber?: string }).invalidNumber;
	return text ? [{ text, loc: (quantity as { loc?: Location }).loc }] : [];
};

/**
 * `{1/0 cup}`: a fraction over zero has no value, so the parser leaves it out
 * and the element reads as if it had no number (`cup` alone, a sum without
 * that term, `1%` for `{1/0% &dough}`). Said here, on every element that
 * holds a number. A timer is left to INVALID_DURATION, which already says it.
 */
function checkRefusedNumbers(
	item: StepAST["children"][number],
	ctx: ProcessorContext,
) {
	const push = (
		refused: { text: string; loc?: Location }[],
		name: string,
		loc?: Location,
	) => {
		for (const number of refused) {
			pushWarning(ctx, WarningCode.INVALID_QUANTITY, {
				value: number.text,
				reason: "zeroDenominator",
				item: name,
				loc: number.loc ?? loc,
			});
		}
	};
	switch (item.type) {
		case ASTNodeType.Ingredient:
			push(refusedNumbers(item.quantity), item.name, item.loc);
			push(
				refusedNumbers(item.composite?.quantity),
				item.composite?.parent ?? item.name,
				item.loc,
			);
			return;
		case ASTNodeType.Cookware:
		case ASTNodeType.Reference:
			push(refusedNumbers(item.quantity), item.name, item.loc);
			return;
		case ASTNodeType.Timer:
			// A ratio's denominator (`~{15 min / 1/0 kg @&roast}`); its duration
			// is left to INVALID_DURATION, like any timer's.
			if (item.quantity.type === ASTNodeType.RatioQuantity)
				push(refusedNumbers(item.quantity), item.name || "Timer", item.loc);
			return;
		case ASTNodeType.Temperature:
			if (item.invalidNumber)
				push(
					[{ text: item.invalidNumber }],
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

/**
 * `@eggs{3}<@box{50% @&flour}>`: a share of another ingredient on a composite
 * parent is not supported yet (composites are reworked in 1.6). Said here,
 * rather than dropped without a word: the parent reads with no quantity.
 */
function checkRelativeParent(ctx: ProcessorContext, item: IngredientAST) {
	const quantity = item.composite?.quantity;
	let value: string;
	if (quantity?.type === ASTNodeType.RelativeQuantity) {
		if (quantity.invalidNumber) return; // already said (zeroDenominator)
		value = `${quantity.text ?? quantity.percent}% ${quantity.referenceType === "variable" ? "&" : "@&"}${quantity.target}`;
	} else if (quantity?.type === ASTNodeType.RatioQuantity) {
		// A ratio (`<@box{1 / 100 g @&flour}>`, since 1.5.0): the same.
		if (ratioRefusedNumbers(quantity).length > 0) return; // already said
		value = quantity.raw;
	} else return;
	pushWarning(ctx, WarningCode.INVALID_QUANTITY, {
		value,
		reason: "relativeNotSupported",
		item: item.composite?.parent ?? item.name,
		loc: quantity.loc ?? item.loc,
	});
}

/**
 * A share's or a ratio's target as its author wrote it (`pate`), for what a
 * reader sees: the compiled `target`, its formula, its warnings. Module
 * composition renames a base's private intermediate (`dough$pate`); the
 * target is still found by `targetId`.
 */
const shownTarget = (quantity: {
	target: string;
	targetDisplayName?: string;
}): string => quantity.targetDisplayName ?? quantity.target;

/**
 * The target of a share or a ratio (`@&flour`, `&dough`): its id, and
 * whether it is where it should be. An intermediate must be defined; an
 * ingredient must appear earlier in the section (`secIngredients`, an
 * alternative's earlier options included). One that is not is a ghost: the
 * share or ratio is never resolved. `selfId` flags a target that is the
 * element itself.
 */
function checkRelativeTarget(
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
	target: {
		target: string;
		targetDisplayName?: string;
		referenceType: "variable" | "ingredient";
	},
	item: { name: string; loc?: Location },
	selfId?: string,
): { targetId: string; isGhost: boolean; isCircular: boolean } {
	const targetName = target.target;
	const targetId = registry.getIngredientId(targetName);
	let isGhost = false;

	if (target.referenceType === "variable") {
		if (!ctx.definedIntermediates.has(targetName)) {
			isGhost = true;
			pushWarning(ctx, WarningCode.VARIABLE_NOT_FOUND, {
				targetName: shownTarget(target),
				item: item.name,
				loc: item.loc,
			});
		}
	} else if (!secIngredients.some((i) => i.id === targetId)) {
		isGhost = true;
		pushWarning(ctx, WarningCode.RELATIVE_QUANTITY_UNRESOLVED, {
			targetName,
			item: item.name,
			loc: item.loc,
		});
	}

	const isCircular = selfId !== undefined && targetId === selfId;
	if (isCircular) {
		pushWarning(ctx, WarningCode.CIRCULAR_REFERENCE, {
			name: item.name,
			item: item.name,
			loc: item.loc,
		});
	}
	return { targetId, isGhost, isCircular };
}

/** The numbers of a ratio the parser refused (`1/0`), numerator and denominator. */
const ratioRefusedNumbers = (quantity: RatioQuantityAST) =>
	[quantity.numerator, quantity.denominator].flatMap((term) =>
		term.invalidNumber ? [term.invalidNumber] : [],
	);

/**
 * True when a ratio can be read: none of its numbers was refused (already
 * said, `zeroDenominator`), and its denominator is not zero (`/ 0 g`, said
 * here, `zeroRatioDenominator`). One that cannot reads as if no amount had
 * been written.
 */
function isReadableRatio(
	ctx: ProcessorContext,
	quantity: RatioQuantityAST,
	item: string,
	loc?: Location,
	type?: "Timer",
): boolean {
	if (ratioRefusedNumbers(quantity).length > 0) return false;
	if (quantity.denominator.value?.value === 0) {
		const { unit } = quantity.denominator;
		pushWarning(ctx, WarningCode.INVALID_QUANTITY, {
			value: unit ? `0 ${unit}` : "0",
			reason: "zeroRatioDenominator",
			item,
			...(type && { type }),
			loc: quantity.loc ?? loc,
		});
		return false;
	}
	return true;
}

/** A ratio as written, ready to be resolved (and resolved again). */
function ratioSpecOf(
	quantity: RatioQuantityAST,
	numerator: RatioSpec["numerator"],
	targetId: string,
	isGhost: boolean,
): RatioSpec {
	return {
		numerator,
		denominator: {
			value: quantity.denominator.value?.value ?? 1,
			unit: quantity.denominator.unit,
		},
		target: shownTarget(quantity),
		targetId,
		referenceType: quantity.referenceType,
		raw: quantity.raw,
		...(quantity.loc && { loc: quantity.loc }),
		...(isGhost && { isGhost: true }),
	};
}

/**
 * Turns `usage` into a ratio's: the pending node as its amount until
 * `resolveRatios` writes one, the ratio as its formula, its target as its
 * dependency. Shared by ingredients and references.
 */
function writeRatioUsage(
	usage: Usage,
	quantity: RatioQuantityAST,
	target: { targetId: string; isGhost: boolean; isCircular: boolean },
) {
	if (!quantity.numerator.value) return;
	const spec = ratioSpecOf(
		quantity,
		{ value: quantity.numerator.value, unit: quantity.numerator.unit },
		target.targetId,
		target.isGhost,
	);
	usage.qty = pendingRatio(spec);
	delete usage.unit;
	if (target.isCircular) usage.isCircular = true;
	usage.dependencies = [target.targetId];
	usage.formula = {
		raw: quantity.raw,
		target: shownTarget(quantity),
		ratio: spec,
		isGhost: target.isGhost,
	};
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
	checkRelativeParent(ctx, item);

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

	// Process RelativeQuantity nodes (e.g. 50% of another ingredient/variable).
	// One whose number was refused (`{1/0% &dough}`, INVALID_QUANTITY) reads
	// as if no number had been written: an ingredient with no quantity.
	if (
		item.quantity &&
		item.quantity.type === ASTNodeType.RelativeQuantity &&
		!item.quantity.invalidNumber
	) {
		const rel = item.quantity;
		const target = checkRelativeTarget(
			ctx,
			registry,
			secIngredients,
			rel,
			item,
			id,
		);

		const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
		// Defer evaluation to analyzer. The percentage's `text` stays in the
		// AST: the compiled JSON keeps the shape 1.3.0 published.
		const { text: _text, targetDisplayName: _shown, ...qty } = rel;
		qty.target = shownTarget(rel);
		usage.qty = qty;
		usage.unit = null;
		if (target.isCircular) usage.isCircular = true;

		usage.dependencies = [target.targetId];
		usage.formula = {
			raw: `${rel.percent}% of ${shownTarget(rel)}`,
			target: shownTarget(rel),
			percent: rel.percent,
			isGhost: target.isGhost,
		};

		secIngredients.push(usage);
		return usage;
	}

	// A ratio with units (`1 / 100 g @&flour`, since 1.5.0): read like a
	// percentage, resolved once every section is read (`resolveRatios`).
	if (
		item.quantity?.type === ASTNodeType.RatioQuantity &&
		isReadableRatio(ctx, item.quantity, item.name, item.loc)
	) {
		const target = checkRelativeTarget(
			ctx,
			registry,
			secIngredients,
			item.quantity,
			item,
			id,
		);
		const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
		// A ratio always follows its target: `=` would freeze it.
		if (usage.modifiers?.includes("=")) {
			pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
				item: item.name,
				combination: "= and a ratio",
				loc: item.loc,
			});
			usage.modifiers = usage.modifiers.filter((m) => m !== "=");
			if (usage.modifiers.length === 0) delete usage.modifiers;
		}
		writeRatioUsage(usage, item.quantity, target);
		secIngredients.push(usage);
		return usage;
	}

	const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
	// A ratio not read (a refused number) keeps no `=` either.
	if (item.quantity?.type === ASTNodeType.RatioQuantity && usage.modifiers) {
		usage.modifiers = usage.modifiers.filter((m) => m !== "=");
		if (usage.modifiers.length === 0) delete usage.modifiers;
	}
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
		} else if (
			item.quantity.type === ASTNodeType.RelativeQuantity &&
			!item.quantity.invalidNumber
		) {
			// A share of another ingredient (`&stock{250% @&rice}`), ignored
			// before 1.5.0: read as on an ingredient, resolved by the analyzer.
			const rel = item.quantity;
			const target = checkRelativeTarget(
				ctx,
				registry,
				secIngredients,
				rel,
				{ name: item.displayName ?? cleanName, loc: item.loc },
				id,
			);
			const { text: _text, targetDisplayName: _shown, ...qty } = rel;
			qty.target = shownTarget(rel);
			obj.qty = qty;
			obj.unit = null;
			if (target.isCircular) obj.isCircular = true;
			obj.dependencies = [target.targetId];
			obj.formula = {
				raw: `${rel.percent}% of ${shownTarget(rel)}`,
				target: shownTarget(rel),
				percent: rel.percent,
				isGhost: target.isGhost,
			};
		} else if (
			item.quantity.type === ASTNodeType.RatioQuantity &&
			isReadableRatio(
				ctx,
				item.quantity,
				item.displayName ?? cleanName,
				item.loc,
			)
		) {
			// A ratio (`&stock{250 ml / 100 g @&rice}`), as on an ingredient.
			const target = checkRelativeTarget(
				ctx,
				registry,
				secIngredients,
				item.quantity,
				{ name: item.displayName ?? cleanName, loc: item.loc },
				id,
			);
			writeRatioUsage(obj, item.quantity, target);
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
	// Declared by a step (`Mix … ->&dough.`) as by a section title: a later
	// share of it (`@salt{2% &dough}`) finds it, instead of a VARIABLE_NOT_FOUND.
	ctx.definedIntermediates.add(item.name);
	return { type: "declaration", name: item.name, id };
}

function processTimer(
	item: TimerAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
): ProcessedBlockResult {
	const obj: ProcessedTimer = { type: "timer" };
	if (item.name) obj.name = item.name;
	if (item.isPassive) obj.isPassive = true;
	obj.raw = item.raw;

	const name = item.name || "Timer";

	// A proportional time (`~{15 min / 500 g @&roast}`, since 1.5.0): its
	// duration as any timer's, its target as a ratio's. `quantity`, `unit`
	// and `minutes` come from `resolveRatios`, once every section is read.
	if (item.quantity.type === ASTNodeType.RatioQuantity) {
		const ratio = item.quantity;
		const durationRaw = ratio.durationRaw ?? "";
		const reading = readTimer(durationRaw);
		if (!reading.ok) {
			pushDurationProblem(
				ctx,
				reading.problem,
				"Timer",
				name,
				durationRaw,
				item.loc,
			);
			return obj;
		}
		if (!isReadableRatio(ctx, ratio, name, item.loc, "Timer")) return obj;
		const target = checkRelativeTarget(ctx, registry, secIngredients, ratio, {
			name,
			loc: item.loc,
		});
		obj.ratio = ratioSpecOf(
			ratio,
			{ value: reading.quantity, unit: reading.unit },
			target.targetId,
			target.isGhost,
		);
		return obj;
	}

	// The duration always comes from what was written. The grammar's quantity
	// is only kept when it already was a duration (`10 min`, `1-2 h`), so
	// those timers compile exactly as before.
	const kept =
		item.quantity.type === ASTNodeType.Quantity ? item.quantity : undefined;
	const reading = readTimer(item.raw, kept);
	if (!reading.ok) {
		// Refused: only `raw` is kept, and the timer counts for nothing,
		// never for a guessed or a zero duration given without a word. One
		// that looks like a proportional time says how to write one.
		const problem: DurationProblem = LOOKS_LIKE_RATIO.test(item.raw)
			? {
					code: "INVALID_DURATION",
					reason: /[*×]/.test(item.raw) ? "ratioMultiplication" : "ratioShape",
				}
			: reading.problem;
		pushDurationProblem(ctx, problem, "Timer", name, item.raw, item.loc);
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

/** A slash followed by a target (`/ 500 g @&roast`): a ratio, read or not. */
const LOOKS_LIKE_RATIO = /\/[^/]*(?:@&|&)/;

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
	if (item.note) obj.note = item.note;
	return obj;
}

// A target state is words for the cook: passed on as written, never read.
function processCheckpoint(item: CheckpointAST): ProcessedBlockResult {
	const obj: ProcessedCheckpoint = { type: "checkpoint", state: item.state };
	if (item.note) obj.note = item.note;
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
	// `~{-15 min / 500 g @&roast}`: an anchor is one duration, never a ratio.
	const reading: ReturnType<typeof readAnchor> = LOOKS_LIKE_RATIO.test(rp.raw)
		? {
				ok: false,
				problem: { code: "INVALID_DURATION", reason: "anchorRatio" },
			}
		: readAnchor(rp.raw);
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
	checkRefusedNumbers(item, ctx);

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
			return processTimer(item as TimerAST, ctx, registry, secIngredients);
		case ASTNodeType.Temperature:
			return processTemperature(item as TemperatureAST, ctx);
		case ASTNodeType.Checkpoint:
			return processCheckpoint(item as CheckpointAST);
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

	// Parallel to `sections`, kept only to recover a `.loc` for warnings raised
	// by the schedule module (see ./schedule) — `ProcessedSection` is the JSON
	// output shape and doesn't carry source locations.
	const sectionASTs: SectionAST[] = [];

	// --- Reading: every section into tokens ---
	blocksToProcess.forEach((node) => {
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
				const stepContentObjects: StepToken[] = [];
				ctx.intermediateDecl = null;

				block.children.forEach((item) => {
					const processed = processBlockItem(
						item,
						ctx,
						registry,
						sectionIngredients,
						sectionCookware,
					);
					if (processed) stepContentObjects.push(processed);
				});

				// `timings` and `backgroundTasks` are written by the legacy pass
				// (`planLegacy`), once every step is known.
				const stepObj: ProcessedStep = {
					type: "step",
					content: stepContentObjects,
					timings: { start: 0, end: 0, activeDuration: 0 },
					backgroundTasks: [],
				};
				if (block.action) stepObj.action = block.action;
				if (ctx.intermediateDecl) {
					stepObj.intermediate_preparation = ctx.intermediateDecl;
				}
				steps.push(stepObj);
			} else if (block.type === ASTNodeType.Comment) {
				const commentObj: ProcessedComment = {
					type: "comment",
					value: block.value,
					kind: block.kind,
				};
				steps.push(commentObj);
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

	// The time of every step, read from its tokens once all of them are
	// known, then the legacy pass (ALAP backward pass, named-track
	// re-serialization, rebase + commit, in ./legacy-timings). It only feeds
	// the deprecated fields (`timings`, `backgroundTasks`, `metrics`); the
	// default timeline comes from the task graph below and never reads what
	// it writes.
	// Ratios with units, now that every section is read and before any
	// duration counts: kitchen resolves what one unit family allows, the
	// analyzer the rest (a density, a unit weight).
	const ratios = resolveRatios(sections, kitchenConverter(), {
		mode: "kitchen",
	});
	pushRatioWarnings(registry.warnings, ratios.problems);

	const locationOf = (section: number) => sectionASTs[section]?.loc;
	const { facts: stepFacts, schedules } = recipeTimings(sections);
	const legacy = planLegacy(sections, schedules);
	pushSchedulingWarnings(
		registry.warnings,
		legacy.diagnostics,
		sections,
		locationOf,
	);
	const metrics = legacy.metrics;

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

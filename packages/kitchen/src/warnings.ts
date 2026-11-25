import type { Location } from "@gram-lang/parser";
import { type InvalidQuantityReason, splitTwoQuantities } from "./compound";
import type { InvalidDurationReason } from "./durations";
import type { RatioFailure } from "./ratio";

export enum WarningCode {
	VARIABLE_NOT_FOUND = "VARIABLE_NOT_FOUND",
	RELATIVE_QUANTITY_UNRESOLVED = "RELATIVE_QUANTITY_UNRESOLVED",
	RELATIVE_QUANTITY_UNKNOWN_MASS = "RELATIVE_QUANTITY_UNKNOWN_MASS",
	CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
	UNDEFINED_REFERENCE = "UNDEFINED_REFERENCE",
	MISSING_UNIT = "MISSING_UNIT",
	INVALID_UNIT = "INVALID_UNIT",
	SCOPE_CONFLICT = "SCOPE_CONFLICT",
	MISSING_INGREDIENT = "MISSING_INGREDIENT",
	MISSING_MACROS = "MISSING_MACROS",
	UNKNOWN_MASS = "UNKNOWN_MASS",
	INVALID_MODIFIER_COMBINATION = "INVALID_MODIFIER_COMBINATION",
	COMPOSITE_PARENT_CONFLICT = "COMPOSITE_PARENT_CONFLICT",
	// Produced by @gram-lang/analyzer (not kitchen itself), but part of the same
	// shared warning vocabulary that flows through CompilationResult.warnings.
	INVALID_BAKERS_REFERENCE = "INVALID_BAKERS_REFERENCE",
	NO_BAKERS_REFERENCE = "NO_BAKERS_REFERENCE",
	/** A second ingredient marked `*`; the first one stays the base. Since 1.5.1. */
	MULTIPLE_BAKERS_PERCENTAGE = "MULTIPLE_BAKERS_PERCENTAGE",
	TIME_PARADOX = "TIME_PARADOX",
	TRACK_CONTENTION = "TRACK_CONTENTION",
	DAY_OVERFLOW = "DAY_OVERFLOW",
	PASSIVE_OVERLAP_SAME_COOKWARE = "PASSIVE_OVERLAP_SAME_COOKWARE",
	DURATION_OUT_OF_RANGE = "DURATION_OUT_OF_RANGE",
	AMBIGUOUS_NUMBER = "AMBIGUOUS_NUMBER",
	INVALID_DURATION = "INVALID_DURATION",
	INVALID_QUANTITY = "INVALID_QUANTITY",
	OZ_AFTER_VOLUME = "OZ_AFTER_VOLUME",
	/** `@lemon zest{1} < @lemon{2}`: spaces around `<` split a composite in two. Since 1.5.2. */
	SPACED_COMPOSITE = "SPACED_COMPOSITE",
	// Module imports (module-imports RFC, .notes/plan-ajout-imports-recettes.md
	// Phase E). The only module-related code kitchen raises itself, in the
	// no-resolution-happened degraded path (§C.4) — every other module-only
	// warning code lives in `@gram-lang/modules`' own `ModuleWarningCode`
	// (`packages/modules/src/warnings.ts`), pushed via `pushRawWarning` below
	// onto this same shared `Warning` vocabulary.
	MODULE_NOT_FOUND = "MODULE_NOT_FOUND",
}

export interface WarningPayloads {
	[WarningCode.VARIABLE_NOT_FOUND]: {
		targetName: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: {
		targetName: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: {
		targetName: string;
		item: string;
		/**
		 * Why a ratio with units (`1 / 100 g @&flour`) is not resolved. Absent
		 * for a percentage, whose target's mass is unknown. Since 1.5.0.
		 */
		reason?: Exclude<RatioFailure, "deferred">;
		/** For `incompatibleUnits`: the unit the target is counted in, as written. */
		unit?: string | null;
		loc?: Location;
	};
	[WarningCode.CIRCULAR_REFERENCE]: {
		name: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.UNDEFINED_REFERENCE]: {
		prefix: string;
		name: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.MISSING_UNIT]: {
		type: "Timer" | "Temperature" | "RetroPlanning";
		item: string;
		loc?: Location;
	};
	[WarningCode.INVALID_UNIT]: {
		type: "Timer" | "Temperature" | "RetroPlanning" | "Ingredient";
		value: string;
		item?: string;
		/**
		 * An ingredient only: why its unit is invalid. `twoQuantities` for
		 * `{1 cup 5 tbsp}`, `hiddenQuantity` for `{about 200g}`.
		 */
		reason?: "twoQuantities" | "hiddenQuantity";
		loc?: Location;
	};
	[WarningCode.DURATION_OUT_OF_RANGE]: {
		type: "Timer" | "RetroPlanning";
		item: string;
		loc?: Location;
	};
	[WarningCode.INVALID_DURATION]: {
		type: "Timer" | "RetroPlanning";
		/** The duration as written, e.g. `1:30` or `-1-2d`. */
		value: string;
		/** Why it is not read (see `InvalidDurationReason`). */
		reason: InvalidDurationReason;
		item: string;
		loc?: Location;
	};
	[WarningCode.INVALID_QUANTITY]: {
		/** The term at fault as written (`10%`), or the whole sum for its total. */
		value: string;
		/** Why the sum is refused (see `InvalidQuantityReason`). */
		reason: InvalidQuantityReason;
		/** What to write instead, when Gram can tell (`110 g`). */
		suggestion?: string;
		item: string;
		/** `"Timer"` when the quantity is a timer's (`~{15 min / 0 g @&roast}`). */
		type?: "Timer";
		loc?: Location;
	};
	[WarningCode.OZ_AFTER_VOLUME]: {
		/** The `oz` term as written, e.g. `2 oz`. */
		value: string;
		/** The unit to write for a volume: `fl oz`. */
		suggestion: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.SPACED_COMPOSITE]: {
		/** The ingredient before `<`, meant as the composite's child. */
		item: string;
		/** The ingredient after `<`, meant as its parent. */
		parent: string;
		/** What replaces ` < @parent`: the operator glued to the parent, `<@lemon`. */
		suggestion: string;
		loc?: Location;
	};
	[WarningCode.AMBIGUOUS_NUMBER]: {
		/** The number as written, e.g. `1,000` or `1,000-2,000`. */
		value: string;
		/** How Gram read it, e.g. `1` or `1-2`. */
		read: string;
		/** The number without its comma, e.g. `1000`. */
		suggestion: string;
		item: string;
		loc?: Location;
	};
	[WarningCode.SCOPE_CONFLICT]: {
		varName: string;
		section: string | null;
		loc?: Location;
	};
	[WarningCode.MISSING_INGREDIENT]: { id: string };
	[WarningCode.MISSING_MACROS]: { id: string };
	[WarningCode.UNKNOWN_MASS]: { id: string };
	[WarningCode.INVALID_MODIFIER_COMBINATION]: {
		item: string;
		combination: string;
		loc?: Location;
	};
	[WarningCode.COMPOSITE_PARENT_CONFLICT]: {
		childName: string;
		previousParent: string;
		newParent: string;
		loc?: Location;
	};
	[WarningCode.INVALID_BAKERS_REFERENCE]: { item: string };
	[WarningCode.NO_BAKERS_REFERENCE]: Record<string, never>;
	[WarningCode.MULTIPLE_BAKERS_PERCENTAGE]: { item: string; reference: string };
	[WarningCode.TIME_PARADOX]: {
		cause: string;
		conflict: string;
		loc?: Location;
	};
	[WarningCode.TRACK_CONTENTION]: {
		trackName: string;
		delay: number;
		item: string;
		loc?: Location;
	};
	[WarningCode.DAY_OVERFLOW]: {
		section: string | null;
		day: number;
		overflowMinutes: number;
		loc?: Location;
	};
	[WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE]: {
		cookware: string;
		item: string;
		other: string;
		loc?: Location;
	};
	[WarningCode.MODULE_NOT_FOUND]: {
		specifier: string;
		loc?: Location;
	};
}

/** "45 min", "2 h", "1.5 h": a duration worded for a warning message. */
const formatMinutes = (minutes: number): string =>
	minutes < 120
		? `${minutes} min`
		: `${parseFloat((minutes / 60).toFixed(1))} h`;

/** What to write instead, for each reason a duration is refused. */
const DURATION_HINTS: Record<InvalidDurationReason, string> = {
	words:
		"write it with numbers and units only, e.g. 1h30, 1 hr 30 min, 1:30 h or 5'30\".",
	multiplication:
		"Gram does not multiply durations: write the total, e.g. 4 min.",
	iso8601:
		"ISO 8601 is a notation for machines: write 1h30 rather than PT1H30M.",
	unexpected:
		"a character is out of place: write e.g. 1h30, 45 min - 1 h or 5'30\".",
	ambiguousClock:
		"a clock with two parts could be hours or minutes: write 1h30 or 1:30 min.",
	clockFormat:
		"a clock is h:mm:ss, or two parts followed by a unit (1:30 h, 4:30 min), with two digits after each colon.",
	unitOrder:
		"units go from the largest to the smallest, each once: write 1h 30min, not 30min 1h.",
	duplicateUnit: "each unit appears once: write 3h, not 1h 2h.",
	overflow60:
		"minutes or seconds after a larger unit stay under 60: write 2h15, not 1h75.",
	decimalInCompound:
		"a decimal or a fraction only works alone: write 1.5 h or 1h30, not 1.5h30.",
	decimalPrime: "primes take whole numbers: write 1 min 30 or 90\", not 1.5'.",
	bareNumber:
		"a number without a unit only follows hours (as minutes) or minutes (as seconds): write 1h30 or 2min30.",
	reversedRange:
		"a range starts with the shorter duration: write 1-2 h, not 2-1 h.",
	emptyRange: "both ends of the range are the same: write a single duration.",
	ambiguousRange:
		"one side of the range has no clear unit: write both sides in full, e.g. 1h-2h30 rather than 1-2h30.",
	anchorRange: "a section anchor is one duration, not a range: write e.g. -1d.",
	anchorSeconds:
		"a section anchor counts in days, hours and minutes: write e.g. -1h30 or -1:30 h.",
	ratioMultiplication:
		"Gram does not multiply a proportional time yet: write the ratio alone, e.g. ~{15 min / 500 g @&roast}.",
	ratioShape:
		"a proportional time is a duration / an amount of a target, e.g. ~{15 min / 500 g @&roast}; the amount is a single number.",
	anchorRatio:
		"a section anchor is one duration, not a proportional time: write e.g. -1h30.",
};

/** What a ratio that does not resolve tells the author. */
function ratioHint(
	reason: Exclude<RatioFailure, "deferred">,
	target: string,
	unit?: string | null,
): string {
	switch (reason) {
		case "noTargetQuantity":
			return `'${target}' has no amount to count from: write its amount where it is used (e.g. @${target}{500 g}).`;
		case "incompatibleUnits":
			return unit && /\s(?:de|du|des|of|d['’])$/iu.test(unit)
				? `the unit "${unit}" takes the word after it: write the unit alone, e.g. 1 / 100 g @&flour.`
				: `"${unit ?? "a piece"}" and the unit '${target}' is written in do not measure the same thing: write the ratio in the unit '${target}' is written in.`;
		case "missingDensity":
			return `'${target}' is written in a volume and the ratio in a weight (or the reverse), and its density is unknown: add it to the ingredient database, or write both in the same kind of unit.`;
		case "missingUnitWeight":
			return `'${target}' is counted in pieces and the ratio in a weight (or the reverse), and the weight of one piece is unknown: add its unit_weight to the ingredient database, or write both the same way.`;
		case "wholeUseAmbiguous":
			return `'&${target}' is used whole in several sections: write the amount used here (e.g. &${target}{500 g}).`;
		case "producerMassUnknown":
			return `'&${target}' is used whole and the mass of the section that makes it is unknown: write the amount used here (e.g. &${target}{500 g}).`;
		case "stepProducer":
			return `'&${target}' is made by a step, not by a whole section, and Gram only weighs what a section makes (## Dough ->&dough): write the amount used here (e.g. &${target}{500 g}), or make it in a section of its own.`;
	}
}

/** What each `INVALID_QUANTITY` reason tells the author to write instead. */
const QUANTITY_HINTS: Record<InvalidQuantityReason, string> = {
	percentTerm:
		"a percentage is not an amount Gram can add. Write the result, or a relative quantity such as {10% &flour} for a share of another ingredient.",
	expressionTerm:
		"a sum only adds or takes away amounts: write the result (e.g. {250 g} rather than {2 x 100 g + 50 g}).",
	unitlessTerm:
		"every term of a sum needs its unit (e.g. {1 cup + 1 tbsp}, not {1 + 1 tbsp}).",
	quantityInUnit:
		"this term's unit holds a quantity of its own: write the amount in one unit (e.g. {450 g} rather than {1 tin of 400 g + 50 g}).",
	nonPositiveTotal:
		"what is taken away is as much as what is added, or more, so the sum comes to nothing. Each kind of amount is counted on its own: in {1 cup - 2 tbsp + 30 g}, the 2 tbsp come off the cup only.",
	rangeAfterMinus:
		"a range cannot be taken away (its bounds would swap): write the range on a term that is added, or the total as a range.",
	zeroDenominator: "a fraction cannot have 0 below the bar (write e.g. 1/2).",
	zeroRatioDenominator:
		"a ratio cannot be per nothing of its target: write the amount it is per (e.g. / 100 g).",
	relativeNotSupported:
		"a share of another ingredient is not supported on a composite parent yet: write the parent's amount.",
	minusAcrossFamilies:
		"an amount is only taken away from one of its kind: a volume from a volume, a weight from a weight. Here nothing of its kind is added to take it from. {1 cup - 2 tbsp + 30 g} works (the 2 tbsp come off the cup); {1 cup - 20 g} does not.",
};

export const warningTemplates: {
	[K in WarningCode]: (payload: WarningPayloads[K]) => string;
} = {
	[WarningCode.VARIABLE_NOT_FOUND]: (p) =>
		`Cannot resolve relative quantity: target intermediate '&${p.targetName}' is not defined.`,
	[WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: (p) =>
		`Cannot resolve relative quantity: target ingredient '@${p.targetName}' was not found in the current section.`,
	[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: (p) =>
		p.reason
			? `Cannot compute the amount of '${p.item}': ${ratioHint(p.reason, p.targetName, p.unit)}`
			: `Cannot compute relative quantity for '${p.item}': mass of target '${p.targetName}' is unknown.`,
	[WarningCode.CIRCULAR_REFERENCE]: (p) =>
		`Circular reference detected: '${p.name}' depends on itself.`,
	[WarningCode.UNDEFINED_REFERENCE]: (p) =>
		`Undefined reference '${p.prefix}${p.name}' — no prior step or section produces this item.`,
	[WarningCode.MISSING_UNIT]: (p) =>
		p.type === "RetroPlanning"
			? `Retro-planning offset for "${p.item}" requires a strictly negative duration (e.g. -2h, -30min).`
			: `${p.type} requires an explicit unit (e.g. min, s, °C).`,
	[WarningCode.INVALID_UNIT]: (p) =>
		p.type === "RetroPlanning"
			? `Invalid retro-planning unit "${p.value}"${p.item ? ` on "${p.item}"` : ""} — expected d, h, or min.`
			: p.type === "Ingredient" && p.reason === "hiddenQuantity"
				? `Unit "${p.value}"${p.item ? ` of "${p.item}"` : ""} hides a quantity: a quantity starts with its number, so write it alone (e.g. {200g} rather than {about 200g}).`
				: p.type === "Ingredient"
					? `Unit "${p.value}"${p.item ? ` of "${p.item}"` : ""} reads as two quantities: write them as a sum, with " + " between them (e.g. {1 kg + 200 g} rather than {1 kg 200 g}).`
					: `Invalid unit "${p.value}" for ${p.type}.`,
	[WarningCode.DURATION_OUT_OF_RANGE]: (p) =>
		`${p.type === "RetroPlanning" ? `Retro-planning offset for "${p.item}"` : `Timer "${p.item}"`} is longer than 1000 years, the longest duration Gram plans with: it was capped at 1000 years.`,
	[WarningCode.INVALID_DURATION]: (p) =>
		p.type === "RetroPlanning"
			? `Retro-planning offset "${p.value}" on "${p.item}" is not read: ${DURATION_HINTS[p.reason] ?? p.reason} The section is not anchored.`
			: `Timer duration "${p.value}"${p.item === "Timer" ? "" : ` on "${p.item}"`} is not read: ${DURATION_HINTS[p.reason] ?? p.reason} It is not counted in the total time.`,
	[WarningCode.INVALID_QUANTITY]: (p) =>
		p.reason === "zeroRatioDenominator"
			? `${p.type === "Timer" ? (p.item === "Timer" ? "A timer" : `Timer "${p.item}"`) : `"${p.item}"`} is per "${p.value}": ${QUANTITY_HINTS.zeroRatioDenominator} ${p.type === "Timer" ? "It is not counted in the total time." : "It is left out, as if no amount had been written."}`
			: p.reason === "zeroDenominator"
				? `Number "${p.value}" of "${p.item}" is not read: ${QUANTITY_HINTS.zeroDenominator} It is left out, as if no number had been written.`
				: p.reason === "relativeNotSupported"
					? `Quantity "${p.value}" of "${p.item}" is not read: ${QUANTITY_HINTS.relativeNotSupported} The parent is read with no quantity.`
					: `Quantity "${p.value}" of "${p.item}" is not read: ${QUANTITY_HINTS[p.reason] ?? p.reason}${p.suggestion ? ` Did you mean {${p.suggestion}}?` : ""} It is not counted in the shopping list or the nutrition.`,
	[WarningCode.OZ_AFTER_VOLUME]: (p) =>
		`"${p.value}" of "${p.item}" is a weight: oz weighs, ${p.suggestion} measures a volume. Write ${p.suggestion} if a volume is meant.`,
	[WarningCode.SPACED_COMPOSITE]: (p) =>
		`"${p.item}" and "${p.parent}" are read as two separate ingredients: a composite takes "<" with no space around it. Write ${p.suggestion} right after "${p.item}" if "${p.item}" comes from "${p.parent}"; as written, both are counted in the shopping list.`,
	[WarningCode.AMBIGUOUS_NUMBER]: (p) =>
		`"${p.value}" on "${p.item}" was read as ${p.read}: Gram reads a comma between two digits as a decimal and has no thousands separator. Write ${p.suggestion} if that is the number you meant.`,
	[WarningCode.SCOPE_CONFLICT]: (p) =>
		`Intermediate variable '&${p.varName}' is redefined; variable names must be unique across the recipe.`,
	[WarningCode.MISSING_INGREDIENT]: (p) =>
		`Ingredient "${p.id}" not found in database — nutritional metrics and density conversions unavailable.`,
	[WarningCode.MISSING_MACROS]: (p) =>
		`Ingredient "${p.id}" has no macronutrient data in database — nutritional totals are partial.`,
	[WarningCode.UNKNOWN_MASS]: (p) =>
		`Cannot calculate mass for "${p.id}" — omitted from nutritional totals.`,
	[WarningCode.INVALID_MODIFIER_COMBINATION]: (p) =>
		`Incompatible modifiers on "${p.item}": ${p.combination}.`,
	[WarningCode.COMPOSITE_PARENT_CONFLICT]: (p) =>
		`Composite child "${p.childName}" was already linked to parent "${p.previousParent}" — using it with a different parent "${p.newParent}" here means both will share the same database entry, which is very likely wrong.`,
	// These two are pushed directly (by @gram-lang/analyzer) as ready-made
	// Warning objects rather than through pushWarning(), so their templates are
	// never actually invoked — they exist only to keep WarningPayloads exhaustive.
	[WarningCode.INVALID_BAKERS_REFERENCE]: (p) =>
		`'${p.item}' cannot be used as the Baker's percentage reference (*).`,
	[WarningCode.NO_BAKERS_REFERENCE]: () =>
		`Baker's percentages (%) are used but no base flour (*) was designated.`,
	[WarningCode.MULTIPLE_BAKERS_PERCENTAGE]: (p) =>
		`'${p.item}' is also marked as the baker's percentage base (*), but '${p.reference}' already is: only one ingredient can be. '${p.reference}' stays the base.`,
	[WarningCode.TIME_PARADOX]: (p) =>
		`Timeline conflict: ${p.cause} is pulled earlier than recipe start to satisfy ${p.conflict}.`,
	[WarningCode.TRACK_CONTENTION]: (p) =>
		`Resource contention on track '${p.trackName}': delayed by ${p.delay} min for '${p.item}'.`,
	[WarningCode.DAY_OVERFLOW]: (p) =>
		`Working day ${p.day} (from section '${p.section || "unnamed"}') starts ${formatMinutes(p.overflowMinutes)} before its 24 h window opens: a long rest pushes it back. Anchor the section further back, for example ~{-${p.day + 1}d}, or shorten the rest.`,
	[WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE]: (p) =>
		`Two passive timers overlap and both use #${p.cookware}: ${p.item} and ${p.other}. If one is meant to follow the other, give them the same named track, for example ~_${p.cookware}{…}, so they take turns.`,
	[WarningCode.MODULE_NOT_FOUND]: (p) =>
		`Module "${p.specifier}" could not be found or resolved.`,
};

/**
 * A single structured compiler/analyzer warning. This is the only shape that
 * ever flows through `Context.warnings` / `Registry.warnings` /
 * `CompilationResult.warnings` — never a bare string. Consumers (CLI, language
 * server, renderer) can rely on `.message` always being present.
 */
export interface Warning {
	// Not narrowed to `WarningCode`: `@gram-lang/modules` pushes its own
	// `ModuleWarningCode` values (`packages/modules/src/warnings.ts`) onto
	// this same array via `pushRawWarning`, so any consumer reading `.code`
	// off a `Warning` that may have flowed through a module-composed
	// compile needs to handle codes outside kitchen's own enum.
	code: string;
	message: string;
	item?: string;
	loc?: Location;
	section?: string | null;
	// Which module the warning originates from, when the compiled document is
	// a composition of several `.gram` files. Absent for a plain single-file
	// compile — mirrors `Location.uri`, from which `pushWarning` copies it.
	uri?: string;
	/**
	 * What a tool needs to act on the warning (a Quick Fix): the reason and
	 * the suggestion of an `INVALID_QUANTITY`, say. Only set for the codes
	 * listed in `warningData`. Since 1.5.0.
	 */
	data?: Record<string, unknown>;
}

/**
 * The part of a payload a warning carries along as `data`, by code. A code
 * not listed carries none: its compiled JSON stays as it was.
 */
const warningData: {
	[K in WarningCode]?: (
		payload: WarningPayloads[K],
	) => Record<string, unknown> | undefined;
} = {
	[WarningCode.INVALID_QUANTITY]: (p) =>
		p.suggestion !== undefined
			? { reason: p.reason, suggestion: p.suggestion }
			: { reason: p.reason },
	[WarningCode.OZ_AFTER_VOLUME]: (p) => ({ suggestion: p.suggestion }),
	[WarningCode.SPACED_COMPOSITE]: (p) => ({ suggestion: p.suggestion }),
	[WarningCode.INVALID_UNIT]: (p) => {
		if (p.type !== "Ingredient" || !p.reason) return undefined;
		const parts =
			p.reason === "twoQuantities" ? splitTwoQuantities(p.value) : null;
		return parts
			? { reason: p.reason, suggestion: parts.join(" + ") }
			: { reason: p.reason };
	},
};

export type WarningSeverity = "error" | "warning" | "info";

/**
 * Single source of truth for how each WarningCode should be treated by
 * consumers (`gram check`, the language server, `--strict`). Structural
 * integrity issues (a reference to something that doesn't exist, a naming
 * collision) are `error`; everything else — nutritional/estimation gaps,
 * incomplete-but-recoverable annotations — is `warning`, so a missing timer
 * unit doesn't fail a build the same way an undefined reference does.
 * Pure contextual notifications/non-fault notices are `info`.
 * `--strict` promotes every `warning` and `info` to `error`.
 */
export const warningSeverity: Record<WarningCode, WarningSeverity> = {
	[WarningCode.VARIABLE_NOT_FOUND]: "warning",
	[WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: "warning",
	[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: "warning",
	[WarningCode.CIRCULAR_REFERENCE]: "error",
	[WarningCode.UNDEFINED_REFERENCE]: "error",
	[WarningCode.MISSING_UNIT]: "warning",
	[WarningCode.INVALID_UNIT]: "warning",
	[WarningCode.DURATION_OUT_OF_RANGE]: "warning",
	[WarningCode.AMBIGUOUS_NUMBER]: "warning",
	[WarningCode.INVALID_DURATION]: "warning",
	[WarningCode.INVALID_QUANTITY]: "warning",
	[WarningCode.OZ_AFTER_VOLUME]: "info",
	[WarningCode.SPACED_COMPOSITE]: "warning",
	[WarningCode.SCOPE_CONFLICT]: "error",
	[WarningCode.MISSING_INGREDIENT]: "warning",
	[WarningCode.MISSING_MACROS]: "info",
	[WarningCode.UNKNOWN_MASS]: "info",
	[WarningCode.INVALID_MODIFIER_COMBINATION]: "warning",
	[WarningCode.COMPOSITE_PARENT_CONFLICT]: "error",
	[WarningCode.INVALID_BAKERS_REFERENCE]: "warning",
	[WarningCode.NO_BAKERS_REFERENCE]: "warning",
	[WarningCode.MULTIPLE_BAKERS_PERCENTAGE]: "warning",
	[WarningCode.TIME_PARADOX]: "warning",
	[WarningCode.TRACK_CONTENTION]: "info",
	[WarningCode.DAY_OVERFLOW]: "warning",
	[WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE]: "info",
	[WarningCode.MODULE_NOT_FOUND]: "error",
};

// The common shape `pushRawWarning` needs from a payload, independent of
// which code-space (kitchen's own `WarningCode` or e.g. `@gram-lang/modules`'
// `ModuleWarningCode`) it belongs to.
export type WarningPayloadShape = {
	item?: string;
	loc?: Location;
	section?: string | null;
};

/**
 * Code-space-agnostic primitive: builds a `Warning` from an already-rendered
 * `message` and pushes it. `pushWarning` below is the strongly-typed
 * kitchen-own-`WarningCode` wrapper around this; other packages that define
 * their own warning codes (e.g. `@gram-lang/modules`' `ModuleWarningCode`)
 * render their own template and call this directly instead of going through
 * `pushWarning`, which is constrained to `WarningCode`.
 */
export function pushRawWarning<TPayload extends object>(
	target: Warning[] | { warnings: Warning[] },
	code: string,
	message: string,
	payload: TPayload,
	data?: Record<string, unknown>,
): void {
	const warnings = Array.isArray(target) ? target : target.warnings;
	// Cast rather than constraining the generic to `WarningPayloadShape`
	// directly: most payloads (e.g. `{ id: string }`) share none of its
	// (all-optional) properties, which TS's weak-type check would reject.
	const shape = payload as WarningPayloadShape;

	const warning: Warning = { code, message };
	if ("item" in shape) warning.item = shape.item;
	if ("loc" in shape) warning.loc = shape.loc;
	if ("section" in shape) warning.section = shape.section;
	if ("loc" in shape && shape.loc?.uri) warning.uri = shape.loc.uri;
	if (data) warning.data = data;
	warnings.push(warning);
}

export function pushWarning<K extends WarningCode>(
	target: Warning[] | { warnings: Warning[] },
	code: K,
	payload: WarningPayloads[K],
): void {
	pushRawWarning(
		target,
		code,
		warningTemplates[code](payload),
		payload,
		warningData[code]?.(payload),
	);
}

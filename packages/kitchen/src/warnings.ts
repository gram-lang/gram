import type { Location } from "@gram-lang/parser";

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
	// Produced by @gram-lang/analyzer (not kitchen itself), but part of the same
	// shared warning vocabulary that flows through CompilationResult.warnings.
	INVALID_BAKERS_REFERENCE = "INVALID_BAKERS_REFERENCE",
	NO_BAKERS_REFERENCE = "NO_BAKERS_REFERENCE",
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
		type: "Timer" | "Temperature" | "RetroPlanning";
		value: string;
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
	[WarningCode.INVALID_BAKERS_REFERENCE]: { item: string };
	[WarningCode.NO_BAKERS_REFERENCE]: Record<string, never>;
}

export const warningTemplates: {
	[K in WarningCode]: (payload: WarningPayloads[K]) => string;
} = {
	[WarningCode.VARIABLE_NOT_FOUND]: (p) =>
		`Variable '&${p.targetName}' not found.`,
	[WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: (p) =>
		`Could not resolve relative quantity for '@${p.targetName}'. Source not found in current section.`,
	[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: (p) =>
		`Cannot compute relative quantity for '${p.item}' because the mass of target '${p.targetName}' is unknown.`,
	[WarningCode.CIRCULAR_REFERENCE]: (p) =>
		`Circular reference detected: ${p.name} depends on itself.`,
	[WarningCode.UNDEFINED_REFERENCE]: (p) =>
		`Reference to undefined ingredient '${p.prefix}${p.name}'.`,
	[WarningCode.MISSING_UNIT]: (p) =>
		p.type === "RetroPlanning"
			? `Retro-planning for section "${p.item}" must be a strictly negative duration with an explicit unit (e.g. -2h, -1d, -30min).`
			: `${p.type} must have an explicit unit.`,
	[WarningCode.INVALID_UNIT]: (p) =>
		p.type === "RetroPlanning"
			? `Invalid retro-planning unit "${p.value}" — expected d, h, or min.`
			: `Invalid unit "${p.value}" for ${p.type}.`,
	[WarningCode.SCOPE_CONFLICT]: (p) =>
		`Global variable '&${p.varName}' is redefined.`,
	[WarningCode.MISSING_INGREDIENT]: (p) => `"${p.id}" not found in database.`,
	[WarningCode.MISSING_MACROS]: (p) =>
		`Ingredient "${p.id}" has no default macro data.`,
	[WarningCode.UNKNOWN_MASS]: (p) =>
		`Cannot calculate mass for "${p.id}" to estimate nutrition.`,
	[WarningCode.INVALID_MODIFIER_COMBINATION]: (p) =>
		`Invalid modifier combination on "${p.item}": ${p.combination}`,
	// These two are pushed directly (by @gram-lang/analyzer) as ready-made
	// Warning objects rather than through pushWarning(), so their templates are
	// never actually invoked — they exist only to keep WarningPayloads exhaustive.
	[WarningCode.INVALID_BAKERS_REFERENCE]: (p) =>
		`Cannot use '${p.item}' as the Baker's Percentage reference.`,
	[WarningCode.NO_BAKERS_REFERENCE]: () =>
		`No Baker's Percentage reference found.`,
};

/**
 * A single structured compiler/analyzer warning. This is the only shape that
 * ever flows through `Context.warnings` / `Registry.warnings` /
 * `CompilationResult.warnings` — never a bare string. Consumers (CLI, language
 * server, renderer) can rely on `.message` always being present.
 */
export interface Warning {
	code: WarningCode;
	message: string;
	item?: string;
	loc?: Location;
	section?: string | null;
}

export type WarningSeverity = "error" | "warning" | "info";

/**
 * Single source of truth for how each WarningCode should be treated by
 * consumers (`gram check`, the language server, `--strict`). Structural
 * integrity issues (a reference to something that doesn't exist, a naming
 * collision) are `error`; everything else — nutritional/estimation gaps,
 * incomplete-but-recoverable annotations — is `warning`, so a missing timer
 * unit doesn't fail a build the same way an undefined reference does.
 * `--strict` promotes every `warning` to `error`.
 */
export const warningSeverity: Record<WarningCode, WarningSeverity> = {
	[WarningCode.VARIABLE_NOT_FOUND]: "warning",
	[WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: "warning",
	[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: "warning",
	[WarningCode.CIRCULAR_REFERENCE]: "error",
	[WarningCode.UNDEFINED_REFERENCE]: "error",
	[WarningCode.MISSING_UNIT]: "warning",
	[WarningCode.INVALID_UNIT]: "warning",
	[WarningCode.SCOPE_CONFLICT]: "error",
	[WarningCode.MISSING_INGREDIENT]: "warning",
	[WarningCode.MISSING_MACROS]: "warning",
	[WarningCode.UNKNOWN_MASS]: "warning",
	[WarningCode.INVALID_MODIFIER_COMBINATION]: "warning",
	[WarningCode.INVALID_BAKERS_REFERENCE]: "warning",
	[WarningCode.NO_BAKERS_REFERENCE]: "warning",
};

export function pushWarning<K extends WarningCode>(
	target: Warning[] | { warnings: Warning[] },
	code: K,
	payload: WarningPayloads[K],
): void {
	const message = warningTemplates[code](payload);
	const warnings = Array.isArray(target) ? target : target.warnings;

	const warning: Warning = { code, message };
	if ("item" in payload) warning.item = payload.item;
	if ("loc" in payload) warning.loc = payload.loc;
	if ("section" in payload) warning.section = payload.section;
	warnings.push(warning);
}

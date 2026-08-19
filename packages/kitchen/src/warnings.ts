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
	TIME_PARADOX = "TIME_PARADOX",
	TRACK_CONTENTION = "TRACK_CONTENTION",
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
	[WarningCode.MODULE_NOT_FOUND]: {
		specifier: string;
		loc?: Location;
	};
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
	[WarningCode.TIME_PARADOX]: (p) =>
		`TIME_PARADOX: ${p.cause} is pulled backwards to satisfy ${p.conflict}.`,
	[WarningCode.TRACK_CONTENTION]: (p) =>
		`TRACK_CONTENTION: Named track '${p.trackName}' experienced a serialization delay of ${p.delay} minutes on '${p.item}'. It will finish later than its scheduled deadline.`,
	[WarningCode.MODULE_NOT_FOUND]: (p) =>
		`Module "${p.specifier}" could not be found or read.`,
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
	[WarningCode.TIME_PARADOX]: "warning",
	[WarningCode.TRACK_CONTENTION]: "warning",
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
	warnings.push(warning);
}

export function pushWarning<K extends WarningCode>(
	target: Warning[] | { warnings: Warning[] },
	code: K,
	payload: WarningPayloads[K],
): void {
	pushRawWarning(target, code, warningTemplates[code](payload), payload);
}

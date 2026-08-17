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
	// Phase E). Produced either by kitchen itself (MODULE_NOT_FOUND, in the
	// no-resolution-happened degraded path, §C.4) or by `@gram-lang/modules`
	// pushing onto the same shared `Warning` vocabulary during graph loading
	// and composition.
	MODULE_NOT_FOUND = "MODULE_NOT_FOUND",
	MODULE_PARSE_ERROR = "MODULE_PARSE_ERROR",
	MODULE_CYCLE = "MODULE_CYCLE",
	MODULE_DEPTH_EXCEEDED = "MODULE_DEPTH_EXCEEDED",
	MODULE_EXPORT_NOT_FOUND = "MODULE_EXPORT_NOT_FOUND",
	UNUSED_IMPORT = "UNUSED_IMPORT",
	UNRESOLVED_MODULE_YIELD = "UNRESOLVED_MODULE_YIELD",
	ESTIMATED_MODULE_YIELD = "ESTIMATED_MODULE_YIELD",
	MODULE_UNIT_MISMATCH = "MODULE_UNIT_MISMATCH",
	MODULE_BATCH_INTERPRETATION = "MODULE_BATCH_INTERPRETATION",
	IMPORTED_BAKERS_REFERENCE_DROPPED = "IMPORTED_BAKERS_REFERENCE_DROPPED",
	DENSITY_OVERRIDE_SHADOWED = "DENSITY_OVERRIDE_SHADOWED",
	MODULE_SURPLUS = "MODULE_SURPLUS",
	MODULE_SPECIFIER_INVALID = "MODULE_SPECIFIER_INVALID",
	MODULE_SCHEME_UNSUPPORTED = "MODULE_SCHEME_UNSUPPORTED",
	PREPARED_MULTI_EXPORT = "PREPARED_MULTI_EXPORT",
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
	[WarningCode.MODULE_PARSE_ERROR]: {
		specifier: string;
		parseMessage: string;
		loc?: Location;
	};
	[WarningCode.MODULE_CYCLE]: {
		chain: string;
		loc?: Location;
	};
	[WarningCode.MODULE_DEPTH_EXCEEDED]: {
		specifier: string;
		depth: number;
		loc?: Location;
	};
	[WarningCode.MODULE_EXPORT_NOT_FOUND]: {
		specifier: string;
		exported: string;
		available: string[];
		suggestion?: string;
		loc?: Location;
	};
	[WarningCode.UNUSED_IMPORT]: {
		local: string;
		specifier: string;
		loc?: Location;
	};
	[WarningCode.UNRESOLVED_MODULE_YIELD]: {
		specifier: string;
		binding: string;
		loc?: Location;
	};
	[WarningCode.ESTIMATED_MODULE_YIELD]: {
		specifier: string;
		binding: string;
		loc?: Location;
	};
	[WarningCode.MODULE_UNIT_MISMATCH]: {
		specifier: string;
		binding: string;
		requestedUnit: string;
		yieldUnit: string;
		loc?: Location;
	};
	[WarningCode.MODULE_BATCH_INTERPRETATION]: {
		specifier: string;
		binding: string;
		batches: number;
		loc?: Location;
	};
	[WarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: {
		specifier: string;
		loc?: Location;
	};
	[WarningCode.DENSITY_OVERRIDE_SHADOWED]: {
		ingredient: string;
		specifier: string;
		hostValue: number;
		moduleValue: number;
		loc?: Location;
	};
	[WarningCode.MODULE_SURPLUS]: {
		specifier: string;
		binding: string;
		surplus: string;
		loc?: Location;
	};
	[WarningCode.MODULE_SPECIFIER_INVALID]: {
		specifier: string;
		reason: string;
		loc?: Location;
	};
	[WarningCode.MODULE_SCHEME_UNSUPPORTED]: {
		specifier: string;
		loc?: Location;
	};
	[WarningCode.PREPARED_MULTI_EXPORT]: {
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
	[WarningCode.MODULE_PARSE_ERROR]: (p) =>
		`Module "${p.specifier}" has a syntax error: ${p.parseMessage}`,
	[WarningCode.MODULE_CYCLE]: (p) => `Import cycle detected: ${p.chain}.`,
	[WarningCode.MODULE_DEPTH_EXCEEDED]: (p) =>
		`Import chain to "${p.specifier}" exceeds the maximum depth of ${p.depth}.`,
	[WarningCode.MODULE_EXPORT_NOT_FOUND]: (p) => {
		const suggestion = p.suggestion ? ` Did you mean '&${p.suggestion}'?` : "";
		// `Array.isArray` guard (rather than `p.available.length`/`.map` used
		// directly): the docs site renders every template's message shape
		// through a placeholder proxy that stands in for the whole payload
		// (packages/docs/src/data/api-reference.ts), so `p.available` there is
		// a string, not an array.
		const available = Array.isArray(p.available)
			? p.available.length
				? ` Available exports: ${p.available.map((n) => `&${n}`).join(", ")}.`
				: " This module has no section-level exports."
			: "";
		return `"${p.specifier}" does not export '&${p.exported}'.${suggestion}${available}`;
	},
	[WarningCode.UNUSED_IMPORT]: (p) =>
		`Import '&${p.local}' from "${p.specifier}" is never used.`,
	[WarningCode.UNRESOLVED_MODULE_YIELD]: (p) =>
		`Cannot determine the yield of '&${p.binding}' from "${p.specifier}" — declare a "yields:" key in that module. Imported at 1x.`,
	[WarningCode.ESTIMATED_MODULE_YIELD]: (p) =>
		`The yield of '&${p.binding}' from "${p.specifier}" is estimated (derived from a density or default unit weight), not declared. Declare "yields:" in that module for a precise scale factor.`,
	[WarningCode.MODULE_UNIT_MISMATCH]: (p) =>
		`'&${p.binding}' from "${p.specifier}" was requested in ${p.requestedUnit}, but that module yields in ${p.yieldUnit}, and no density lets one convert to the other. Declare "yields:" in the requested unit, or "densities:" to bridge them.`,
	[WarningCode.MODULE_BATCH_INTERPRETATION]: (p) =>
		`'&${p.binding}' from "${p.specifier}" was requested as a bare count against a mass/volume yield — interpreted as ${p.batches} batch(es) of the module. Note: quantities are multiplied by ${p.batches}, not cook/rest times.`,
	[WarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: (p) =>
		`The baker's percentage reference (*) from "${p.specifier}" was dropped on import — baker's math doesn't carry across module boundaries.`,
	[WarningCode.DENSITY_OVERRIDE_SHADOWED]: (p) =>
		`Density for "${p.ingredient}" declared in "${p.specifier}" (${p.moduleValue}) differs from the host's (${p.hostValue}) — the host's value wins.`,
	[WarningCode.MODULE_SURPLUS]: (p) =>
		`Scaling "${p.specifier}" to satisfy '&${p.binding}' produces more than requested: ${p.surplus}.`,
	[WarningCode.MODULE_SPECIFIER_INVALID]: (p) =>
		`Invalid module specifier "${p.specifier}": ${p.reason}`,
	[WarningCode.MODULE_SCHEME_UNSUPPORTED]: (p) =>
		`Unsupported module specifier scheme: "${p.specifier}".`,
	[WarningCode.PREPARED_MULTI_EXPORT]: (p) =>
		`"${p.specifier}" is imported with "prepared" but destructures more than one binding — a prepared module can only bind a single intermediate. Remove "prepared" or split into separate imports.`,
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
	[WarningCode.MODULE_PARSE_ERROR]: "error",
	[WarningCode.MODULE_CYCLE]: "error",
	[WarningCode.MODULE_DEPTH_EXCEEDED]: "error",
	[WarningCode.MODULE_EXPORT_NOT_FOUND]: "error",
	[WarningCode.UNUSED_IMPORT]: "warning",
	[WarningCode.UNRESOLVED_MODULE_YIELD]: "error",
	[WarningCode.ESTIMATED_MODULE_YIELD]: "warning",
	[WarningCode.MODULE_UNIT_MISMATCH]: "error",
	[WarningCode.MODULE_BATCH_INTERPRETATION]: "info",
	[WarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: "info",
	[WarningCode.DENSITY_OVERRIDE_SHADOWED]: "info",
	[WarningCode.MODULE_SURPLUS]: "info",
	[WarningCode.MODULE_SPECIFIER_INVALID]: "error",
	[WarningCode.MODULE_SCHEME_UNSUPPORTED]: "error",
	[WarningCode.PREPARED_MULTI_EXPORT]: "error",
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
	if ("loc" in payload && payload.loc?.uri) warning.uri = payload.loc.uri;
	warnings.push(warning);
}

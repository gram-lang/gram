import type { Location } from "@gram-lang/parser";
import {
	pushRawWarning,
	warningSeverity,
	warningTemplates,
	WarningCode,
	type Warning,
	type WarningSeverity,
} from "@gram-lang/kitchen";

// Module-only diagnostic vocabulary (module-imports RFC,
// .notes/plan-ajout-imports-recettes.md Phase E, and the stock/retro-planning
// redesign). `MODULE_NOT_FOUND` stays on kitchen's own `WarningCode` — it's
// the one module-related code kitchen itself raises, in its
// no-resolution-happened degraded path (`packages/kitchen/src/processor.ts`).
// Everything else here is pushed exclusively by this package, onto the same
// shared `Warning` array kitchen's own codes flow through.
export enum ModuleWarningCode {
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
	// "stock" mechanism (module-imports RFC, stock/retro-planning redesign).
	STOCKED_RETRO_PLANNING_IGNORED = "STOCKED_RETRO_PLANNING_IGNORED",
	RETRO_PLANNING_OVERRIDE_SHADOWED = "RETRO_PLANNING_OVERRIDE_SHADOWED",
	MODULE_BINDING_SHADOWS_INGREDIENT = "MODULE_BINDING_SHADOWS_INGREDIENT",
	STOCKED_DESTRUCTURED_NUTRITION_BLENDED = "STOCKED_DESTRUCTURED_NUTRITION_BLENDED",
}

export interface ModuleWarningPayloads {
	[ModuleWarningCode.MODULE_PARSE_ERROR]: {
		specifier: string;
		parseMessage: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_CYCLE]: {
		chain: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_DEPTH_EXCEEDED]: {
		specifier: string;
		depth: number;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_EXPORT_NOT_FOUND]: {
		specifier: string;
		exported: string;
		available: string[];
		suggestion?: string;
		loc?: Location;
	};
	[ModuleWarningCode.UNUSED_IMPORT]: {
		local: string;
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.UNRESOLVED_MODULE_YIELD]: {
		specifier: string;
		binding: string;
		loc?: Location;
	};
	[ModuleWarningCode.ESTIMATED_MODULE_YIELD]: {
		specifier: string;
		binding: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_UNIT_MISMATCH]: {
		specifier: string;
		binding: string;
		requestedUnit: string;
		yieldUnit: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_BATCH_INTERPRETATION]: {
		specifier: string;
		binding: string;
		batches: number;
		loc?: Location;
	};
	[ModuleWarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: {
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.DENSITY_OVERRIDE_SHADOWED]: {
		ingredient: string;
		specifier: string;
		hostValue: number;
		moduleValue: number;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_SURPLUS]: {
		specifier: string;
		binding: string;
		surplus: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_SPECIFIER_INVALID]: {
		specifier: string;
		reason: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_SCHEME_UNSUPPORTED]: {
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.STOCKED_RETRO_PLANNING_IGNORED]: {
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.RETRO_PLANNING_OVERRIDE_SHADOWED]: {
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.MODULE_BINDING_SHADOWS_INGREDIENT]: {
		binding: string;
		specifier: string;
		loc?: Location;
	};
	[ModuleWarningCode.STOCKED_DESTRUCTURED_NUTRITION_BLENDED]: {
		specifier: string;
		loc?: Location;
	};
}

export const moduleWarningTemplates: {
	[K in ModuleWarningCode]: (payload: ModuleWarningPayloads[K]) => string;
} = {
	[ModuleWarningCode.MODULE_PARSE_ERROR]: (p) =>
		`Syntax error in imported module "${p.specifier}": ${p.parseMessage}`,
	[ModuleWarningCode.MODULE_CYCLE]: (p) =>
		`Circular module import detected: ${p.chain}.`,
	[ModuleWarningCode.MODULE_DEPTH_EXCEEDED]: (p) =>
		`Import depth limit exceeded (${p.depth}) while importing "${p.specifier}".`,
	[ModuleWarningCode.MODULE_EXPORT_NOT_FOUND]: (p) => {
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
		return `Module "${p.specifier}" does not export '&${p.exported}'.${suggestion}${available}`;
	},
	[ModuleWarningCode.UNUSED_IMPORT]: (p) =>
		`Unused import '&${p.local}' from "${p.specifier}".`,
	[ModuleWarningCode.UNRESOLVED_MODULE_YIELD]: (p) =>
		`Cannot compute yield for '&${p.binding}' from "${p.specifier}": missing physical mass data for one or more ingredients.`,
	[ModuleWarningCode.ESTIMATED_MODULE_YIELD]: (p) =>
		`Yield of '&${p.binding}' from "${p.specifier}" is estimated using standard ingredient densities or unit weights. Scale factor is approximate.`,
	[ModuleWarningCode.MODULE_UNIT_MISMATCH]: (p) =>
		`Unit mismatch for '&${p.binding}' from "${p.specifier}": requested in '${p.requestedUnit}' but yields in '${p.yieldUnit}' without a conversion density.`,
	[ModuleWarningCode.MODULE_BATCH_INTERPRETATION]: (p) =>
		`'&${p.binding}' from "${p.specifier}" requested without unit — scaled as ${p.batches} batch(es) of the module.`,
	[ModuleWarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: (p) =>
		`Baker's percentage base (*) from "${p.specifier}" is scoped to its own module and was not imported.`,
	[ModuleWarningCode.DENSITY_OVERRIDE_SHADOWED]: (p) =>
		`Density for "${p.ingredient}" in host recipe (${p.hostValue}) overrides module "${p.specifier}" (${p.moduleValue}).`,
	[ModuleWarningCode.MODULE_SURPLUS]: (p) =>
		`Scaling "${p.specifier}" for '&${p.binding}' yields a surplus: ${p.surplus}.`,
	[ModuleWarningCode.MODULE_SPECIFIER_INVALID]: (p) =>
		`Invalid module path "${p.specifier}": ${p.reason}`,
	[ModuleWarningCode.MODULE_SCHEME_UNSUPPORTED]: (p) =>
		`Unsupported URL scheme in module specifier: "${p.specifier}".`,
	[ModuleWarningCode.STOCKED_RETRO_PLANNING_IGNORED]: (p) =>
		`Stocked module "${p.specifier}" has a retro-planning offset "~{...}", which is ignored because stocked items require no prep time.`,
	[ModuleWarningCode.RETRO_PLANNING_OVERRIDE_SHADOWED]: (p) =>
		`Host retro-planning offset on "@use ${p.specifier}" overrides the module's internal offset.`,
	[ModuleWarningCode.MODULE_BINDING_SHADOWS_INGREDIENT]: (p) =>
		`Imported binding '&${p.binding}' from "${p.specifier}" shares name with a database ingredient.`,
	[ModuleWarningCode.STOCKED_DESTRUCTURED_NUTRITION_BLENDED]: (p) =>
		`Stocked module "${p.specifier}" uses destructured imports — nutrition profile is averaged across the entire module.`,
};

/**
 * Mirrors kitchen's own `warningSeverity` (`packages/kitchen/src/warnings.ts`)
 * for this package's code-space: how each `ModuleWarningCode` should be
 * treated by consumers (`gram check`, the language server, `--strict`).
 */
export const moduleWarningSeverity: Record<ModuleWarningCode, WarningSeverity> =
	{
		[ModuleWarningCode.MODULE_PARSE_ERROR]: "error",
		[ModuleWarningCode.MODULE_CYCLE]: "error",
		[ModuleWarningCode.MODULE_DEPTH_EXCEEDED]: "error",
		[ModuleWarningCode.MODULE_EXPORT_NOT_FOUND]: "error",
		[ModuleWarningCode.UNUSED_IMPORT]: "warning",
		[ModuleWarningCode.UNRESOLVED_MODULE_YIELD]: "error",
		[ModuleWarningCode.ESTIMATED_MODULE_YIELD]: "warning",
		[ModuleWarningCode.MODULE_UNIT_MISMATCH]: "error",
		[ModuleWarningCode.MODULE_BATCH_INTERPRETATION]: "info",
		[ModuleWarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED]: "info",
		[ModuleWarningCode.DENSITY_OVERRIDE_SHADOWED]: "info",
		[ModuleWarningCode.MODULE_SURPLUS]: "info",
		[ModuleWarningCode.MODULE_SPECIFIER_INVALID]: "error",
		[ModuleWarningCode.MODULE_SCHEME_UNSUPPORTED]: "error",
		[ModuleWarningCode.STOCKED_RETRO_PLANNING_IGNORED]: "warning",
		[ModuleWarningCode.RETRO_PLANNING_OVERRIDE_SHADOWED]: "info",
		[ModuleWarningCode.MODULE_BINDING_SHADOWS_INGREDIENT]: "warning",
		[ModuleWarningCode.STOCKED_DESTRUCTURED_NUTRITION_BLENDED]: "info",
	};

/**
 * `ModuleWarningCode` counterpart to kitchen's `pushWarning` — renders this
 * package's own template and pushes through kitchen's code-space-agnostic
 * `pushRawWarning` primitive.
 */
export function pushModuleWarning<K extends ModuleWarningCode>(
	target: Warning[] | { warnings: Warning[] },
	code: K,
	payload: ModuleWarningPayloads[K],
): void {
	pushRawWarning(target, code, moduleWarningTemplates[code](payload), payload);
}

/**
 * Looks up a `Warning.code`'s severity across both code-spaces that can flow
 * through a module-composed compile: kitchen's own `WarningCode` and this
 * package's `ModuleWarningCode`. The one place consumers (`gram check`, the
 * language server, `--strict`) that read `warnings` off a possibly-composed
 * `CompilationResult` need to go, instead of indexing kitchen's
 * `warningSeverity` directly — which only covers kitchen's own codes.
 * Falls back to "warning" for a code from neither map, which should never
 * happen in practice since every `Warning` is built by `pushWarning` or
 * `pushModuleWarning`.
 */
export function warningSeverityOf(code: string): WarningSeverity {
	return (
		(warningSeverity as Record<string, WarningSeverity>)[code] ??
		(moduleWarningSeverity as Record<string, WarningSeverity>)[code] ??
		"warning"
	);
}

/**
 * Every warning code across both code-spaces, with its severity and message
 * template — the single source the docs API-reference table
 * (`packages/docs/src/data/api-reference.ts`) needs, since it must show both
 * kitchen's own codes and `@gram-lang/modules`' module-only ones together.
 */
export const allWarningInfo: {
	code: string;
	severity: WarningSeverity;
	template: (payload: never) => string;
}[] = [
	...Object.values(WarningCode).map((code) => ({
		code,
		severity: warningSeverity[code],
		template: warningTemplates[code] as (payload: never) => string,
	})),
	...Object.values(ModuleWarningCode).map((code) => ({
		code,
		severity: moduleWarningSeverity[code],
		template: moduleWarningTemplates[code] as (payload: never) => string,
	})),
];

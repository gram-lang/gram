import type { Warning, WarningSeverity } from "@gram-lang/kitchen";
import { warningSeverityOf } from "@gram-lang/modules";

export interface PlaygroundDiagnostic extends Warning {
	severity: WarningSeverity;
	source: "parser" | "scale" | "analyzer" | "modules" | "kitchen";
	blocking: boolean;
}

/**
 * Normalizes an entry parse error diagnostic from loadModuleGraph / modules.
 */
export function parseErrorToDiagnostic(
	w: Warning,
	uri: string,
): PlaygroundDiagnostic {
	return {
		code: w.code || "PARSE_ERROR",
		message: w.message,
		loc: w.loc,
		uri: w.uri || uri,
		item: w.item,
		section: w.section,
		severity: "error",
		source: "parser",
		blocking: true,
	};
}

/**
 * Creates a diagnostic for a scale error.
 * Note: scale errors are severity "error" but non-blocking (the user can still view the recipe).
 */
export function scaleErrorToDiagnostic(
	message: string,
	uri?: string,
): PlaygroundDiagnostic {
	return {
		code: "SCALE_ERROR",
		message,
		severity: "error",
		source: "scale",
		blocking: false,
		uri,
	};
}

/**
 * Creates a diagnostic for an uncaught pipeline execution error (compile/analyze/render crash).
 */
export function pipelineErrorToDiagnostic(
	error: unknown,
	stage: "compose" | "compile" | "analyze" | "render",
	uri?: string,
): PlaygroundDiagnostic {
	const message = error instanceof Error ? error.message : String(error);
	return {
		code: `${stage.toUpperCase()}_ERROR`,
		message,
		severity: "error",
		source:
			stage === "compose"
				? "modules"
				: stage === "compile"
					? "kitchen"
					: stage === "analyze"
						? "analyzer"
						: "kitchen",
		blocking: true,
		uri,
	};
}

/**
 * Enriches a standard Warning from kitchen/analyzer/modules into a PlaygroundDiagnostic.
 */
export function enrichWarning(
	w: Warning,
	defaultUri?: string,
): PlaygroundDiagnostic {
	const severity = warningSeverityOf(w.code);
	let source: PlaygroundDiagnostic["source"] = "kitchen";
	if (w.code.startsWith("MODULE_")) {
		source = "modules";
	} else if (
		w.code.includes("INGREDIENT") ||
		w.code.includes("MACROS") ||
		w.code.includes("MASS") ||
		w.code.includes("BAKERS")
	) {
		source = "analyzer";
	}

	return {
		...w,
		uri: w.uri || defaultUri,
		severity,
		source,
		blocking: false,
	};
}

const SEVERITY_ORDER: Record<WarningSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

/**
 * Sorts diagnostics by severity (errors first, then warnings, then info).
 */
export function sortDiagnostics(
	diagnostics: PlaygroundDiagnostic[],
): PlaygroundDiagnostic[] {
	return [...diagnostics].sort((a, b) => {
		const orderA = SEVERITY_ORDER[a.severity] ?? 99;
		const orderB = SEVERITY_ORDER[b.severity] ?? 99;
		if (orderA !== orderB) return orderA - orderB;
		return 0;
	});
}

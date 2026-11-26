import {
	type Diagnostic,
	DiagnosticSeverity,
	DiagnosticTag,
	type Range,
} from "vscode-languageserver";
import {
	EDITOR_HIDDEN_CODES,
	type LintConfig,
	type LintDiagnostic,
	type LintIngredientsFile,
	type LintSeverity,
	lintDocument,
} from "@gram-lang/modules/lint";
import type { DocumentState } from "../document-state";
import { buildLineIndex, locToRange } from "../utils/position";
import type { IngredientDB } from "../ingredient-loader";

const ZERO_RANGE: Range = {
	start: { line: 0, character: 0 },
	end: { line: 0, character: 1 },
};

const SEVERITY_MAP: Record<LintSeverity, DiagnosticSeverity> = {
	error: DiagnosticSeverity.Error,
	warning: DiagnosticSeverity.Warning,
	info: DiagnosticSeverity.Information,
	hint: DiagnosticSeverity.Hint,
};

/**
 * Every diagnostic of the document, as `@gram-lang/modules/lint` finds it
 * (the same list `gram check` reads), positions included. The codes an editor
 * leaves out when they carry no position (`EDITOR_HIDDEN_CODES`) are dropped.
 */
export function lintState(
	state: DocumentState,
	uri: string,
	ingredientDB: IngredientDB,
	config?: LintConfig,
	ingredientsFile?: LintIngredientsFile,
): LintDiagnostic[] {
	return lintDocument({
		uri,
		text: state.text,
		ast: state.ast,
		parseError: state.parseError
			? { message: state.parseError, offset: state.parseErrorOffset }
			: null,
		compilation: state.compilation,
		compileError: state.compileError,
		moduleGraph: state.moduleGraph,
		ingredientDB,
		config,
		...(ingredientsFile ? { ingredientsFile } : {}),
	}).filter((d) => d.loc || !EDITOR_HIDDEN_CODES.has(d.code));
}

/** Where a diagnostic of this document is shown: its `loc`, or the top of the file. */
export function rangeOf(state: DocumentState, d: LintDiagnostic): Range {
	return d.loc ? locToRange(state.lineStarts, d.loc) : ZERO_RANGE;
}

/**
 * One lint diagnostic as an LSP one: `related` becomes
 * `relatedInformation` (a clickable jump into the dependency that raised
 * it), `docUrl` the code's link, `deprecated` the struck-through style.
 */
function toDiagnostic(state: DocumentState, d: LintDiagnostic): Diagnostic {
	return {
		severity: SEVERITY_MAP[d.severity],
		range: rangeOf(state, d),
		message: d.message,
		code: d.code,
		...(d.docUrl ? { codeDescription: { href: d.docUrl } } : {}),
		source: "gram",
		...(d.deprecated ? { tags: [DiagnosticTag.Deprecated] } : {}),
		// What a Quick Fix acts on (the suggestion of an INVALID_QUANTITY,
		// say), as kitchen gives it.
		...(d.data ? { data: d.data } : {}),
		...(d.related
			? {
					relatedInformation: d.related.map((r) => {
						const source = state.moduleGraph?.modules.get(r.uri)?.source;
						return {
							location: {
								uri: r.uri,
								range:
									source && r.loc
										? locToRange(buildLineIndex(source), r.loc)
										: ZERO_RANGE,
							},
							message: r.message,
						};
					}),
				}
			: {}),
	};
}

export function provideDiagnostics(
	state: DocumentState,
	uri = "",
	ingredientDB: IngredientDB = {},
	config?: LintConfig,
): Diagnostic[] {
	return lintState(state, uri, ingredientDB, config).map((d) =>
		toDiagnostic(state, d),
	);
}

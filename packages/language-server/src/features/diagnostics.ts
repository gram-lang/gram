import {
	type Diagnostic,
	DiagnosticSeverity,
	type Range,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import {
	buildLineIndex,
	locToRange,
	offsetToPosition,
} from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	collectIngredients,
} from "../utils/ast-walker";
import type { WarningSeverity, Warning } from "@gram-lang/kitchen";
import { warningSeverityOf } from "@gram-lang/modules";
import {
	isKnownIngredient,
	findClosestIngredient,
	type IngredientDB,
} from "../ingredient-loader";

const ZERO_RANGE: Range = {
	start: { line: 0, character: 0 },
	end: { line: 0, character: 1 },
};

const SEVERITY_MAP: Record<WarningSeverity, DiagnosticSeverity> = {
	error: DiagnosticSeverity.Error,
	warning: DiagnosticSeverity.Warning,
	info: DiagnosticSeverity.Information,
};

/**
 * Turns one compiler `Warning` into a `Diagnostic` — same file as this
 * document except when `w.loc.uri` names a *different* file, which happens
 * once `@use` is involved: a warning raised while loading or measuring a
 * dependency carries that dependency's own uri (module-imports RFC §B.3;
 * `Location.uri` doc comment, `packages/parser/src/types.ts:1`), not this
 * document's. Rendering that offset against *this* document's `lineStarts`
 * would land on a garbage range in the wrong file's coordinates, so instead:
 * anchor the diagnostic at the `@use` line that pulled the dependency in (if
 * it's a direct import — the common case), or at the top of the file for a
 * deeper transitive one, and attach the warning's real position via
 * `relatedInformation`, which VS Code renders as a clickable jump into that
 * other file.
 */
function warningToDiagnostic(
	state: DocumentState,
	uri: string,
	w: Warning,
): Diagnostic {
	const severity = SEVERITY_MAP[warningSeverityOf(w.code)];
	const warnUri = w.loc?.uri ?? uri;

	if (warnUri === uri) {
		const range = w.loc ? locToRange(state.lineStarts, w.loc) : ZERO_RANGE;
		return {
			severity,
			range,
			message: w.message,
			code: w.code,
			source: "gram",
		};
	}

	const importDecl = state.moduleGraph?.modules
		.get(uri)
		?.imports.find((imp) => imp.uri === warnUri);
	const range = importDecl?.decl.loc
		? locToRange(state.lineStarts, importDecl.decl.loc)
		: ZERO_RANGE;

	const depSource = state.moduleGraph?.modules.get(warnUri)?.source;
	const depRange =
		depSource && w.loc
			? locToRange(buildLineIndex(depSource), w.loc)
			: ZERO_RANGE;

	return {
		severity,
		range,
		message: w.message,
		code: w.code,
		source: "gram",
		relatedInformation: [
			{ location: { uri: warnUri, range: depRange }, message: w.message },
		],
	};
}

export function provideDiagnostics(
	state: DocumentState,
	uri = "",
	ingredientLookupSet: Set<string> = new Set(),
	ingredientDB: IngredientDB = {},
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	if (state.parseError) {
		const range =
			state.parseErrorOffset !== null
				? (() => {
						const start = offsetToPosition(
							state.lineStarts,
							state.parseErrorOffset!,
						);
						return {
							start,
							end: { line: start.line, character: start.character + 1 },
						};
					})()
				: ZERO_RANGE;
		diagnostics.push({
			severity: DiagnosticSeverity.Error,
			range,
			message: state.parseError,
			source: "gram",
		});
		return diagnostics;
	}

	if (!state.ast) return diagnostics;

	if (state.compilation?.warnings) {
		for (const w of state.compilation.warnings) {
			diagnostics.push(warningToDiagnostic(state, uri, w));
		}
	}

	const declared = collectIntermediates(state.ast);
	const usedNames = new Set(collectReferences(state.ast).map((r) => r.name));
	for (const { decl } of declared) {
		if (!usedNames.has(decl.name)) {
			const range = decl.loc
				? locToRange(state.lineStarts, decl.loc)
				: ZERO_RANGE;
			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range,
				message: `Intermediate '->&${decl.name}' is declared but never used.`,
				code: "UNUSED_INTERMEDIATE",
				source: "gram",
			});
		}
	}

	if (ingredientLookupSet.size > 0) {
		const hasDB = Object.keys(ingredientDB).length > 0;
		for (const ingredient of collectIngredients(state.ast)) {
			if (!isKnownIngredient(ingredient.name, ingredientLookupSet)) {
				const range = ingredient.loc
					? locToRange(state.lineStarts, ingredient.loc)
					: ZERO_RANGE;
				const closest = hasDB
					? findClosestIngredient(ingredient.name, ingredientDB)
					: null;
				diagnostics.push({
					severity: DiagnosticSeverity.Information,
					range,
					message: closest
						? `'@${ingredient.name}' not found in the ingredient database. Did you mean '@${closest}'?`
						: `'@${ingredient.name}' not found in the ingredient database. Possible typo or missing entry.`,
					code: "UNKNOWN_INGREDIENT",
					source: "gram",
					data: closest ? { suggestion: closest } : undefined,
				});
			}
		}
	}

	if (!state.ast.meta || !(state.ast.meta as any).title) {
		diagnostics.push({
			severity: DiagnosticSeverity.Warning,
			range: ZERO_RANGE,
			message: "Recipe is missing a 'title' in frontmatter.",
			code: "MISSING_TITLE",
			source: "gram",
		});
	}

	return diagnostics;
}

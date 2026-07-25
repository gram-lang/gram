import {
	type Diagnostic,
	DiagnosticSeverity,
	type Range,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { locToRange, offsetToPosition } from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	collectIngredients,
} from "../utils/ast-walker";
import { warningSeverity, type WarningSeverity } from "@gram-lang/kitchen";
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

export function provideDiagnostics(
	state: DocumentState,
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
			const range = w.loc ? locToRange(state.lineStarts, w.loc) : ZERO_RANGE;
			diagnostics.push({
				severity: SEVERITY_MAP[warningSeverity[w.code]],
				range,
				message: w.message,
				code: w.code,
				source: "gram",
			});
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

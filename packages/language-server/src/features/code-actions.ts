import {
	type CodeAction,
	CodeActionKind,
	type Diagnostic,
	type Range,
	TextDocumentEdit,
	type TextEdit,
	type WorkspaceEdit,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import {
	buildLineIndex,
	locToRange,
	positionToOffset,
} from "../utils/position";
import {
	collectIngredients,
	type LintConfig,
	type LintDiagnostic,
	type LintFix,
	type LintIngredientsFile,
} from "@gram-lang/modules/lint";
import type { IngredientDB } from "../ingredient-loader";
import { normalizeUnit } from "@gram-lang/i18n";
import { ASTNodeType, type QuantityAST } from "@gram-lang/parser";
import { getIngredientData, standardizeMass } from "@gram-lang/analyzer";
import { numericTotal, termsOfAst } from "@gram-lang/kitchen";
import { lintState, rangeOf } from "./diagnostics";

const sameRange = (a: Range, b: Range) =>
	a.start.line === b.start.line &&
	a.start.character === b.start.character &&
	a.end.line === b.end.line &&
	a.end.character === b.end.character;

/** What the client and the server know beyond the document, for the Quick Fixes. */
export interface CodeActionContext {
	/** The client applies `documentChanges` (`ClientProfile.documentChanges`). */
	documentChanges?: boolean;
	/** The ingredient database file, with its current text (`ADD_TO_INGREDIENTS_DB`). */
	ingredientsFile?: LintIngredientsFile;
}

/**
 * A lint fix as an LSP workspace edit: each patch converted against the
 * lines of the file it edits (this document, a dependency of its `@use`
 * graph, or the ingredient database), as `documentChanges` for a client that
 * applies them, else as `changes`. Null when it edits a file whose text is
 * unknown here, or creates one (not offered yet).
 */
function toWorkspaceEdit(
	state: DocumentState,
	uri: string,
	fix: LintFix,
	context: CodeActionContext,
): WorkspaceEdit | null {
	const changes: Record<string, TextEdit[]> = {};
	for (const edit of fix.edits) {
		if (edit.kind !== "patch") return null;
		const source =
			edit.uri === uri
				? null
				: (state.moduleGraph?.modules.get(edit.uri)?.source ??
					(edit.uri === context.ingredientsFile?.uri
						? context.ingredientsFile.text
						: undefined));
		if (source === undefined) return null;
		const lines = source === null ? state.lineStarts : buildLineIndex(source);
		changes[edit.uri] = [
			...(changes[edit.uri] ?? []),
			...edit.patches.map((p) => ({
				range: locToRange(lines, p),
				newText: p.replacement,
			})),
		];
	}
	if (!context.documentChanges) return { changes };
	return {
		documentChanges: Object.entries(changes).map(([target, edits]) =>
			TextDocumentEdit.create({ uri: target, version: null }, edits),
		),
	};
}

/**
 * The Quick Fixes of the client's diagnostics, as `@gram-lang/modules/lint`
 * gives them: the document is linted again on its fresh state and each
 * diagnostic is found back by its code and range, so a fix never acts on
 * offsets of an older version of the text. Then the refactors of the
 * ingredient under the cursor.
 */
export function provideCodeActions(
	state: DocumentState,
	range: Range,
	diagnostics: Diagnostic[],
	uri: string,
	db: IngredientDB,
	config?: LintConfig,
	context: CodeActionContext = {},
): CodeAction[] {
	const actions: CodeAction[] = [];

	const linted: LintDiagnostic[] =
		diagnostics.length > 0
			? lintState(state, uri, db, config, context.ingredientsFile)
			: [];
	for (const diag of diagnostics) {
		const match = linted.find(
			(d) => d.code === diag.code && sameRange(rangeOf(state, d), diag.range),
		);
		for (const fix of match?.fixes ?? []) {
			const edit = toWorkspaceEdit(state, uri, fix, context);
			if (!edit) continue;
			actions.push({
				title: fix.title,
				kind: CodeActionKind.QuickFix,
				...(fix.isPreferred ? { isPreferred: true } : {}),
				diagnostics: [diag],
				edit,
			});
		}
	}

	// Refactor: convert volume unit → grams (only when ingredient has density in DB)
	if (state.ast && Object.keys(db).length > 0) {
		const cursorOffset = positionToOffset(state.lineStarts, range.start);
		const ingredients = collectIngredients(state.ast);
		const ingredient = ingredients.find(
			(i) => i.loc && i.loc.start <= cursorOffset && cursorOffset <= i.loc.end,
		);

		if (ingredient) {
			const entry = getIngredientData(ingredient.name, db);
			const qty =
				ingredient.quantity?.type === ASTNodeType.Quantity
					? (ingredient.quantity as QuantityAST)
					: null;

			if (qty?.unit && qty.value && qty.loc) {
				const amount = numericTotal(termsOfAst(qty));
				const canon = amount && amount > 0 ? normalizeUnit(qty.unit) : null;
				if (canon) {
					const norm = standardizeMass(amount!, canon, db, entry?.name);
					if (norm && norm.method === "density" && norm.mass) {
						const qtyRange = locToRange(state.lineStarts, qty.loc);
						actions.push({
							title: `Convert to grams (≈ ${Math.round(norm.mass)} g)`,
							kind: CodeActionKind.RefactorRewrite,
							edit: {
								changes: {
									[uri]: [
										{ range: qtyRange, newText: `${Math.round(norm.mass)} g` },
									],
								},
							},
						});
					}
				}
			}
		}
	}

	return actions;
}

import {
	type CodeAction,
	CodeActionKind,
	type Diagnostic,
	type Range,
	type TextEdit,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import {
	locToRange,
	offsetToPosition,
	positionToOffset,
} from "../utils/position";
import { collectIntermediates, collectIngredients } from "../utils/ast-walker";
import { type IngredientDB, lookupIngredient } from "../ingredient-loader";
import { normalizeUnit } from "@gram-lang/i18n";
import { ASTNodeType, type QuantityAST } from "@gram-lang/parser";
import { standardizeMass } from "@gram-lang/analyzer";
import { getNumericQty } from "@gram-lang/kitchen";

export function provideCodeActions(
	state: DocumentState,
	range: Range,
	diagnostics: Diagnostic[],
	uri: string,
	db: IngredientDB,
): CodeAction[] {
	const actions: CodeAction[] = [];

	for (const diag of diagnostics) {
		if (diag.code === "MISSING_TITLE") {
			if (state.text.startsWith("---")) {
				const titleInsert: TextEdit = {
					range: {
						start: { line: 1, character: 0 },
						end: { line: 1, character: 0 },
					},
					newText: "title: \n",
				};
				actions.push({
					title: "Add 'title' to frontmatter",
					kind: CodeActionKind.QuickFix,
					diagnostics: [diag],
					edit: { changes: { [uri]: [titleInsert] } },
				});
			}
		}

		if (diag.code === "UNUSED_INTERMEDIATE") {
			const msg =
				typeof diag.message === "string" ? diag.message : diag.message.value;
			const nameMatch = msg.match(/'->& *([^']+)'/);
			if (nameMatch && state.ast) {
				const name = nameMatch[1];
				const decls = collectIntermediates(state.ast);
				const match = decls.find((d) => d.decl.name === name && d.decl.loc);
				if (match?.decl.loc) {
					actions.push({
						title: `Remove unused '->&${name}'`,
						kind: CodeActionKind.QuickFix,
						diagnostics: [diag],
						edit: {
							changes: {
								[uri]: [
									{
										range: locToRange(state.lineStarts, match.decl.loc),
										newText: "",
									},
								],
							},
						},
					});
				}
			}
		}

		if (diag.code === "UNKNOWN_INGREDIENT") {
			const suggestion = (diag.data as { suggestion?: string } | undefined)
				?.suggestion;
			if (suggestion) {
				const startOffset = positionToOffset(
					state.lineStarts,
					diag.range.start,
				);
				const endOffset = positionToOffset(state.lineStarts, diag.range.end);
				const ingText = state.text.slice(startOffset, endOffset);

				// Skip @ sigil and any modifiers (?-*&=) to reach the name
				let nameRelStart = ingText[0] === "@" ? 1 : 0;
				while (
					nameRelStart < ingText.length &&
					"-?&*=".includes(ingText[nameRelStart]!)
				)
					nameRelStart++;

				// Name ends at the first brace, composite <, parenthesis, pipe, or newline
				let nameRelEnd = nameRelStart;
				while (
					nameRelEnd < ingText.length &&
					!"{<(|\n".includes(ingText[nameRelEnd]!)
				)
					nameRelEnd++;
				while (nameRelEnd > nameRelStart && ingText[nameRelEnd - 1] === " ")
					nameRelEnd--;

				actions.push({
					title: `Replace with '@${suggestion}'`,
					kind: CodeActionKind.QuickFix,
					isPreferred: true,
					diagnostics: [diag],
					edit: {
						changes: {
							[uri]: [
								{
									range: {
										start: offsetToPosition(
											state.lineStarts,
											startOffset + nameRelStart,
										),
										end: offsetToPosition(
											state.lineStarts,
											startOffset + nameRelEnd,
										),
									},
									newText: suggestion,
								},
							],
						},
					},
				});
			}
		}

		if (diag.code === "UNDEFINED_REFERENCE") {
			const msg =
				typeof diag.message === "string" ? diag.message : diag.message.value;
			const nameMatch = msg.match(/'&([^']+)'/);
			if (nameMatch && state.ast) {
				const name = nameMatch[1];
				const offset = positionToOffset(state.lineStarts, diag.range.start);
				let insertLine = diag.range.start.line + 1;
				for (const section of state.ast.children) {
					if (
						section.loc &&
						section.loc.start <= offset &&
						offset <= section.loc.end
					) {
						insertLine = offsetToPosition(
							state.lineStarts,
							section.loc.end,
						).line;
						break;
					}
				}
				actions.push({
					title: `Declare '->&${name}{}'`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diag],
					edit: {
						changes: {
							[uri]: [
								{
									range: {
										start: { line: insertLine, character: 0 },
										end: { line: insertLine, character: 0 },
									},
									newText: `->&${name}{}\n`,
								},
							],
						},
					},
				});
			}
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
			const entry = lookupIngredient(ingredient.name, db);
			const qty =
				ingredient.quantity?.type === ASTNodeType.Quantity
					? (ingredient.quantity as QuantityAST)
					: null;

			if (qty?.unit && qty.value && qty.loc) {
				const amount = getNumericQty(qty.value);
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

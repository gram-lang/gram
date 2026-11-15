import {
	type CodeAction,
	CodeActionKind,
	type Diagnostic,
	type Range,
	type TextEdit,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import {
	buildLineIndex,
	locToRange,
	offsetToPosition,
	positionToOffset,
} from "../utils/position";
import { collectIntermediates, collectIngredients } from "../utils/ast-walker";
import { type IngredientDB, lookupIngredient } from "../ingredient-loader";
import { normalizeUnit } from "@gram-lang/i18n";
import { ASTNodeType, type QuantityAST } from "@gram-lang/parser";
import { standardizeMass } from "@gram-lang/analyzer";
import { numericTotal, termsOfAst } from "@gram-lang/kitchen";

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

		// MODULE_EXPORT_NOT_FOUND with the "internal but not re-exported" hint
		// (@gram-lang/modules' warnings.ts) — points at a name that already
		// exists in the imported module but is a private, step-level `->&`.
		// The fix lives in the *dependency* file, not this one: append the
		// missing section-level `->&name` to the header of the section that
		// declares it, when that section doesn't already export a different
		// name (only one `->&` per section — see `SectionAST.intermediateDecl`).
		if (diag.code === "MODULE_EXPORT_NOT_FOUND") {
			const msg =
				typeof diag.message === "string" ? diag.message : diag.message.value;
			const match = msg.match(
				/^Module "([^"]+)" does not export '&([^']+)' — it exists in the module but isn't re-exported\./,
			);
			if (match && state.moduleGraph) {
				const [, specifier, name] = match as [string, string, string];
				const depUri = state.moduleGraph.modules
					.get(uri)
					?.imports.find((imp) => imp.decl.specifier === specifier)?.uri;
				const depRecord = depUri
					? state.moduleGraph.modules.get(depUri)
					: undefined;

				if (depUri && depRecord) {
					const found = collectIntermediates(depRecord.ast).find(
						(d) => d.decl.name === name && d.step !== null,
					);
					if (found && !found.section.intermediateDecl && found.section.loc) {
						const depLines = buildLineIndex(depRecord.source);
						const headerEndOffset = depRecord.source.indexOf(
							"\n",
							found.section.loc.start,
						);
						const insertOffset =
							headerEndOffset === -1
								? depRecord.source.length
								: headerEndOffset;
						const insertPos = offsetToPosition(depLines, insertOffset);
						actions.push({
							title: `Re-export '&${name}' from "${specifier}"`,
							kind: CodeActionKind.QuickFix,
							diagnostics: [diag],
							edit: {
								changes: {
									[depUri]: [
										{
											range: { start: insertPos, end: insertPos },
											newText: ` ->&${name}`,
										},
									],
								},
							},
						});
					}
				}
			}
		}

		const quantityFix = quantityQuickFix(state, diag);
		if (quantityFix) {
			actions.push({
				title: quantityFix.title,
				kind: CodeActionKind.QuickFix,
				isPreferred: true,
				diagnostics: [diag],
				edit: { changes: { [uri]: [quantityFix.edit] } },
			});
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

/** The `data` a quantity warning carries (kitchen's `warningData`). */
interface QuantityFixData {
	reason?: string;
	suggestion?: string;
}

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The Quick Fix of a quantity warning, from the `data` kitchen gives it:
 * - two quantities in one unit (`INVALID_UNIT`, `{1 cup 5 tbsp}`): ` + `
 *   between them;
 * - a sum refused with a result to write (`INVALID_QUANTITY`,
 *   `{100 g + 10%}`): the braces hold that result (`{110 g}`);
 * - `oz` after a volume (`OZ_AFTER_VOLUME`, `{1 cup + 2 oz}`): `fl oz`.
 */
function quantityQuickFix(
	state: DocumentState,
	diag: Diagnostic,
): { title: string; edit: TextEdit } | null {
	const data = diag.data as QuantityFixData | undefined;
	const suggestion = data?.suggestion;
	if (!suggestion) return null;
	const start = positionToOffset(state.lineStarts, diag.range.start);
	const end = positionToOffset(state.lineStarts, diag.range.end);
	const text = state.text.slice(start, end);
	const edit = (from: number, to: number, newText: string): TextEdit => ({
		range: {
			start: offsetToPosition(state.lineStarts, from),
			end: offsetToPosition(state.lineStarts, to),
		},
		newText,
	});

	if (diag.code === "INVALID_UNIT" && data.reason === "twoQuantities") {
		// The range is the term, or the whole ingredient for a lone quantity:
		// search the braces only, so a name holding the unit is left alone.
		const open = text.indexOf("{");
		const [first, second] = suggestion.split(" + ");
		if (!first || !second) return null;
		const words = (part: string) =>
			part.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
		const gap = new RegExp(
			`(${words(first)})(\\s*)(?=${escapeRegExp(second.split(/\s+/)[0]!)})`,
		).exec(text.slice(open + 1));
		if (!gap) return null;
		const at = start + open + 1 + gap.index + gap[1]!.length;
		return {
			title: "Add the two quantities with ' + '",
			edit: edit(at, at + gap[2]!.length, " + "),
		};
	}

	if (diag.code === "INVALID_QUANTITY") {
		const open = state.text.lastIndexOf("{", start);
		const close = state.text.indexOf("}", end);
		if (open === -1 || close === -1) return null;
		if (state.text.slice(open, start).includes("}")) return null;
		return {
			title: `Replace with {${suggestion}}`,
			edit: edit(open + 1, close, suggestion),
		};
	}

	if (diag.code === "OZ_AFTER_VOLUME") {
		// The range is the term (`2 oz`): its unit starts at its first letter.
		const unitAt = text.search(/\p{L}/u);
		if (unitAt === -1) return null;
		return {
			title: `Write ${suggestion} (a volume)`,
			edit: edit(start + unitAt, end, suggestion),
		};
	}

	return null;
}

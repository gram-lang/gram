import { findClosestIngredients, isKnownIngredient } from "@gram-lang/analyzer";
import type { RecipeAST } from "@gram-lang/parser";
import {
	collectIngredients,
	collectIntermediates,
	collectReferences,
	collectRelativeTargets,
} from "./ast-walker";
import type { LintDiagnostic, LintFix } from "./types";

/** The ingredient database `UNKNOWN_INGREDIENT` resolves names against (the analyzer's). */
export type LintIngredientDB = Parameters<typeof isKnownIngredient>[1];

/** A diagnostic of a rule, before `lintDocument` gives it its uri, severity and `docUrl`. */
export type RuleDiagnostic = Omit<LintDiagnostic, "uri" | "severity">;

interface RuleContext {
	uri: string;
	text: string;
	ast: RecipeAST;
}

/**
 * `MISSING_TITLE`: no `title:` in the frontmatter. The fix adds one when the
 * file opens a frontmatter.
 */
export function missingTitle(ctx: RuleContext): RuleDiagnostic[] {
	if (ctx.ast.meta && (ctx.ast.meta as { title?: unknown }).title) return [];
	const fixes: LintFix[] = [];
	if (ctx.text.startsWith("---")) {
		const nl = ctx.text.indexOf("\n");
		const at = nl === -1 ? ctx.text.length : nl + 1;
		fixes.push({
			title: "Add 'title' to frontmatter",
			edits: [
				{
					kind: "patch",
					uri: ctx.uri,
					patches: [{ start: at, end: at, replacement: "title: \n" }],
				},
			],
		});
	}
	return [
		{
			code: "MISSING_TITLE",
			message: "Recipe is missing a 'title' in frontmatter.",
			...(fixes.length > 0 ? { fixes } : {}),
		},
	];
}

/**
 * `UNUSED_INTERMEDIATE`: a step's `->&name` no step names, either as a
 * reference (`&dough`) or as the target of a share, a ratio or a
 * proportional timer (`@salt{2% &dough}`, `~{15 min / 500 g &dough}`). One
 * declared on a section heading is never flagged: it is a module's export
 * surface (`computeExports`) or the name of a standalone recipe's final dish.
 */
export function unusedIntermediates(ctx: RuleContext): RuleDiagnostic[] {
	const used = new Set(collectReferences(ctx.ast).map((r) => r.name));
	for (const t of collectRelativeTargets(ctx.ast, ctx.text)) {
		if (t.referenceType === "variable") used.add(t.name);
	}
	const found: RuleDiagnostic[] = [];
	for (const { decl, step } of collectIntermediates(ctx.ast)) {
		if (step === null || used.has(decl.name)) continue;
		const loc = decl.loc;
		found.push({
			code: "UNUSED_INTERMEDIATE",
			...(loc ? { loc: { start: loc.start, end: loc.end } } : {}),
			message: `Intermediate '->&${decl.name}' is declared but never used.`,
			...(loc
				? {
						fixes: [
							{
								title: `Remove unused '->&${decl.name}'`,
								edits: [
									{
										kind: "patch",
										uri: ctx.uri,
										patches: [
											{ start: loc.start, end: loc.end, replacement: "" },
										],
									},
								],
							},
						],
					}
				: {}),
		});
	}
	return found;
}

/**
 * Where the name of an ingredient is written in its text: after the `@` and
 * its modifiers, up to its braces, a composite `<`, a preparation, a pipe or
 * the end of the line, trailing blanks left out.
 */
function nameSpan(written: string): { start: number; end: number } {
	let start = written[0] === "@" ? 1 : 0;
	while (start < written.length && "-?&*=".includes(written[start]!)) start++;
	let end = start;
	while (end < written.length && !"{<(|\n".includes(written[end]!)) end++;
	while (end > start && written[end - 1] === " ") end--;
	return { start, end };
}

/**
 * `UNKNOWN_INGREDIENT`: every mention of an ingredient the analyzer does not
 * resolve (`resolveCanonicalId`, the resolution the nutrition uses). Only
 * with a non-empty database: without one every ingredient would be unknown.
 * The spelling fix is preferred only when one name is the closest.
 */
export function unknownIngredients(
	ctx: RuleContext,
	db: LintIngredientDB | undefined,
): RuleDiagnostic[] {
	if (!db || Object.keys(db).length === 0) return [];
	const found: RuleDiagnostic[] = [];
	for (const ingredient of collectIngredients(ctx.ast)) {
		if (isKnownIngredient(ingredient.name, db)) continue;
		const closest = findClosestIngredients(ingredient.name, db);
		const suggestion = closest[0];
		const loc = ingredient.loc;
		const fixes: LintFix[] = [];
		if (suggestion && loc) {
			const span = nameSpan(ctx.text.slice(loc.start, loc.end));
			fixes.push({
				title: `Replace with '@${suggestion}'`,
				edits: [
					{
						kind: "patch",
						uri: ctx.uri,
						patches: [
							{
								start: loc.start + span.start,
								end: loc.start + span.end,
								replacement: suggestion,
							},
						],
					},
				],
				...(closest.length === 1 ? { isPreferred: true } : {}),
			});
		}
		found.push({
			code: "UNKNOWN_INGREDIENT",
			...(loc ? { loc: { start: loc.start, end: loc.end } } : {}),
			message: suggestion
				? `'@${ingredient.name}' not found in the ingredient database. Did you mean '@${suggestion}'?`
				: `'@${ingredient.name}' not found in the ingredient database. Possible typo or missing entry.`,
			...(suggestion ? { data: { suggestion } } : {}),
			...(fixes.length > 0 ? { fixes } : {}),
		});
	}
	return found;
}

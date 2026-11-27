/**
 * The writing checks of the lint layer: what the parser reads differently
 * from what the author most likely meant, without a word of complaint from
 * the compiler. Each one is read from the text and the file's own AST, never
 * from another file.
 */
import type { CompilationResult } from "@gram-lang/kitchen";
import {
	getAST,
	type IngredientAST,
	isComment,
	isIntermediateDecl,
	type RecipeAST,
} from "@gram-lang/parser";
import { collectIngredients, iterAllSteps } from "./ast-walker";
import { scanFrontmatter } from "./frontmatter-text";
import { findWrittenIngredients, lostFrom } from "./gram-tokens";
import { nameSpan, type RuleDiagnostic } from "./rules";
import type { LintFix } from "./types";

interface RuleContext {
	uri: string;
	text: string;
	ast: RecipeAST;
}

/** The line break `text` writes, read from its first one. */
function lineBreakOf(text: string): string {
	const nl = text.indexOf("\n");
	return nl > 0 && text[nl - 1] === "\r" ? "\r\n" : "\n";
}

/** Where the line that starts at `start` ends, its `\r` left out. */
function lineEndAt(text: string, start: number): number {
	const nl = text.indexOf("\n", start);
	let end = nl === -1 ? text.length : nl;
	if (end > start && text[end - 1] === "\r") end--;
	return end;
}

/** One past the end of a closed frontmatter (0 when there is none). */
function frontmatterEnd(text: string): number {
	const block = scanFrontmatter(text);
	if (!block?.closed) return 0;
	let end = 0;
	for (let line = 0; line <= block.endLine; line++) {
		const nl = text.indexOf("\n", end);
		end = nl === -1 ? text.length : nl + 1;
	}
	return end;
}

/**
 * `LOST_INGREDIENT`: an `@ingredient` written in the text that never reached
 * the compiled recipe because a `//` earlier on the line turned the rest of
 * it into a comment (`@flour{} // to taste, @salt{}`). Only a comment in the
 * middle of a step counts: a whole `//` line or a `/* … *\/` block is written
 * on purpose, and an `@` read as text elsewhere (a section title, a
 * preparation, `&@flour`) was never meant to be one. No fix: whether the
 * `//` or the ingredient is the mistake is the author's call.
 */
export function lostIngredients(
	ctx: RuleContext,
	compilation: Pick<CompilationResult, "registry"> | undefined,
): RuleDiagnostic[] {
	if (!compilation?.registry) return [];
	const comments: { start: number; end: number }[] = [];
	for (const step of iterAllSteps(ctx.ast)) {
		for (const child of step.children) {
			if (isComment(child) && child.kind === "line" && child.loc) {
				comments.push(child.loc);
			}
		}
	}
	if (comments.length === 0) return [];
	return lostFrom(compilation, findWrittenIngredients(ctx.text))
		.filter((w) => comments.some((c) => c.start <= w.start && w.start < c.end))
		.map((w) => ({
			code: "LOST_INGREDIENT",
			loc: { start: w.start, end: w.end },
			message: `'@${w.name}' is written but not read as an ingredient: the '//' before it on this line starts a comment.`,
			data: { name: w.name },
		}));
}

/** `startAction` of the grammar: `[Action]` opening a line. */
const ACTION_LINE = /^[ \t]*\[[^\]\n]+\]/;
/**
 * Whether `line` can open a block on its own. When it cannot, the blank line
 * would turn text the parser reads into a syntax error: a bare `[Action]`
 * (nothing after the bracket, or a lone `\r` right after it, which ends a
 * line for the parser too), a `## Title ~{5 min}.` with text after its
 * anchor. Only run on a line the rule already picked.
 */
function opensBlock(line: string): boolean {
	try {
		getAST(line);
		return true;
	} catch {
		return false;
	}
}
/** `header` of the grammar: `##`, then a blank or the end of the line. */
const HEADER_LINE = /^[ \t]*##(?:[ \t]|\r?$)/;

/**
 * `MERGED_STEP_LINE`: a line the author most likely meant to start a new
 * block, read as more text of the step above because no blank line
 * separates them: a `[Action]` (the action of the next step), a `## …`
 * (a section, which vanishes), or any line after one that ends with
 * `->&name` (the step's output: what follows is another step). A plain line
 * break inside a step stays legitimate (`A step,\nthe same step.`). The fix,
 * preferred, inserts the blank line. A line that cannot open a block on its
 * own (`opensBlock`) is left alone, whatever the line above: the blank line
 * would only turn it into a parse error.
 */
export function mergedStepLines(ctx: RuleContext): RuleDiagnostic[] {
	const { text } = ctx;
	const skipBefore = frontmatterEnd(text);
	const eol = lineBreakOf(text);
	const found: RuleDiagnostic[] = [];
	for (const step of iterAllSteps(ctx.ast)) {
		const loc = step.loc;
		if (!loc || loc.start < skipBefore) continue;
		const comments = step.children
			.filter(isComment)
			.flatMap((c) => (c.loc ? [c.loc] : []));
		const declEnds = step.children
			.filter(isIntermediateDecl)
			.flatMap((d) => (d.loc ? [d.loc] : []));
		for (
			let nl = text.indexOf("\n", loc.start);
			nl !== -1 && nl + 1 < loc.end;
			nl = text.indexOf("\n", nl + 1)
		) {
			const start = nl + 1;
			if (comments.some((c) => c.start <= nl && nl < c.end)) continue;
			const end = lineEndAt(text, start);
			const line = text.slice(start, end);
			if (line.trim() === "") continue;
			const prevStart = text.lastIndexOf("\n", nl - 1) + 1;
			const prevContentEnd = (() => {
				let e = nl;
				while (e > prevStart && /[ \t\r]/.test(text[e - 1]!)) e--;
				return e;
			})();
			const decl = declEnds.find(
				(d) => d.start >= prevStart && d.end === prevContentEnd,
			);
			let reason: "action" | "header" | "intermediate" | null = null;
			if (HEADER_LINE.test(line)) reason = "header";
			else if (ACTION_LINE.test(line)) reason = "action";
			else if (decl) reason = "intermediate";
			if (!reason || !opensBlock(line)) continue;
			const message =
				reason === "header"
					? "This '##' line is read as text of the step above, not as a section: leave a blank line before it."
					: reason === "action"
						? "This '[…]' line is read as text of the step above, not as the action of a new step: leave a blank line before it."
						: `The step above ends with '${text.slice(decl!.start, decl!.end)}', but this line is still read as part of it: leave a blank line before it.`;
			found.push({
				code: "MERGED_STEP_LINE",
				loc: { start, end },
				message,
				data: { reason },
				fixes: [
					{
						title: "Insert a blank line",
						isPreferred: true,
						edits: [
							{
								kind: "patch",
								uri: ctx.uri,
								patches: [{ start, end: start, replacement: eol }],
							},
						],
					},
				],
			});
		}
	}
	return found;
}

/** More words than an ingredient name takes. */
export const SUSPECT_NAME_MAX_WORDS = 6;
/**
 * More characters (graphemes, so a script written without spaces counts
 * too) than an ingredient name takes.
 */
export const SUSPECT_NAME_MAX_GRAPHEMES = 40;
/**
 * What ends a name and starts a sentence: `, ` `; ` `. `, or `、` `。`. A
 * `. ` counts only after a word of four letters or more, so an abbreviation
 * (`St. John's wort`, `env. 3 cm`) does not.
 */
const SENTENCE_BREAK = /[,;] |(?<=\p{L}{4})\. |[、。]/u;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Whether the ingredient's name is closed by braces (`@dark chocolate{200 g}`). */
function bracedName(
	text: string,
	ingredient: IngredientAST,
): { start: number; end: number; close: number } | null {
	const loc = ingredient.loc;
	if (!loc) return null;
	const span = nameSpan(text.slice(loc.start, loc.end));
	const start = loc.start + span.start;
	const end = loc.start + span.end;
	if (text[end] !== "{") return null;
	const close = text.indexOf("}", end);
	if (close === -1 || close >= loc.end) return null;
	return { start, end, close };
}

/**
 * `SUSPECT_INGREDIENT_NAME`: a name in braces that reads like a sentence:
 * it holds a sentence break (`, ` `; ` `. ` `、` `。`), more than
 * `SUSPECT_NAME_MAX_WORDS` words or more than `SUSPECT_NAME_MAX_GRAPHEMES`
 * characters. Only a hint: `@chocolat noir 70 %, en pistoles{200 g}` is a
 * valid name. Where a break splits it, the fix (never preferred) moves the
 * rest into the preparation: `@chocolat noir 70 %{200 g}(en pistoles)`.
 */
export function suspectIngredientNames(ctx: RuleContext): RuleDiagnostic[] {
	const found: RuleDiagnostic[] = [];
	for (const ingredient of collectIngredients(ctx.ast)) {
		const braced = bracedName(ctx.text, ingredient);
		if (!braced) continue;
		const name = ctx.text.slice(braced.start, braced.end);
		const words = name.trim().split(/\s+/).length;
		const length = [...graphemes.segment(name.trim())].length;
		const broken = SENTENCE_BREAK.exec(name);
		if (
			!broken &&
			words <= SUSPECT_NAME_MAX_WORDS &&
			length <= SUSPECT_NAME_MAX_GRAPHEMES
		) {
			continue;
		}
		const fixes: LintFix[] = [];
		const head = broken ? name.slice(0, broken.index).trimEnd() : "";
		const rest = broken
			? name.slice(broken.index + broken[0].length).trim()
			: "";
		if (
			broken &&
			head &&
			rest &&
			!rest.includes(")") &&
			!ingredient.preparation &&
			!ingredient.composite &&
			!ingredient.alias
		) {
			fixes.push({
				title: `Split into '@${head}{…}(${rest})'`,
				edits: [
					{
						kind: "patch",
						uri: ctx.uri,
						patches: [
							{ start: braced.start, end: braced.end, replacement: head },
							{
								start: braced.close + 1,
								end: braced.close + 1,
								replacement: `(${rest})`,
							},
						],
					},
				],
			});
		}
		found.push({
			code: "SUSPECT_INGREDIENT_NAME",
			loc: { start: braced.start, end: braced.end },
			message: `'${name.trim()}' reads more like a sentence than an ingredient name: a preparation may belong in parentheses after the quantity.`,
			...(fixes.length > 0 ? { fixes } : {}),
		});
	}
	return found;
}

/**
 * `UNREAD_FRONTMATTER`: the file opens a closed `---` block with keys, but
 * the recipe has no metadata at all: one line the grammar does not take
 * there (a `# …` comment, an indented line) turned the whole block into the
 * text of a step. Anchored on that line. Only a `# …` line gets a fix
 * (removing it, not preferred): an indented line holds data (`  - flour:
 * 0.55`) that removing would lose.
 */
export function unreadFrontmatter(ctx: RuleContext): RuleDiagnostic[] {
	const block = scanFrontmatter(ctx.text);
	if (!block?.closed || block.keys.length === 0) return [];
	if (ctx.ast.meta && Object.keys(ctx.ast.meta).length > 0) return [];
	const { text } = ctx;
	let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
	for (let line = 0; line < block.endLine; line++) {
		const nl = text.indexOf("\n", start);
		const next = nl === -1 ? text.length : nl + 1;
		const end = lineEndAt(text, start);
		const content = text.slice(start, end);
		const comment = content.startsWith("#");
		if (line > 0 && (comment || /^[ \t]+\S/.test(content))) {
			return [
				{
					code: "UNREAD_FRONTMATTER",
					loc: { start, end },
					message: comment
						? "The frontmatter is not read: a '#' line is not a 'key: value' line, so the whole block is taken as the text of a step."
						: "The frontmatter is not read: an indented line is not a 'key: value' line, so the whole block is taken as the text of a step. Write lists inline ('densities: [flour:0.55]').",
					...(comment
						? {
								fixes: [
									{
										title: "Remove this line",
										edits: [
											{
												kind: "patch",
												uri: ctx.uri,
												patches: [{ start, end: next, replacement: "" }],
											},
										],
									},
								],
							}
						: {}),
				},
			];
		}
		start = next;
	}
	// Emptied by something else: shown on the opening `---`.
	return [
		{
			code: "UNREAD_FRONTMATTER",
			loc: { start: 0, end: lineEndAt(text, 0) },
			message:
				"The frontmatter is not read: the whole block is taken as the text of a step.",
		},
	];
}

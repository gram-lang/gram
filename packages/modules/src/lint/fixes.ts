import { FRONTMATTER_KEYS, type Warning } from "@gram-lang/kitchen";
import {
	isIngredient,
	isReference,
	isSection,
	isStep,
	type ASTNode,
	type RecipeAST,
} from "@gram-lang/parser";
import type { ModuleGraph } from "../host";
import { computeExports } from "../exports";
import { collectIntermediates } from "./ast-walker";
import { scanFrontmatter } from "./frontmatter-text";
import type { LintFix } from "./types";

/** What the fixes of a compiler warning read: the checked file and its graph. */
export interface FixContext {
	uri: string;
	text: string;
	ast: RecipeAST;
	moduleGraph?: ModuleGraph;
}

const patch = (
	uri: string,
	start: number,
	end: number,
	replacement: string,
): LintFix["edits"][number] => ({
	kind: "patch",
	uri,
	patches: [{ start, end, replacement }],
});

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where the line after the one holding `offset` starts (the end of the text on the last line). */
function nextLineStart(text: string, offset: number): number {
	const nl = text.indexOf("\n", offset);
	return nl === -1 ? text.length : nl + 1;
}

/** Where the line holding `offset` starts. */
function lineStart(text: string, offset: number): number {
	return text.lastIndexOf("\n", offset - 1) + 1;
}

/**
 * The fix of a quantity warning, from the `data` kitchen gives it:
 * - two quantities in one unit (`INVALID_UNIT`, `{1 cup 5 tbsp}`): ` + `
 *   between them;
 * - a sum refused with a result to write (`INVALID_QUANTITY`,
 *   `{100 g + 10%}`): the braces hold that result (`{110 g}`);
 * - `oz` after a volume (`OZ_AFTER_VOLUME`, `{1 cup + 2 oz}`): `fl oz`;
 * - a composite split by spaces (`SPACED_COMPOSITE`,
 *   `@lemon zest{1} < @lemon{2}`): `<` glued to the parent (`<@lemon`);
 * - `&` before a raw ingredient (`REFERENCE_TO_INGREDIENT`, `&flour`):
 *   `@&flour`;
 * - Cooklang's `%` between a number and its unit (`INVALID_DURATION`,
 *   `~{15%min}`; `INVALID_UNIT`, `{200%g}`): a space.
 */
function quantityFix(
	ctx: FixContext,
	w: Warning,
	loc: { start: number; end: number },
): LintFix | null {
	const data = w.data as { reason?: string; suggestion?: string } | undefined;
	const suggestion = data?.suggestion;
	if (typeof suggestion !== "string" || !suggestion) return null;
	const { start, end } = loc;
	const text = ctx.text.slice(start, end);
	const fix = (
		title: string,
		from: number,
		to: number,
		replacement: string,
	): LintFix => ({
		title,
		edits: [patch(ctx.uri, from, to, replacement)],
		isPreferred: true,
	});

	if (w.code === "INVALID_UNIT" && data.reason === "cooklangSeparator") {
		// The range is the whole ingredient: the `%` is the one in its
		// braces, right before the unit.
		const open = text.indexOf("{");
		if (open === -1) return null;
		const gap = new RegExp(`\\s*%\\s*(?=${escapeRegExp(suggestion)})`).exec(
			text.slice(open + 1),
		);
		if (!gap) return null;
		const at = start + open + 1 + gap.index;
		return fix(
			`Write the unit after a space: ${suggestion}`,
			at,
			at + gap[0].length,
			" ",
		);
	}

	if (w.code === "INVALID_DURATION") {
		// The range is the timer (`~pasta{15%min}`): its braces get the
		// duration as Gram reads it.
		const open = text.indexOf("{");
		const close = text.lastIndexOf("}");
		if (open === -1 || close < open) return null;
		return fix(
			`Replace with {${suggestion}}`,
			start + open + 1,
			start + close,
			suggestion,
		);
	}

	if (w.code === "REFERENCE_TO_INGREDIENT") {
		// The range starts at the `&`: an `@` before it makes `@&name`.
		if (!text.startsWith("&")) return null;
		return fix(`Write ${suggestion} (a raw ingredient)`, start, start, "@");
	}

	if (w.code === "INVALID_UNIT" && data.reason === "twoQuantities") {
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
		return fix(
			"Add the two quantities with ' + '",
			at,
			at + gap[2]!.length,
			" + ",
		);
	}

	if (w.code === "INVALID_QUANTITY") {
		const open = ctx.text.lastIndexOf("{", start);
		const close = ctx.text.indexOf("}", end);
		if (open === -1 || close === -1) return null;
		if (ctx.text.slice(open, start).includes("}")) return null;
		return fix(`Replace with {${suggestion}}`, open + 1, close, suggestion);
	}

	if (w.code === "SPACED_COMPOSITE") {
		// The range runs from the child to the parent: the gap is the last
		// `<` there with only blanks between it and the parent's `@`.
		const gaps = [...text.matchAll(/\s*<\s*(?=@)/g)];
		const gap = gaps.at(-1);
		if (gap?.index === undefined) return null;
		const at = start + gap.index;
		return fix(
			`Write ${suggestion} with no spaces`,
			at,
			at + gap[0].length,
			"<",
		);
	}

	if (w.code === "OZ_AFTER_VOLUME") {
		// The range is the term (`2 oz`): its unit starts at its first letter.
		const unitAt = text.search(/\p{L}/u);
		if (unitAt === -1) return null;
		return fix(
			`Write ${suggestion} (a volume)`,
			start + unitAt,
			end,
			suggestion,
		);
	}

	return null;
}

/**
 * Renames a deprecated frontmatter key to its replacement (`servings:` to
 * `portions:`), keeping its value. When the key Gram reads already is
 * another one (the replacement itself, or an earlier alias of it: `yield`
 * wins over `yields`, as in the HTML recipe), the line is removed instead:
 * renaming would write the key twice, and change which value is read.
 * Nothing for a key of an imported module (`data.specifier`): it is fixed
 * in that module, not here.
 */
function deprecatedKeyFix(ctx: FixContext, w: Warning): LintFix | null {
	const data = w.data as
		| { key?: string; suggestion?: string; specifier?: string }
		| undefined;
	if (!data?.key || !data.suggestion || data.specifier !== undefined)
		return null;
	const { key, suggestion } = data;
	const keys = scanFrontmatter(ctx.text)?.keys ?? [];
	const line = keys.find((k) => k.key === key);
	if (!line) return null;

	const written = new Set(keys.map((k) => k.key));
	const winner = [
		suggestion,
		...FRONTMATTER_KEYS.filter(
			(def) => def.deprecated?.replacement === suggestion,
		).map((def) => def.key),
	].find((k) => written.has(k));
	const rename = winner === key;
	return {
		title: rename
			? `Rename '${key}' to '${suggestion}'`
			: `Remove '${key}' ('${winner}' is the key read)`,
		edits: [
			rename
				? patch(ctx.uri, line.start, line.end, suggestion)
				: patch(ctx.uri, line.lineStart, line.lineEnd, ""),
		],
		isPreferred: true,
	};
}

/**
 * The name a `MODULE_EXPORT_NOT_FOUND` asks for. Its `loc` is the whole
 * `@use` line, which names several bindings in a destructured import
 * (`as { &a, &b }`): `composeRecipe` raises one warning per missing binding,
 * in the order written, so the warning's rank among those of the same line
 * is the rank of its binding among the missing ones. Null when the counts
 * disagree: no guess.
 */
function missingExport(
	ctx: FixContext,
	w: Warning,
	rank: number,
	count: number,
): { specifier: string; name: string; depUri: string } | null {
	const graph = ctx.moduleGraph;
	const loc = w.loc;
	if (!graph || !loc) return null;
	const imp = graph.modules
		.get(ctx.uri)
		?.imports.find(
			(i) => i.decl.loc?.start === loc.start && i.decl.loc?.end === loc.end,
		);
	const dep = imp ? graph.modules.get(imp.uri) : undefined;
	if (!imp || !dep) return null;
	const { exports } = computeExports(dep.ast);
	const missing = imp.decl.bindings.filter((b) => !exports.has(b.exported));
	if (missing.length !== count) return null;
	const binding = missing[rank];
	return binding
		? { specifier: imp.decl.specifier, name: binding.exported, depUri: imp.uri }
		: null;
}

/**
 * A name that exists in the imported module as a private, step-level `->&`:
 * append the missing section-level `->&name` to the header of the section
 * that declares it, when that section does not already export another name
 * (one `->&` per section, `SectionAST.intermediateDecl`). The fix lives in
 * the dependency, not in the checked file.
 */
function reExportFix(
	ctx: FixContext,
	w: Warning,
	rank: number,
	count: number,
): LintFix | null {
	const target = missingExport(ctx, w, rank, count);
	const dep = target ? ctx.moduleGraph?.modules.get(target.depUri) : undefined;
	if (!target || !dep) return null;
	const found = collectIntermediates(dep.ast).find(
		(d) => d.decl.name === target.name && d.step !== null,
	);
	if (!found || found.section.intermediateDecl || !found.section.loc)
		return null;
	const headerEnd = dep.source.indexOf("\n", found.section.loc.start);
	const at = headerEnd === -1 ? dep.source.length : headerEnd;
	return {
		title: `Re-export '&${target.name}' from "${target.specifier}"`,
		edits: [patch(target.depUri, at, at, ` ->&${target.name}`)],
	};
}

/** The name an `UNDEFINED_REFERENCE` is about, read from the AST at its `loc` (`&name`, `@&name`). */
function undefinedName(
	ast: RecipeAST,
	loc: { start: number; end: number },
): string | null {
	const same = (l?: { start: number; end: number }) =>
		l?.start === loc.start && l.end === loc.end;
	const visit = (nodes: readonly unknown[]): string | null => {
		for (const node of nodes as ASTNode[]) {
			if (isSection(node) || isStep(node)) {
				const found = visit(node.children);
				if (found) return found;
			} else if (isReference(node) && same(node.loc)) {
				// As kitchen reads it: sentence punctuation after the name is not part of it.
				return node.name.replace(/[.,!?;:]+$/, "");
			} else if (
				isIngredient(node) &&
				node.modifiers?.includes("&") &&
				same(node.loc)
			) {
				return node.name;
			}
		}
		return null;
	};
	return visit(ast.children);
}

/** Declares the missing intermediate at the end of the section that uses it. */
function declareFix(
	ctx: FixContext,
	loc: { start: number; end: number },
): LintFix | null {
	const name = undefinedName(ctx.ast, loc);
	if (!name) return null;
	const section = ctx.ast.children.find(
		(s) =>
			isSection(s) &&
			s.loc &&
			s.loc.start <= loc.start &&
			loc.start <= s.loc.end,
	);
	const at = section?.loc
		? lineStart(ctx.text, section.loc.end)
		: nextLineStart(ctx.text, loc.start);
	return {
		title: `Declare '->&${name}{}'`,
		edits: [patch(ctx.uri, at, at, `->&${name}{}\n`)],
	};
}

/**
 * The fixes of a compiler warning written in the checked file. `rank` and
 * `count` place it among the warnings of the same code and `loc` (see
 * `missingExport`).
 */
export function warningFixes(
	ctx: FixContext,
	w: Warning,
	rank: number,
	count: number,
): LintFix[] {
	const fixes: LintFix[] = [];
	const add = (fix: LintFix | null) => {
		if (fix) fixes.push(fix);
	};
	if (w.code === "DEPRECATED_FRONTMATTER_KEY") add(deprecatedKeyFix(ctx, w));
	if (w.code === "MODULE_EXPORT_NOT_FOUND")
		add(reExportFix(ctx, w, rank, count));
	if (w.loc) {
		add(quantityFix(ctx, w, w.loc));
		if (w.code === "UNDEFINED_REFERENCE") add(declareFix(ctx, w.loc));
	}
	return fixes;
}

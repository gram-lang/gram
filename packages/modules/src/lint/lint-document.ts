import {
	type CompilationResult,
	slugify,
	type Warning,
	WarningCode,
	warningTemplates,
} from "@gram-lang/kitchen";
import type { RecipeAST } from "@gram-lang/parser";
import type { ModuleGraph } from "../host";
import { applyLintConfig, ignoreRanges, type LintConfig } from "./config";
import { warningFixes } from "./fixes";
import { diagnosticInfoOf, docUrlOf } from "./registry";
import {
	type LintIngredientDB,
	missingTitle,
	type RuleDiagnostic,
	unknownIngredients,
	unusedIntermediates,
} from "./rules";
import type { LintDiagnostic } from "./types";
import { scanFrontmatter } from "./frontmatter-text";
import type { LintIngredientsFile } from "./ingredients-file";
import {
	lostIngredients,
	mergedStepLines,
	suspectIngredientNames,
	unreadFrontmatter,
} from "./rules-writing";

/**
 * What `lintDocument` checks: one document, as its caller already parsed,
 * composed and compiled it. Nothing is read from disk here.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export interface LintInput {
	/** The checked document; every diagnostic is shown in it. */
	uri: string;
	text: string;
	/** Its own AST (not the composed one); null when it does not parse. */
	ast: RecipeAST | null;
	/** Why it does not parse (`GramParseError`), and where when known. */
	parseError?: { message: string; offset: number | null } | null;
	/**
	 * The compiled (or analyzed) recipe, whose `warnings` are reported and
	 * whose `registry` tells which written ingredients were read
	 * (`LOST_INGREDIENT`).
	 */
	compilation?: {
		warnings?: Warning[];
		registry?: Pick<CompilationResult, "registry">["registry"];
	} | null;
	/** Why `compile()` / `analyze()` failed on an AST that parses. */
	compileError?: string | null;
	/** The `@use` graph the compilation was composed against. */
	moduleGraph?: ModuleGraph;
	/** The ingredient database (`UNKNOWN_INGREDIENT`); none, no check. */
	ingredientDB?: LintIngredientDB;
	/**
	 * The file that database was read from, with its current text: an
	 * `UNKNOWN_INGREDIENT` then gets a fix that adds the ingredient to it.
	 * Absent: no such fix (an editor computing only its diagnostics need not
	 * read it).
	 */
	ingredientsFile?: LintIngredientsFile;
	/** The project's `lint:` settings (`parseLintConfig`). */
	config?: LintConfig;
}

/**
 * The compiler codes an editor leaves out when they carry no position: they
 * are computed from the analyzer's flat ingredient list, which keeps none,
 * and would otherwise all sit on the first line. `gram check` shows them.
 *
 * @experimental
 */
export const EDITOR_HIDDEN_CODES: ReadonlySet<string> = new Set([
	"MISSING_INGREDIENT",
	"MISSING_MACROS",
	"UNKNOWN_MASS",
]);

/**
 * Where a deprecated key of this file's own frontmatter is written: the
 * warning has no `loc` (the AST keeps no position for the frontmatter's
 * keys), so its `data.key` is looked up in the text. Null for any other
 * warning, and for a key raised by an imported module (`data.specifier`),
 * which stays on its `@use` line.
 */
function ownFrontmatterKey(
	text: string,
	w: Warning,
): { start: number; end: number } | null {
	if (w.code !== "DEPRECATED_FRONTMATTER_KEY") return null;
	if (w.data?.specifier !== undefined) return null;
	const at = scanFrontmatter(text)?.keys.find((k) => k.key === w.data?.key);
	return at ? { start: at.start, end: at.end } : null;
}

/**
 * A compiler `Warning`, as a diagnostic of the checked file. One whose
 * `loc.uri` names another file (a dependency pulled in by `@use`, module-imports
 * RFC §B.3) is anchored on the `@use` line that imports it, or at the top of
 * the file for a deeper, transitive one, and its real position goes into
 * `related`: an offset of that file read against this one would land
 * anywhere.
 */
function fromWarning(
	input: LintInput,
	w: Warning,
	rank: number,
	count: number,
): RuleDiagnostic {
	const info = diagnosticInfoOf(w.code);
	const warnUri = w.loc?.uri ?? input.uri;

	if (warnUri === input.uri) {
		const loc = w.loc ?? ownFrontmatterKey(input.text, w);
		const fixes = input.ast
			? warningFixes(
					{
						uri: input.uri,
						text: input.text,
						ast: input.ast,
						moduleGraph: input.moduleGraph,
					},
					w,
					rank,
					count,
				)
			: [];
		return {
			code: w.code,
			...(loc ? { loc: { start: loc.start, end: loc.end } } : {}),
			message: w.message,
			...(w.data ? { data: w.data } : {}),
			// Struck through where the deprecated form is written: not on the
			// `@use` line of a module that writes it.
			...(info.deprecated && w.data?.specifier === undefined
				? { deprecated: true as const }
				: {}),
			...(fixes.length > 0 ? { fixes } : {}),
		};
	}

	const imp = input.moduleGraph?.modules
		.get(input.uri)
		?.imports.find((i) => i.uri === warnUri);
	const anchor = imp?.decl.loc;
	const depKnown = input.moduleGraph?.modules.has(warnUri) ?? false;
	return {
		code: w.code,
		...(anchor ? { loc: { start: anchor.start, end: anchor.end } } : {}),
		message: w.message,
		related: [
			{
				uri: warnUri,
				...(depKnown && w.loc
					? { loc: { start: w.loc.start, end: w.loc.end } }
					: {}),
				message: w.message,
			},
		],
	};
}

/**
 * Every diagnostic of one document, in one list: its parse error, or else
 * its compile error, the compiler's warnings (kitchen, the analyzer,
 * modules) and the lint layer's own rules, each with its severity, its
 * `docUrl` and the fixes that apply. The project's settings come last: a
 * code set to `off`, or named by a `// gram-ignore` above its block, is left
 * out; an `error` never is. The language server and `gram check` both read
 * this list, so they always agree.
 *
 * Never throws on what the parser accepts.
 *
 * @experimental
 */
export function lintDocument(input: LintInput): LintDiagnostic[] {
	// The rules scan the text for `\n` (`\r\n` ends with one). A lone `\r`
	// (old Mac line ending) becomes a `\n` for them: same length, so every
	// offset still points at the same place of the real text. Their fixes
	// write `\n`, put back in the line ending of the file.
	if (!input.text.includes("\r")) return lintLineFeeds(input);
	const text = input.text.replace(/\r(?!\n)/g, "\n");
	return lintLineFeeds(text === input.text ? input : { ...input, text }).map(
		(d) => withLineEndings(d, input.uri, input.text),
	);
}

/**
 * The line ending a fix writes at `offset` of `text`: that of the last line
 * break before it, else the first one of the text. In a file that mixes
 * them, a `\n` written right after a lone `\r` would join it into one
 * `\r\n` instead of adding a line.
 */
function lineEndingAt(text: string, offset: number): string {
	const kindAt = (i: number) =>
		text[i] === "\n"
			? text[i - 1] === "\r"
				? "\r\n"
				: "\n"
			: text[i + 1] === "\n"
				? "\r\n"
				: "\r";
	for (let i = offset - 1; i >= 0; i--)
		if (text[i] === "\n" || text[i] === "\r") return kindAt(i);
	const first = text.search(/[\r\n]/);
	return first === -1 ? "\n" : kindAt(first);
}

/** `d` with the line breaks its fixes write into `uri` in the line endings of `text`. */
function withLineEndings(
	d: LintDiagnostic,
	uri: string,
	text: string,
): LintDiagnostic {
	if (!d.fixes) return d;
	return {
		...d,
		fixes: d.fixes.map((fix) => ({
			...fix,
			edits: fix.edits.map((edit) =>
				edit.kind === "patch" && edit.uri === uri
					? {
							...edit,
							patches: edit.patches.map((p) => {
								const eol = lineEndingAt(text, p.start);
								return {
									...p,
									replacement: p.replacement.replace(/\r\n|\r|\n/g, eol),
								};
							}),
						}
					: edit,
			),
		})),
	};
}

/** `lintDocument` on a text whose line breaks all end with `\n`. */
function lintLineFeeds(input: LintInput): LintDiagnostic[] {
	const found: RuleDiagnostic[] = [];

	if (input.parseError) {
		const offset = input.parseError.offset;
		found.push({
			code: "PARSE_ERROR",
			...(offset !== null ? { loc: { start: offset, end: offset + 1 } } : {}),
			message: input.parseError.message,
		});
		return finish(input, found);
	}
	const ast = input.ast;
	if (!ast) return [];

	if (input.compileError != null) {
		found.push({ code: "COMPILE_ERROR", message: input.compileError });
	}

	const warnings = input.compilation?.warnings ?? [];
	const key = (w: Warning) =>
		`${w.code}\0${w.loc?.uri ?? ""}\0${w.loc?.start}\0${w.loc?.end}`;
	const counts = new Map<string, number>();
	for (const w of warnings) counts.set(key(w), (counts.get(key(w)) ?? 0) + 1);
	const ranks = new Map<string, number>();
	for (const w of warnings) {
		const rank = ranks.get(key(w)) ?? 0;
		ranks.set(key(w), rank + 1);
		found.push(fromWarning(input, w, rank, counts.get(key(w))!));
	}

	const ctx = { uri: input.uri, text: input.text, ast };
	found.push(...unusedIntermediates(ctx));
	const unknown = unknownIngredients(
		ctx,
		input.ingredientDB,
		input.ingredientsFile,
	);
	found.push(...unknown);
	const registry = input.compilation?.registry;
	found.push(...lostIngredients(ctx, registry ? { registry } : undefined));
	found.push(...mergedStepLines(ctx));
	found.push(...suspectIngredientNames(ctx));
	const unread = unreadFrontmatter(ctx);
	found.push(...unread);
	// A title written in a frontmatter that is not read is not missing: the
	// block's own diagnostic says why it is not seen.
	const titleWritten =
		unread.length > 0 &&
		(scanFrontmatter(input.text)?.keys.some((k) => k.key === "title") ?? false);
	if (!titleWritten) found.push(...missingTitle(ctx));

	return applyLintConfig(
		finish(input, withoutCoveredMissing(found, unknown)),
		input.config,
		ignoreRanges(ast, input.text),
	);
}

/**
 * Leaves out the analyzer's `MISSING_INGREDIENT` of an ingredient this file
 * already flags as `UNKNOWN_INGREDIENT`, on each of its mentions: the same
 * verdict twice, once without a position. One of an ingredient that only an
 * imported module writes is kept, as nothing else reports it. The editor
 * hides `MISSING_INGREDIENT` anyway (`EDITOR_HIDDEN_CODES`); `gram check`
 * shows the rest.
 */
function withoutCoveredMissing(
	found: RuleDiagnostic[],
	unknown: RuleDiagnostic[],
): RuleDiagnostic[] {
	if (unknown.length === 0) return found;
	// The warning carries its id only in its message (no `data`, so the
	// compiled JSON stays as it is): the message each flagged id would get is
	// rendered from the same template and compared whole.
	const flagged = new Set(
		unknown.map((d) =>
			warningTemplates[WarningCode.MISSING_INGREDIENT]({
				id: slugify(String(d.data?.name)),
			}),
		),
	);
	return found.filter(
		(d) => d.code !== "MISSING_INGREDIENT" || !flagged.has(d.message),
	);
}

/** Gives each diagnostic its uri, the severity of its code and its `docUrl`. */
function finish(input: LintInput, found: RuleDiagnostic[]): LintDiagnostic[] {
	return found.map((d) => ({
		...d,
		uri: input.uri,
		severity: diagnosticInfoOf(d.code).severity,
		docUrl: docUrlOf(d.code),
	}));
}

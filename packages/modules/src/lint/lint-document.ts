import type { Warning } from "@gram-lang/kitchen";
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
	/** The compiled (or analyzed) recipe, whose `warnings` are reported. */
	compilation?: { warnings?: Warning[] } | null;
	/** Why `compile()` / `analyze()` failed on an AST that parses. */
	compileError?: string | null;
	/** The `@use` graph the compilation was composed against. */
	moduleGraph?: ModuleGraph;
	/** The ingredient database (`UNKNOWN_INGREDIENT`); none, no check. */
	ingredientDB?: LintIngredientDB;
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
	found.push(...unknownIngredients(ctx, input.ingredientDB));
	found.push(...missingTitle(ctx));

	return applyLintConfig(
		finish(input, found),
		input.config,
		ignoreRanges(ast, input.text),
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

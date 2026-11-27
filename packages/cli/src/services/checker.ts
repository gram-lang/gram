import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pLimit from "p-limit";
import {
	applyPreferredFixes,
	buildLineIndex,
	type LintConfig,
	type LintDiagnostic,
	type LintSeverity,
	diagnosticInfoOf,
	docUrlOf,
	lintDocument,
	offsetToPosition,
} from "@gram-lang/modules/lint";
import { readLintConfig } from "../core/lint-config";
import { runLintPipeline } from "../core/pipeline";
import type {
	CheckDiagnostic,
	CheckOptions,
	CheckPosition,
	CheckResult,
} from "../types";
import { getErrorMessage } from "../errors";

/** What a diagnostic counts as: `--strict` makes an error of all but a hint. */
function levelOf(severity: LintSeverity, strict: boolean | undefined) {
	return strict && severity !== "hint" ? "error" : severity;
}

/** A located span of `text`, lines and UTF-16 columns from 1. */
function positionIn(
	lineStarts: number[],
	loc: { start: number; end: number },
): CheckPosition {
	const start = offsetToPosition(lineStarts, loc.start);
	const end = offsetToPosition(lineStarts, loc.end);
	return {
		line: start.line + 1,
		col: start.character + 1,
		endLine: end.line + 1,
		endCol: end.character + 1,
	};
}

/** Unlocated first (they sit at the top of the file), then in text order. */
function byPosition(a: LintDiagnostic, b: LintDiagnostic): number {
	return (
		(a.loc?.start ?? -1) - (b.loc?.start ?? -1) ||
		(a.loc?.end ?? -1) - (b.loc?.end ?? -1)
	);
}

/** The passes `gram check --fix` makes at most on one file. */
export const FIX_MAX_PASSES = 5;

type LintConfigOf = (projectRoot: string) => Promise<LintConfig>;

/**
 * `lintDocument` on the file as the language server prepares it (its own
 * AST, the composed and analyzed compilation, the `@use` graph, the
 * database and the project's `lint:` settings), so both report the same
 * codes at the same places. `entryText`, when given, is linted in place of
 * the file on disk. Throws only when the file cannot be read.
 */
async function lintFile(
	file: string,
	opts: CheckOptions,
	lintConfigOf: LintConfigOf,
	entryText?: string,
) {
	const prepared = await runLintPipeline(file, {
		db: opts.db,
		paths: opts.paths,
		stock: opts.stock,
		...(entryText !== undefined ? { entryText } : {}),
	});
	const found = lintDocument({
		uri: prepared.uri,
		text: prepared.text,
		ast: prepared.ast,
		parseError: prepared.parseError,
		compilation: prepared.compilation,
		compileError: prepared.compileError,
		moduleGraph: prepared.moduleGraph,
		...(opts.db ? { ingredientDB: opts.db } : {}),
		config: await lintConfigOf(prepared.projectRoot),
	});
	return { prepared, found };
}

/**
 * `gram check --fix` on one linted file: applies the preferred fixes
 * (`applyPreferredFixes`: patches of this file only, never a new file nor a
 * `@use` dependency) and lints the fixed text again, in memory, until a
 * pass applies nothing or `maxPasses` passes were made. A code turned
 * `off` or named by a `// gram-ignore` has no diagnostic, so no fix. The
 * file is written once, at the end, and only when its text changed.
 */
async function fixFile(
	file: string,
	opts: CheckOptions,
	lintConfigOf: LintConfigOf,
	linted: Awaited<ReturnType<typeof lintFile>>,
): Promise<{ linted: Awaited<ReturnType<typeof lintFile>>; fixed: number }> {
	const original = linted.prepared.text;
	const maxPasses = opts.maxFixPasses ?? FIX_MAX_PASSES;
	let fixed = 0;
	for (let pass = 0; pass < maxPasses; pass++) {
		const { text, applied } = applyPreferredFixes(
			linted.prepared.text,
			linted.prepared.uri,
			linted.found,
		);
		// Nothing applied: `linted` already holds the final text's diagnostics.
		if (applied.length === 0) break;
		fixed += applied.length;
		linted = await lintFile(file, opts, lintConfigOf, text);
	}
	if (linted.prepared.text !== original)
		await writeFile(linted.prepared.uri, linted.prepared.text, "utf-8");
	return { linted, fixed };
}

/**
 * One file's diagnostics (after its fixes, with `--fix`). A file that
 * cannot be read is one `COMPILE_ERROR`, and is never fixed.
 */
async function checkFile(
	file: string,
	opts: CheckOptions,
	lintConfigOf: LintConfigOf,
): Promise<{
	diagnostics: CheckDiagnostic[];
	usedStock: Set<string>;
	fixed: number;
}> {
	let linted: Awaited<ReturnType<typeof lintFile>>;
	let fixed = 0;
	try {
		linted = await lintFile(file, opts, lintConfigOf);
		if (opts.fix)
			({ linted, fixed } = await fixFile(file, opts, lintConfigOf, linted));
	} catch (err) {
		const severity = diagnosticInfoOf("COMPILE_ERROR").severity;
		return {
			diagnostics: [
				{
					code: "COMPILE_ERROR",
					severity,
					level: levelOf(severity, opts.strict),
					uri: resolve(file),
					file: resolve(file),
					message: getErrorMessage(err),
					docUrl: docUrlOf("COMPILE_ERROR"),
				},
			],
			usedStock: new Set(),
			fixed: 0,
		};
	}
	const { prepared, found } = linted;

	const lineStarts = buildLineIndex(prepared.text);
	const depLineStarts = new Map<string, number[]>();
	const linesOf = (uri: string): number[] | undefined => {
		const source = prepared.sources.get(uri);
		if (source === undefined) return undefined;
		const known = depLineStarts.get(uri);
		if (known) return known;
		const starts = buildLineIndex(source);
		depLineStarts.set(uri, starts);
		return starts;
	};

	const diagnostics = [...found].sort(byPosition).map(
		({ related, ...d }): CheckDiagnostic => ({
			...d,
			file: prepared.uri,
			level: levelOf(d.severity, opts.strict),
			...(d.loc ? positionIn(lineStarts, d.loc) : {}),
			...(related
				? {
						related: related.map((r) => {
							const starts = linesOf(r.uri);
							return {
								...r,
								file: r.uri,
								...(starts && r.loc ? positionIn(starts, r.loc) : {}),
							};
						}),
					}
				: {}),
		}),
	);
	return { diagnostics, usedStock: prepared.usedStock, fixed };
}

export async function checkFiles(
	files: string[],
	opts: CheckOptions = {},
): Promise<CheckResult> {
	// One file at a time with `--fix`: a file is never read as another's
	// `@use` dependency while it is being rewritten.
	const limit = pLimit(opts.fix ? 1 : 20);
	const configs = new Map<string, Promise<LintConfig>>();
	const lintConfigOf = (projectRoot: string) => {
		let config = configs.get(projectRoot);
		if (!config) {
			config = readLintConfig(projectRoot);
			configs.set(projectRoot, config);
		}
		return config;
	};

	// Filled by index, not pushed as each file finishes: the report reads the
	// same from one run to the next, whatever order the checks end in.
	const perFile = await Promise.all(
		files.map((file) => limit(() => checkFile(file, opts, lintConfigOf))),
	);

	const usedStock = new Set<string>();
	for (const { usedStock: used } of perFile)
		for (const u of used) usedStock.add(u);
	const diagnostics = perFile.flatMap((r) => r.diagnostics);

	return {
		files,
		diagnostics,
		hasErrors: diagnostics.some((d) => d.level === "error"),
		fileCount: files.length,
		...(opts.fix
			? {
					fixed: new Map(
						files.map((file, i) => [resolve(file), perFile[i]!.fixed]),
					),
				}
			: {}),
		usedStock,
	};
}

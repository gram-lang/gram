import { resolve } from "node:path";
import pLimit from "p-limit";
import {
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

/**
 * One file's diagnostics: `lintDocument` on the file as the language server
 * prepares it (its own AST, the composed and analyzed compilation, the
 * `@use` graph, the database and the project's `lint:` settings), so both
 * report the same codes at the same places. A file that cannot be read is
 * one `COMPILE_ERROR`.
 */
async function checkFile(
	file: string,
	opts: CheckOptions,
	lintConfigOf: (projectRoot: string) => Promise<LintConfig>,
): Promise<{ diagnostics: CheckDiagnostic[]; usedStock: Set<string> }> {
	let prepared: Awaited<ReturnType<typeof runLintPipeline>>;
	try {
		prepared = await runLintPipeline(file, {
			db: opts.db,
			paths: opts.paths,
			stock: opts.stock,
		});
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
		};
	}

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
	return { diagnostics, usedStock: prepared.usedStock };
}

export async function checkFiles(
	files: string[],
	opts: CheckOptions = {},
): Promise<CheckResult> {
	const limit = pLimit(20);
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
		usedStock,
	};
}

import { relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { FileEdit, LintFix } from "@gram-lang/modules/lint";
import type { CheckDiagnostic, CheckRelated, CheckResult } from "../types";

/**
 * The version of the `gram check --format json` report. Adding a field is
 * not a change of version; renaming, removing or retyping one is, and moves
 * it to 2 (the shape is pinned by a snapshot in `tests/check-json.test.ts`).
 */
export const CHECK_REPORT_VERSION = 1;

/** A path as the report writes it: relative to `cwd`, with `/` separators. */
export function reportPath(file: string, cwd = process.cwd()): string {
	return (relative(cwd, file) || file).split(sep).join("/");
}

const fileUrl = (path: string) => pathToFileURL(path).href;

function edit(e: FileEdit): FileEdit {
	return { ...e, uri: fileUrl(e.uri) };
}

function fix(f: LintFix): LintFix {
	return { ...f, edits: f.edits.map(edit) };
}

function related(r: CheckRelated, cwd: string) {
	return {
		file: reportPath(r.file, cwd),
		...(r.line !== undefined
			? { line: r.line, col: r.col, endLine: r.endLine, endCol: r.endCol }
			: {}),
		uri: fileUrl(r.uri),
		...(r.loc ? { loc: r.loc } : {}),
		message: r.message,
	};
}

/**
 * One diagnostic in the report: the fields of `LintDiagnostic`, its `uri`
 * (and every uri it names) as a `file://` URL like the language server's,
 * plus `file` (relative to `cwd`) and, when it has a `loc`, `line`, `col`,
 * `endLine` and `endCol`, from 1, columns in UTF-16 code units.
 */
function diagnostic(d: CheckDiagnostic, cwd: string) {
	return {
		file: reportPath(d.file, cwd),
		...(d.line !== undefined
			? { line: d.line, col: d.col, endLine: d.endLine, endCol: d.endCol }
			: {}),
		code: d.code,
		severity: d.severity,
		message: d.message,
		uri: fileUrl(d.uri),
		...(d.loc ? { loc: d.loc } : {}),
		...(d.data ? { data: d.data } : {}),
		docUrl: d.docUrl,
		...(d.deprecated ? { deprecated: true } : {}),
		...(d.related ? { related: d.related.map((r) => related(r, cwd)) } : {}),
		...(d.fixes ? { fixes: d.fixes.map(fix) } : {}),
	};
}

/** The `gram check --format json` report (`version: 1`). */
export function checkReport(result: CheckResult, cwd = process.cwd()) {
	return {
		version: CHECK_REPORT_VERSION,
		files: result.files.map((file) => ({
			file: reportPath(file, cwd),
			uri: fileUrl(file),
		})),
		diagnostics: result.diagnostics.map((d) => diagnostic(d, cwd)),
	};
}

/** The report of a run that found no file to check. */
export function emptyCheckReport(): ReturnType<typeof checkReport> {
	return { version: CHECK_REPORT_VERSION, files: [], diagnostics: [] };
}

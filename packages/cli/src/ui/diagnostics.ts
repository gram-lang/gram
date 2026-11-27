import chalk from "chalk";
import { log } from "@clack/prompts";
import type { LintSeverity } from "@gram-lang/modules/lint";
import type { CheckDiagnostic, CheckResult } from "../types";
import { reportPath } from "./check-report";
import type { IngredientValidationIssue } from "@gram-lang/analyzer";

/**
 * `core/db.ts`'s `loadDb` returns `rejected` as plain data instead of
 * writing a warning itself — this is the single place that decides how (and
 * whether) to report it, shared by every command instead of duplicating the
 * message format at 15 call sites. Always writes to stderr, never stdout —
 * `gram build | jq` and friends must stay parseable regardless of database
 * validation problems.
 */
export function reportRejectedIngredients(
	rejected: IngredientValidationIssue[],
	dbPath: string,
): void {
	if (rejected.length === 0) return;
	process.stderr.write(
		`Ignoring ${rejected.length} invalid ingredient(s) in ${dbPath}: ${rejected.map((r) => r.key).join(", ")}\n`,
	);
}

function groupByFile(
	diagnostics: CheckDiagnostic[],
): Map<string, CheckDiagnostic[]> {
	const map = new Map<string, CheckDiagnostic[]>();
	for (const d of diagnostics) {
		const bucket = map.get(d.file) ?? [];
		bucket.push(d);
		map.set(d.file, bucket);
	}
	return map;
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

/** `line:col`, or `-` for a diagnostic of the whole file. */
function where(d: { line?: number; col?: number }): string {
	return d.line !== undefined ? `${d.line}:${d.col}` : "-";
}

const ICONS: Record<LintSeverity, string> = {
	error: chalk.red("✗"),
	warning: chalk.yellow("⚠"),
	info: chalk.blue("·"),
	hint: chalk.dim("·"),
};

/**
 * `gram check`'s terminal report: each file with its diagnostics, in text
 * order, as `line:col  ✗ message  CODE`, a cause found in a `@use`
 * dependency on the next line (`↳ see base.gram:12:4`), then the count of
 * each level. The icon is the level (`--strict` makes errors of all but the
 * hints); the JSON report lists the same diagnostics.
 */
export function renderCheckResult(result: CheckResult): void {
	if (result.diagnostics.length === 0) {
		log.success(`${plural(result.fileCount, "file")} valid.`);
		return;
	}

	for (const [file, diags] of groupByFile(result.diagnostics)) {
		console.log();
		console.log(chalk.bold(reportPath(file)));
		const width = Math.max(...diags.map((d) => where(d).length));
		for (const d of diags) {
			console.log(
				`  ${chalk.dim(where(d).padEnd(width))}  ${ICONS[d.level]} ${d.message}  ${chalk.dim(d.code)}`,
			);
			for (const r of d.related ?? []) {
				const at = r.line !== undefined ? `:${r.line}:${r.col}` : "";
				console.log(
					`  ${" ".repeat(width)}    ${chalk.dim(`↳ see ${reportPath(r.file)}${at}`)}`,
				);
			}
		}
	}

	const count = (level: LintSeverity) =>
		result.diagnostics.filter((d) => d.level === level).length;
	const errors = count("error");
	const parts = [
		errors ? chalk.red(plural(errors, "error")) : "",
		count("warning") ? chalk.yellow(plural(count("warning"), "warning")) : "",
		count("info") ? chalk.blue(plural(count("info"), "info")) : "",
		count("hint") ? chalk.dim(plural(count("hint"), "hint")) : "",
	].filter(Boolean);

	console.log();
	const summary = `${parts.join(", ")} in ${plural(result.fileCount, "file")}.`;
	if (errors > 0) log.error(summary);
	else log.warn(summary);
}

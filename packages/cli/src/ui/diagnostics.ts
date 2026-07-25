import chalk from "chalk";
import { log } from "@clack/prompts";
import { relative } from "node:path";
import type { CheckResult, Diagnostic } from "../types";
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

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
	const map = new Map<string, Diagnostic[]>();
	for (const d of diagnostics) {
		const bucket = map.get(d.file) ?? [];
		bucket.push(d);
		map.set(d.file, bucket);
	}
	return map;
}

function displayPath(file: string): string {
	return relative(process.cwd(), file) || file;
}

export function renderCheckResult(result: CheckResult): void {
	if (result.diagnostics.length === 0) {
		const n = result.fileCount;
		log.success(`${n} file${n !== 1 ? "s" : ""} valid.`);
		return;
	}

	for (const [file, diags] of groupByFile(result.diagnostics)) {
		console.log();
		console.log(chalk.bold(displayPath(file)));

		const byCategory = new Map<string, Diagnostic[]>();
		for (const d of diags) {
			const bucket = byCategory.get(d.category) ?? [];
			bucket.push(d);
			byCategory.set(d.category, bucket);
		}

		for (const [category, catDiags] of byCategory) {
			console.log(chalk.dim(`  [${category}]`));
			for (const d of catDiags) {
				const loc =
					d.line != null
						? chalk.dim(`  line ${String(d.line).padEnd(2)} `)
						: "  ";
				const icon =
					d.level === "error"
						? chalk.red("✗")
						: d.level === "warning"
							? chalk.yellow("⚠")
							: chalk.blue("·");
				console.log(`  ${loc}${icon} ${d.message}`);
			}
		}
	}

	const errCount = result.diagnostics.filter((d) => d.level === "error").length;
	const warnCount = result.diagnostics.filter(
		(d) => d.level === "warning",
	).length;

	const parts: string[] = [];
	if (errCount)
		parts.push(chalk.red(`${errCount} error${errCount !== 1 ? "s" : ""}`));
	if (warnCount)
		parts.push(
			chalk.yellow(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`),
		);

	console.log();
	if (errCount > 0) {
		log.error(
			`${parts.join(", ")} in ${result.fileCount} file${result.fileCount !== 1 ? "s" : ""}.`,
		);
	} else {
		log.warn(
			`${parts.join(", ")} in ${result.fileCount} file${result.fileCount !== 1 ? "s" : ""}.`,
		);
	}
}

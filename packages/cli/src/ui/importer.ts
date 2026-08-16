import chalk from "chalk";
import { log } from "@clack/prompts";
import { relative } from "node:path";
import type { Writable } from "node:stream";
import type { ImportResult } from "../types";

/**
 * `out` is where the chrome goes. With `--output` that is stdout as usual;
 * without it, the recipe itself owns stdout and everything here must go to
 * stderr instead, or it ends up inside the piped .gram file.
 */
function writer(out: Writable | undefined) {
	return (line = "") => {
		if (out) out.write(`${line}\n`);
		else console.log(line);
	};
}

export function renderImportResult(
	result: ImportResult,
	source: string,
	outputPath?: string,
	out?: Writable,
): void {
	const sourceLabel = source.startsWith("http")
		? source
		: relative(process.cwd(), source) || source;
	const line = writer(out);

	line();
	line(`  ${"Title".padEnd(14)} ${result.title}`);
	line(`  ${"Ingredients".padEnd(14)} ${result.ingredientCount}`);
	line(`  ${"Steps".padEnd(14)} ${result.stepCount}`);

	if (result.parseWarnings.length > 0) {
		line();
		line(chalk.yellow("  ⚠ Warnings:"));
		for (const w of result.parseWarnings) line(`    ${chalk.dim(w)}`);
	}

	// Gaps in the data, not defects in the recipe: an ingredient your database
	// has never seen, a volume with no density to convert it. Listed separately
	// so they don't read as something the import got wrong.
	if (result.analysisGaps.length > 0) {
		line();
		line(chalk.yellow("  ⚠ Not yet resolvable against your database:"));
		for (const g of result.analysisGaps) line(`    ${chalk.dim(g)}`);
	}

	line();

	if (outputPath) {
		log.success(
			`Written to ${chalk.dim(relative(process.cwd(), outputPath) || outputPath)}`,
			{ output: out },
		);
		line(
			chalk.dim(
				`  → Run \`gram db sync\` to register any new ingredients, then \`gram check ${relative(process.cwd(), outputPath)}\` and adjust quantities manually.`,
			),
		);
	} else {
		log.info(`Imported from ${chalk.dim(sourceLabel)} — output on stdout`, {
			output: out,
		});
	}
}

/**
 * The two problems that mean "do not trust this file", printed together
 * because they answer the same question: is anything actually broken?
 *
 * Kept apart from renderImportResult because these are shown *before* deciding
 * whether to emit anything, whereas the summary above reports on a result
 * already accepted.
 */
export function renderImportProblems(
	result: ImportResult,
	out?: Writable,
): void {
	const line = writer(out);

	if (result.lostIngredients.length > 0) {
		line();
		line(
			chalk.red(
				`  ✖ ${result.lostIngredients.length} ingredient(s) written by the AI never reached the compiler:`,
			),
		);
		for (const i of result.lostIngredients) line(`    ${i}`);
		line(
			chalk.dim(
				"    Usually a `//` comment mid-sentence, which hides everything after it on that line.",
			),
		);
	}

	if (result.unresolvedErrors.length > 0) {
		line();
		line(chalk.red("  ✖ Errors the AI could not fix:"));
		for (const e of result.unresolvedErrors) line(`    ${e}`);
	}

	line();
}

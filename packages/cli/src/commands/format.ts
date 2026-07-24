import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import { log } from "@clack/prompts";
import chalk from "chalk";
import pLimit from "p-limit";
import { resolveGlob } from "../core/glob";
import { withFileLock, atomicWrite } from "../core/lock";
import { formatGram, hasChanges, summarizeChanges } from "@gram-lang/format";
import { ExitCode, GramCLIError, getErrorMessage } from "../errors";

export default defineCommand({
	meta: {
		name: "format",
		description: "Format .gram recipe files",
	},
	args: {
		pattern: {
			type: "positional",
			description: "File path or glob pattern (default: **/*.gram)",
			required: false,
		},
		check: {
			type: "boolean",
			description:
				"Check formatting without writing changes (exit 1 if any file needs formatting)",
			default: false,
		},
	},
	async run({ args }) {
		const patterns =
			(args._ as string[]).length > 0 ? (args._ as string[]) : ["**/*.gram"];
		let files: string[];
		try {
			files = await resolveGlob(patterns);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		const isCheck = args.check as boolean;

		// Parallelized like builder.ts/db-sync.ts, but results are collected and
		// printed in the original file order afterward so console output stays
		// deterministic regardless of which file finishes reading/formatting first.
		const limit = pLimit(20);
		const results = await Promise.all(
			files.map((file) =>
				limit(async () => {
					let source: string;
					try {
						source = await readFile(file, "utf-8");
					} catch (err) {
						return {
							file,
							status: "error" as const,
							message: getErrorMessage(err),
						};
					}

					const { content, changes } = formatGram(source);
					if (!hasChanges(changes)) {
						return { file, status: "unchanged" as const };
					}

					if (!isCheck) {
						// Same write discipline as db-sync/db-linter/db-merger (audit
						// 2026-07-22, finding 0-b): a destructive in-place rewrite of a
						// user's file must be lock-guarded and atomic, not a bare
						// writeFile that can leave a half-written file on crash.
						await withFileLock(file, () => atomicWrite(file, content));
					}
					return {
						file,
						status: "changed" as const,
						summary: summarizeChanges(changes),
					};
				}),
			),
		);

		let needsFormatting = 0;

		console.log();
		for (const result of results) {
			if (result.status === "error") {
				log.error(`Cannot read ${result.file}: ${result.message}`);
				continue;
			}
			if (result.status === "unchanged") {
				console.log(
					`  ${chalk.green("✔")} ${chalk.dim(result.file)}  ${chalk.dim("already formatted")}`,
				);
				continue;
			}

			needsFormatting++;
			if (isCheck) {
				console.log(
					`  ${chalk.yellow("✗")} ${result.file}  ${chalk.dim(result.summary)}`,
				);
			} else {
				console.log(
					`  ${chalk.green("✔")} ${result.file}  ${chalk.dim(result.summary)}`,
				);
			}
		}

		console.log();

		if (isCheck && needsFormatting > 0) {
			log.warn(
				`${needsFormatting} file${needsFormatting > 1 ? "s" : ""} need formatting. Run \`gram format\` to fix.`,
			);
			process.exit(ExitCode.Error);
		}

		if (!isCheck && needsFormatting > 0) {
			log.success(
				`Formatted ${needsFormatting} file${needsFormatting > 1 ? "s" : ""}.`,
			);
		}
	},
});

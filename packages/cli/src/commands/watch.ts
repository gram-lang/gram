import { defineCommand } from "citty";
import { watch } from "node:fs";
import { resolve, extname, relative, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import chalk from "chalk";
import { log } from "@clack/prompts";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { findProjectRoot } from "../core/workspace";
import {
	buildWatchReverseIndex,
	transitiveDependents,
} from "../core/watch-graph";
import { reportRejectedIngredients } from "../ui/diagnostics";
import { checkFiles } from "../services/checker";
import { buildFiles } from "../services/builder";
import { getErrorMessage } from "../errors";

export default defineCommand({
	meta: {
		name: "watch",
		version,
		description: "Watch .gram files and re-run check on every change",
	},
	args: {
		dir: {
			type: "positional",
			required: false,
			description: "Directory to watch (default: project root)",
		},
		build: {
			type: "boolean",
			description: "Also build changed files to JSON (requires --output)",
			default: false,
		},
		output: {
			type: "string",
			alias: "o",
			description: "Output directory for built JSON files (used with --build)",
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML",
		},
		"skip-db": {
			type: "boolean",
			description: "Skip ingredient database enrichment",
			default: false,
		},
	},
	async run({ args }) {
		const root = await findProjectRoot();
		const watchDir = args.dir ? resolve(args.dir as string) : root;
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		if (args.build && !args.output) {
			log.warn(
				"--build requires --output <dir> to know where to write JSON files. Running check-only.",
			);
		}

		const relDir = relative(process.cwd(), watchDir) || ".";
		log.info(
			`Watching ${chalk.cyan(relDir)} for .gram changes — Ctrl+C to stop.`,
		);
		console.log();

		const pending = new Map<string, ReturnType<typeof setTimeout>>();

		const runCheck = async (abs: string) => {
			const rel = relative(process.cwd(), abs) || abs;
			const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });

			const result = await checkFiles([abs], {
				db: db ?? undefined,
				paths: config.paths,
			});
			const errCount = result.diagnostics.filter(
				(d) => d.level === "error",
			).length;
			const warnCount = result.diagnostics.filter(
				(d) => d.level === "warning",
			).length;

			if (result.hasErrors) {
				process.stdout.write(
					`${chalk.dim(`[${ts}]`)} ${chalk.red("✗")} ${rel} — ${chalk.red(`${errCount} error${errCount !== 1 ? "s" : ""}`)}\n`,
				);
				for (const d of result.diagnostics.filter((d) => d.level === "error")) {
					const loc = d.line != null ? chalk.dim(` line ${d.line}`) : "";
					process.stdout.write(
						`         ${chalk.dim("→")} ${d.message}${loc}\n`,
					);
				}
				return;
			}

			const warnSuffix =
				warnCount > 0
					? chalk.yellow(` (${warnCount} warning${warnCount !== 1 ? "s" : ""})`)
					: "";
			process.stdout.write(
				`${chalk.dim(`[${ts}]`)} ${chalk.green("✓")} ${rel}${warnSuffix}\n`,
			);

			if (args.build && args.output) {
				try {
					const results = await buildFiles([abs], {
						db: db ?? undefined,
						lang: config.language,
						paths: config.paths,
					});
					const outDir = resolve(args.output);
					await mkdir(outDir, { recursive: true });
					for (const { slug, data } of results) {
						await writeFile(
							join(outDir, `${slug}.json`),
							`${JSON.stringify(data)}\n`,
						);
					}
					process.stdout.write(`         ${chalk.dim("→ built")}\n`);
				} catch (err) {
					process.stdout.write(
						`         ${chalk.dim("→")} ${chalk.red("build failed:")} ${getErrorMessage(err)}\n`,
					);
				}
			}
		};

		const handleChange = async (abs: string) => {
			await runCheck(abs);

			// Re-check every file that (transitively) `@use`s the one that just
			// changed — module-imports RFC §F.0.3. Rebuilt fresh each time
			// rather than kept incrementally in sync, since a rename or an
			// added/removed `@use` line would otherwise leave it stale.
			const index = await buildWatchReverseIndex(watchDir, root, config.paths);
			const dependents = [...transitiveDependents(index, abs)];
			if (dependents.length === 0) return;

			process.stdout.write(
				`         ${chalk.dim(`→ rechecking ${dependents.length} dependent file${dependents.length !== 1 ? "s" : ""}`)}\n`,
			);
			for (const dep of dependents) {
				await runCheck(dep);
			}
		};

		watch(watchDir, { recursive: true }, (_, filename) => {
			if (!filename || extname(filename) !== ".gram") return;
			const abs = resolve(watchDir, filename);
			const existing = pending.get(abs);
			if (existing) clearTimeout(existing);
			pending.set(
				abs,
				setTimeout(() => {
					pending.delete(abs);
					handleChange(abs).catch(() => {});
				}, 150),
			);
		});

		// Keep process alive until Ctrl+C
		await new Promise(() => {});
	},
});

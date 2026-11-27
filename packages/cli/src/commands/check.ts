import { defineCommand } from "citty";
import { spinner } from "@clack/prompts";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { resolveGlob } from "../core/glob";
import { reportUnusedStock, resolveStockFromConfig } from "../core/stock";
import { checkFiles } from "../services/checker";
import {
	renderCheckResult,
	reportRejectedIngredients,
} from "../ui/diagnostics";
import { checkReport, emptyCheckReport } from "../ui/check-report";
import { ExitCode, GramCLIError, exitOnError } from "../errors";

const CHECK_FORMATS = ["text", "json"] as const;
type CheckFormat = (typeof CHECK_FORMATS)[number];

export default defineCommand({
	meta: {
		name: "check",
		description:
			"Validate .gram recipe files for syntax, structure, and ingredient database completeness",
	},
	args: {
		pattern: {
			type: "positional",
			description: "File path or glob pattern (default: **/*.gram)",
			required: false,
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
		strict: {
			type: "boolean",
			description: "Treat every warning as an error (e.g. for CI)",
			default: false,
		},
		stock: {
			type: "string",
			description:
				"Comma-separated @use specifiers already on hand for this check (e.g. @bases/pate.gram,./levain.gram)",
		},
		format: {
			type: "string",
			description: `Output format: ${CHECK_FORMATS.join(" | ")} (default: text). json prints a versioned report on stdout, for CI and AI agents`,
		},
	},
	async run({ args }) {
		// In JSON, stdout carries the report alone: every message goes to stderr.
		const report = (message: string) => process.stderr.write(`${message}\n`);
		const format = String(args.format ?? "text") as CheckFormat;
		if (!CHECK_FORMATS.includes(format)) {
			exitOnError(
				new GramCLIError(
					`Unknown --format value "${args.format}". Expected one of: ${CHECK_FORMATS.join(", ")}.`,
					ExitCode.Error,
				),
				report,
			);
		}
		const json = format === "json";

		const patterns = args._.length > 0 ? args._ : ["**/*.gram"];
		let files: string[] = [];
		try {
			files = await resolveGlob(patterns);
		} catch (err) {
			// No file to check is still a report a CI can parse.
			if (json) process.stdout.write(`${JSON.stringify(emptyCheckReport())}\n`);
			exitOnError(err, json ? report : undefined);
		}

		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;
		const stock = resolveStockFromConfig(args.stock, config);

		const n = files.length;
		const s = json ? null : spinner();
		s?.start(`Checking ${n} file${n !== 1 ? "s" : ""}…`);

		const result = await checkFiles(files, {
			db: db ?? undefined,
			strict: args.strict,
			paths: config.paths,
			stock,
		});

		s?.stop(`Checked ${n} file${n !== 1 ? "s" : ""}.`);

		if (json) {
			process.stdout.write(`${JSON.stringify(checkReport(result), null, 2)}\n`);
		} else {
			renderCheckResult(result);
		}
		reportUnusedStock("gram check", "checked", stock, [result]);

		if (result.hasErrors) {
			process.exit(ExitCode.Error);
		}
	},
});

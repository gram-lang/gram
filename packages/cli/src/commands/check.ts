import { defineCommand } from "citty";
import { spinner, log } from "@clack/prompts";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { resolveGlob } from "../core/glob";
import { checkFiles } from "../services/checker";
import {
	renderCheckResult,
	reportRejectedIngredients,
} from "../ui/diagnostics";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "check",
		description: "Validate .gram recipe files for syntax and structure errors",
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
	},
	async run({ args }) {
		const patterns = args._.length > 0 ? args._ : ["**/*.gram"];
		let files: string[] = [];
		try {
			files = await resolveGlob(patterns);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		const n = files.length;
		const s = spinner();
		s.start(`Checking ${n} file${n !== 1 ? "s" : ""}…`);

		const result = await checkFiles(files, {
			db: db ?? undefined,
			strict: args.strict,
		});

		s.stop(`Checked ${n} file${n !== 1 ? "s" : ""}.`);

		renderCheckResult(result);

		if (result.hasErrors) {
			process.exit(ExitCode.Error);
		}
	},
});

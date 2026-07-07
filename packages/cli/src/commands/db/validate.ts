import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { validateIngredientDatabase } from "@gram-lang/analyzer";
import { version } from "../../../package.json";
import { loadConfig } from "../../core/config";
import { resolveDbPath } from "../../core/db";
import { validateDb } from "../../services/db-validator";
import { renderValidateResult } from "../../ui/db-validate";
import type { DbIssue } from "../../types";
import { ExitCode } from "../../errors";

export default defineCommand({
	meta: {
		name: "validate",
		version,
		description: "Validate the ingredient database schema and completeness",
	},
	args: {
		strict: {
			type: "boolean",
			description: "Exit 1 on warnings (useful in CI)",
			default: false,
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML (overrides config)",
		},
	},
	async run({ args }) {
		const config = await loadConfig();
		const dbPath = resolveDbPath(config, args.db);

		let rawContent: string;
		try {
			rawContent = await readFile(dbPath, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				log.error(`No ingredient database found at ${dbPath}.`);
				log.info(`Run 'gram init' or 'gram db sync' to create one.`);
				process.exit(ExitCode.Error);
			}
			throw err;
		}

		const rawParsed = parse(rawContent) as Record<string, unknown> | null;
		const rawIngredients = (rawParsed?.ingredients ?? rawParsed) as unknown;

		// Phase 1: Zod schema validation via @gram-lang/analyzer (entry-by-entry:
		// one malformed ingredient doesn't stop the rest from being reported).
		const { data: db, rejected } = validateIngredientDatabase(rawIngredients);
		const schemaIssues: DbIssue[] = rejected.map((r) => ({
			level: "error",
			category: "Schema",
			ingredient: r.key,
			message: r.message,
		}));

		// Phase 2: Business rule checks on the entries that did pass schema validation
		const businessResult = validateDb(db, dbPath);

		const result = {
			dbPath,
			ingredientCount: businessResult.ingredientCount,
			issues: [...schemaIssues, ...businessResult.issues],
			hasErrors: schemaIssues.length > 0 || businessResult.hasErrors,
		};

		renderValidateResult(result);

		const shouldFail =
			result.hasErrors || (args.strict && result.issues.length > 0);
		process.exit(shouldFail ? ExitCode.Error : ExitCode.Ok);
	},
});

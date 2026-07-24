import { defineCommand } from "citty";
import { log, spinner } from "@clack/prompts";
import { version } from "../../../package.json";
import { loadConfig } from "../../core/config";
import { loadDb } from "../../core/db";
import { loadAiModel } from "../../core/ai";
import { enrichDb } from "../../services/db-enricher";
import { renderEnrichResult } from "../../ui/db-enrich";
import { reportRejectedIngredients } from "../../ui/diagnostics";
import { ExitCode, GramCLIError } from "../../errors";

export default defineCommand({
	meta: {
		name: "enrich",
		version,
		description:
			"Fill in missing density, nutrition and tags via AI (step 3/3 — run after lint)",
	},
	args: {
		ingredient: {
			type: "string",
			description: "Enrich a single ingredient by slug",
		},
		field: {
			type: "string",
			description:
				"Field to enrich: density | nutrition | tags | category | all (default: all)",
			default: "all",
		},
		"dry-run": {
			type: "boolean",
			alias: "n",
			description: "Preview what would be written without writing",
			default: false,
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML (overrides config)",
		},
	},
	async run({ args }) {
		const field = args.field as
			| "density"
			| "nutrition"
			| "tags"
			| "category"
			| "all";
		if (!["density", "nutrition", "tags", "category", "all"].includes(field)) {
			log.error(
				`Invalid --field "${field}". Use density, nutrition, tags, category, or all.`,
			);
			process.exit(ExitCode.Error);
		}

		const config = await loadConfig();

		const dbResult = await loadDb(config, args.db);
		if (!dbResult.data) {
			log.error("No ingredient database found. Run `gram db sync` first.");
			process.exit(ExitCode.Error);
		}
		reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult.data;

		let model;
		try {
			model = loadAiModel(config);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		const s = spinner();
		s.start("Calling AI model…");

		let result;
		try {
			result = await enrichDb(db, config, model, {
				ingredient: args.ingredient,
				field,
				dryRun: args["dry-run"],
				dbPathOverride: args.db,
				onBatchDone(done, total, enriched, failed) {
					const ok = enriched.length > 0 ? `✓ ${enriched.length}` : "";
					const ko = failed.length > 0 ? `✗ ${failed.length}` : "";
					const counts = [ok, ko].filter(Boolean).join("  ");
					s.message(`Batch ${done}/${total} — ${counts || "processing…"}`);
				},
			});
		} catch (err) {
			s.stop("Failed.");
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		s.stop("Done.");
		renderEnrichResult(result, args["dry-run"]);
		process.exit(ExitCode.Ok);
	},
});

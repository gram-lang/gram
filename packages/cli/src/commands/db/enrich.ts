import { defineCommand } from "citty";
import { log, spinner } from "@clack/prompts";
import { version } from "../../../package.json";
import { loadConfig } from "../../core/config";
import { loadDb } from "../../core/db";
import { AI_ARGS } from "../../core/ai-args";
import { canPrompt } from "../../core/interactive";
import { resolveAiForCommand } from "../../ui/ai-model";
import { enrichDb, applyEnrichDecisions } from "../../services/db-enricher";
import {
	renderEnrichResult,
	renderEnrichPreview,
	promptEnrichDecisions,
	buildAcceptDecision,
} from "../../ui/db-enrich";
import { reportRejectedIngredients } from "../../ui/diagnostics";
import { ExitCode, GramCLIError } from "../../errors";

export default defineCommand({
	meta: {
		name: "enrich",
		version,
		description:
			"Fill in missing density, nutrition and tags via AI, with an interactive review before writing (step 3/3 — run after lint)",
	},
	args: {
		...AI_ARGS,
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
		report: {
			type: "boolean",
			alias: "r",
			description: "Show what needs review without writing anything",
			default: false,
		},
		yes: {
			type: "boolean",
			alias: "y",
			description:
				"Skip interactive review and accept all AI estimates automatically (for scripting)",
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

		const { model } = await resolveAiForCommand(config, args);

		const s = spinner();
		s.start("Calling AI model…");

		let result;
		try {
			result = await enrichDb(db, config, model, {
				ingredient: args.ingredient,
				field,
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

		if (result.enriched.length === 0) {
			renderEnrichResult(result, {
				written: false,
				reason:
					result.totalIncomplete === 0
						? "nothing to enrich"
						: "no ingredient produced a usable AI response",
			});
			process.exit(ExitCode.Ok);
		}

		if (args.report) {
			renderEnrichPreview(result);
			process.exit(ExitCode.Ok);
		}

		const isTagsOrCategory = field === "tags" || field === "category";
		const interactive = canPrompt();
		const skipReview = isTagsOrCategory || args.yes || !interactive;

		if (!args.yes && !interactive && !isTagsOrCategory) {
			log.warn(
				"Non-interactive mode detected — accepting all AI estimates automatically. Use --report to preview instead.",
			);
		}

		const decisions = skipReview
			? result.enriched.map(buildAcceptDecision)
			: await promptEnrichDecisions(result.enriched);

		const write = await applyEnrichDecisions(
			result.dbPath,
			result.enriched,
			decisions,
		);
		renderEnrichResult(result, write);
		process.exit(ExitCode.Ok);
	},
});

import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import { version } from "../../package.json";
import { ExitCode } from "../errors";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { resolveGlob } from "../core/glob";
import { suggestRecipes } from "../services/suggester";
import { renderSuggestions, renderSuggestionsJson } from "../ui/suggest";

function parseTermList(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
}

export default defineCommand({
	meta: {
		name: "suggest",
		version,
		description: "Find recipes that use specific ingredients",
	},
	args: {
		with: {
			type: "string",
			alias: "w",
			description:
				"Comma-separated list of ingredients the recipe must contain",
		},
		without: {
			type: "string",
			description: "Comma-separated list of ingredients to exclude",
		},
		top: {
			type: "string",
			alias: "n",
			description: "Show top N results (default: 10)",
			default: "10",
		},
		"min-match": {
			type: "string",
			description: "Minimum match percentage 0–100 (default: 1)",
			default: "1",
		},
		pattern: {
			type: "string",
			description: "Glob pattern for recipe files (default: **/*.gram)",
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML (enables alias matching)",
		},
		"skip-db": {
			type: "boolean",
			description: "Skip ingredient database (disables alias matching)",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Output results as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const withTerms = parseTermList(args.with as string | undefined);
		const withoutTerms = parseTermList(args.without as string | undefined);

		if (withTerms.length === 0 && withoutTerms.length === 0) {
			log.error("Specify at least --with or --without.");
			process.exit(ExitCode.Error);
		}

		const config = await loadConfig();
		const db = args["skip-db"]
			? null
			: await loadDbSafe(config, args.db as string | undefined);

		const patterns = args.pattern ? [args.pattern as string] : ["**/*.gram"];
		const files = await resolveGlob(patterns);

		const top = Math.max(1, parseInt(args.top as string, 10) || 10);
		const minMatch = Math.min(
			100,
			Math.max(0, parseInt(args["min-match"] as string, 10) || 1),
		);

		const results = await suggestRecipes(files, {
			withTerms,
			withoutTerms,
			db,
			minMatch,
			top,
		});

		if (args.json) {
			renderSuggestionsJson(results);
		} else {
			renderSuggestions(results, withTerms, withoutTerms);
		}
	},
});

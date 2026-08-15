import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { NUTRIENTS, type IngredientData } from "@gram-lang/analyzer";
import { slugify } from "@gram-lang/kitchen";
import { version } from "../../../package.json";
import { loadConfig } from "../../core/config";
import { loadDb } from "../../core/db";
import { reportRejectedIngredients } from "../../ui/diagnostics";
import { ExitCode } from "../../errors";

type MissingFilter = "nutrition" | "physical" | "aliases";

function matchesQuery(
	id: string,
	entry: IngredientData,
	query: string,
	exact: boolean,
): boolean {
	const q = query.toLowerCase();
	if (exact) {
		return (
			slugify(id) === slugify(query) ||
			entry.name?.toLowerCase() === q ||
			(entry.aliases ?? []).some((a) => a.toLowerCase() === q)
		);
	}
	const haystack = [id, entry.name ?? "", ...(entry.aliases ?? [])].map((s) =>
		s.toLowerCase(),
	);
	return haystack.some((s) => s.includes(q));
}

// Widest label plus the two-space indent a sub-macro carries, so the value
// column stays aligned whatever the table holds.
const NUTRIENT_LABEL_WIDTH =
	Math.max(...NUTRIENTS.map((n) => n.label.length)) + 2;

function fmt(val: number | undefined, unit: string, decimals = 2): string {
	if (val === undefined) return chalk.dim("—");
	return `${parseFloat(val.toFixed(decimals))} ${chalk.dim(unit)}`;
}

function renderEntry(id: string, entry: IngredientData): void {
	const line = chalk.dim("─".repeat(48));
	console.log();
	console.log(`  ${line}`);
	const nameStr = entry.name ? chalk.bold(entry.name) : chalk.bold(id);
	const catStr = entry.category ? chalk.dim(`  (${entry.category})`) : "";
	console.log(`  ${nameStr}${catStr}  ${chalk.dim(id)}`);
	console.log(`  ${line}`);

	if (entry.aliases && entry.aliases.length > 0) {
		console.log(
			`  ${chalk.dim("aliases:")}  ${entry.aliases.join(chalk.dim(", "))}`,
		);
	}
	if (entry.tags && entry.tags.length > 0) {
		console.log(
			`  ${chalk.dim("tags:")}     ${entry.tags.map((t) => chalk.cyan(t)).join(chalk.dim(", "))}`,
		);
	}

	const n = entry.nutrition;
	if (n) {
		console.log();
		console.log(`  ${chalk.underline("Nutrition")} ${chalk.dim("(per 100g)")}`);
		// Driven by NUTRIENTS so this listing can never show a different set of
		// nutrients than the database schema accepts — the two had already
		// drifted apart once.
		for (const nutrient of NUTRIENTS) {
			const value = n[nutrient.key];
			if (value === undefined) continue;
			const label = nutrient.parent ? `  ${nutrient.label}` : nutrient.label;
			console.log(
				`  ${chalk.dim(label.padEnd(NUTRIENT_LABEL_WIDTH))} ${fmt(
					value,
					nutrient.unit,
					nutrient.dp === 0 ? 0 : 2,
				)}`,
			);
		}
	} else {
		console.log(`  ${chalk.dim("nutrition:")}  —`);
	}

	const p = entry.physical;
	if (p) {
		console.log();
		console.log(`  ${chalk.underline("Physical")}`);
		console.log(
			`  ${chalk.dim("Density")}        ${fmt(p.density, "g/mL", 3)}`,
		);
		if (p.yield !== undefined)
			console.log(
				`  ${chalk.dim("Yield")}          ${fmt(p.yield, "", 2).trim()}`,
			);
		if (p.unit_weight !== undefined)
			console.log(
				`  ${chalk.dim("Unit weight")}    ${fmt(p.unit_weight, "g")}`,
			);
	} else {
		console.log(`  ${chalk.dim("physical:")}   —`);
	}

	console.log();
}

export default defineCommand({
	meta: {
		name: "search",
		version,
		description: "Search and display ingredients in the database",
	},
	args: {
		query: {
			type: "positional",
			required: false,
			description: "Search term (name, alias, or partial match)",
		},
		tag: {
			type: "string",
			description: "Filter by tag",
		},
		category: {
			type: "string",
			alias: "c",
			description: "Filter by category",
		},
		missing: {
			type: "string",
			description:
				"Filter entries missing a field: nutrition, physical, or aliases",
		},
		exact: {
			type: "boolean",
			description: "Exact match only (name or alias)",
			default: false,
		},
		count: {
			type: "boolean",
			description: "Print match count instead of entries",
			default: false,
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML",
		},
		json: {
			type: "boolean",
			description: "Output results as JSON",
			default: false,
		},
	},
	async run({ args }) {
		const config = await loadConfig();

		const dbResult = await loadDb(config, args.db as string | undefined);
		if (!dbResult.data) {
			log.error("No ingredient database found.");
			log.info(`Run 'gram init' or 'gram db sync' to create one.`);
			process.exit(ExitCode.Error);
		}
		reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult.data;

		const query = args.query as string | undefined;
		const tagFilter = args.tag as string | undefined;
		const catFilter = args.category as string | undefined;
		const missingFilter = args.missing as MissingFilter | undefined;
		const exact = Boolean(args.exact);

		const entries = Object.entries(db).filter(([id, entry]) => {
			if (query && !matchesQuery(id, entry, query, exact)) return false;
			if (tagFilter && !(entry.tags ?? []).includes(tagFilter)) return false;
			if (catFilter && entry.category !== catFilter) return false;
			if (missingFilter === "nutrition" && entry.nutrition) return false;
			if (missingFilter === "physical" && entry.physical) return false;
			if (missingFilter === "aliases" && (entry.aliases ?? []).length > 0)
				return false;
			return true;
		});

		entries.sort(([a], [b]) => a.localeCompare(b));

		if (args.count) {
			console.log(entries.length);
			return;
		}

		if (args.json) {
			const obj: Record<string, IngredientData> = {};
			for (const [id, entry] of entries) obj[id] = entry;
			console.log(JSON.stringify(obj, null, 2));
			return;
		}

		if (entries.length === 0) {
			log.warn("No matching ingredients found.");
			return;
		}

		for (const [id, entry] of entries) {
			renderEntry(id, entry);
		}

		console.log(
			chalk.dim(`  ${entries.length} result${entries.length !== 1 ? "s" : ""}`),
		);
		console.log();
	},
});

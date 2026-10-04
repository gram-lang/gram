import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseInstant, toUtcIso } from "@gram-lang/scheduler";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { resolveScaleArg } from "../services/scaler";
import { reportUnusedStock, resolveStockFromConfig } from "../core/stock";
import {
	MISE_EN_PLACE_FLAG_DESCRIPTION,
	parseMiseEnPlace,
} from "../services/mise-en-place-flag";
import { RESTS_FLAG_DESCRIPTION, parseRests } from "../services/rests-flag";
import {
	PLAN_FORMATS,
	type PlanFormat,
	formatPlan,
	planRecipe,
	planToICS,
} from "../services/planner";
import { ExitCode, GramCLIError } from "../errors";
import { PLAN_FLAG_ARGS, resolvePlanContext } from "../services/plan-options";

export default defineCommand({
	meta: {
		name: "plan",
		version,
		description:
			"Plan a recipe backward from the time it is served: when to start each task, given when you are available",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		...PLAN_FLAG_ARGS,
		serve: { ...PLAN_FLAG_ARGS.serve, required: true },
		format: {
			type: "string",
			description: `Output format: ${PLAN_FORMATS.join(" | ")} (default: text)`,
		},
		ics: {
			type: "string",
			description:
				"Also write the plan as an iCalendar file (events in UTC, an alarm on every task that needs your hands)",
		},
		scale: {
			type: "string",
			description:
				"Scale factor (e.g. 1.5) or reference ingredient (e.g. farine=300g)",
		},
		"mise-en-place": {
			type: "string",
			description: MISE_EN_PLACE_FLAG_DESCRIPTION,
		},
		rests: {
			type: "string",
			description: RESTS_FLAG_DESCRIPTION,
		},
		stock: {
			type: "string",
			description:
				"Comma-separated @use specifiers already on hand for this plan (e.g. @bases/pate.gram,./levain.gram)",
		},
	},
	async run({ args, rawArgs }) {
		const file = resolve(args.file as string);
		const config = await loadConfig();

		try {
			const format = String(args.format ?? "text") as PlanFormat;
			if (!PLAN_FORMATS.includes(format)) {
				throw new GramCLIError(
					`Unknown --format value "${args.format}". Expected one of: ${PLAN_FORMATS.join(", ")}.`,
					ExitCode.Error,
				);
			}
			const context = resolvePlanContext(args, rawArgs, config, {
				required: true,
			})!;
			const { serveAt, timeZone, availability, now } = context;
			const miseEnPlace = parseMiseEnPlace(args["mise-en-place"]);
			const rests = parseRests(args.rests);
			const stock = resolveStockFromConfig(args.stock, config);
			const scaleFactor =
				(await resolveScaleArg(
					args.scale as string | undefined,
					file,
					null,
					config.language,
					config.paths,
				)) ?? 1;

			const result = await planRecipe(file, {
				serveAt,
				timeZone,
				availability,
				now,
				miseEnPlace,
				rests,
				scaleFactor,
				lang: config.language,
				paths: config.paths,
				stock,
			});
			reportUnusedStock("gram plan", "planned", stock, [result]);

			process.stdout.write(formatPlan(result, format, config.language));

			if (args.ics) {
				const path = resolve(args.ics as string);
				const stamp = toUtcIso(parseInstant(now, timeZone));
				await writeFile(
					path,
					planToICS(result, stamp, config.language),
					"utf-8",
				);
				process.stderr.write(`Calendar written to ${path}\n`);
			}
			process.exit(ExitCode.Ok);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}
	},
});

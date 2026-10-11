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
	findPlan,
	formatPlan,
	planRecipe,
	planToICS,
} from "../services/planner";
import { ExitCode, GramCLIError } from "../errors";
import {
	PLAN_FLAG_ARGS,
	resolveKitchenContext,
} from "../services/plan-options";
import {
	parseFindRange,
	parseMealTimes,
	parseServe,
} from "../services/plan-flags";

export default defineCommand({
	meta: {
		name: "plan",
		version,
		description:
			"Plan a recipe: the days, the visits to the kitchen and what to take out. With --serve, backward from the time it is served; without, the earliest it could be ready",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		...PLAN_FLAG_ARGS,
		find: {
			type: "string",
			description:
				'List the serving times that work between two local moments, e.g. "2026-10-12/2026-10-15", instead of writing the plan',
		},
		"meal-times": {
			type: "string",
			description:
				"Times of day --find tries, comma-separated (default: the `mealTimes` setting, else 12:30,20:00)",
		},
		format: {
			type: "string",
			description: `Output format: ${PLAN_FORMATS.join(" | ")} (default: text)`,
		},
		ics: {
			type: "string",
			description:
				"Also write the plan as an iCalendar file, one event per visit to the kitchen, in UTC, with an alarm before it (needs --serve)",
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
			const kitchen = resolveKitchenContext(args, rawArgs, config);
			const { timeZone, availability, now } = kitchen;
			const serveAt =
				args.serve === undefined || args.serve === ""
					? undefined
					: parseServe(args.serve);
			if (args.ics && serveAt === undefined) {
				throw new GramCLIError(
					"--ics needs --serve (when it is served): a calendar event needs a date.",
					ExitCode.Error,
				);
			}
			if (args.find && serveAt !== undefined) {
				throw new GramCLIError(
					"--find looks for the serving time: it doesn't go with --serve.",
					ExitCode.Error,
				);
			}
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

			if (args.find !== undefined && args.find !== "") {
				if (format === "html") {
					throw new GramCLIError(
						"--find writes text, md or json, not html.",
						ExitCode.Error,
					);
				}
				const range = parseFindRange(args.find);
				const mealTimes = parseMealTimes(args["meal-times"], config.mealTimes);
				process.stdout.write(
					findPlan(result, range, format, {
						mealTimes,
						lang: config.language,
					}),
				);
				process.exit(ExitCode.Ok);
			}

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

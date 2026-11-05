import type { Availability } from "@gram-lang/scheduler";
import { ExitCode, GramCLIError } from "../errors";
import {
	collectFlag,
	parseAvailability,
	parseServe,
	parseTimeZone,
} from "./plan-flags";

/**
 * The flags that put a recipe on the calendar, shared by `gram plan` and by the
 * commands that write a view of a recipe (`export`, `print`), where they go with
 * `--view work-plan`. Spread them into a command's `args`.
 */
export const PLAN_FLAG_ARGS = {
	serve: {
		type: "string",
		description:
			'When it is served, a local date and time (e.g. "2026-10-11 13:00"): puts the recipe on the calendar',
	},
	tz: {
		type: "string",
		description:
			"IANA time zone of the serving time and of your availability (default: the `timezone` setting of the project, else this machine's, e.g. Europe/Paris)",
	},
	available: {
		type: "string",
		description:
			"When you are available, repeatable: 08:00-22:00 (every day), fri=18:00-22:00 (a day of the week), 2026-10-09=none (a date). Several ranges: 08:00-09:00,18:00-22:00. Default: all day",
	},
	now: {
		type: "string",
		description:
			"The present, to warn when the first task should already have started (default: now). Mostly for tests",
	},
} as const;

/** What the plan flags say about the cook, without a serving time. */
export interface KitchenContext {
	timeZone: string;
	availability: Availability;
	now: string;
}

/**
 * The time zone, availability and present of the plan flags. `--tz`,
 * `--available` and `--now` are read with or without `--serve`: the earliest
 * time and the search of serving times need them too.
 */
export function resolveKitchenContext(
	args: Record<string, unknown>,
	rawArgs: string[] | undefined,
	config: { timezone?: string },
): KitchenContext {
	return {
		timeZone: parseTimeZone(args.tz, config.timezone),
		availability: parseAvailability(collectFlag(rawArgs ?? [], "available")),
		now: (args.now as string | undefined) ?? new Date().toISOString(),
	};
}

/** The views `gram print` and `gram export` can write, as `--view` names them. */
export const EXPORT_VIEWS = ["recipe", "work-plan"] as const;

/** `--view`, for the commands that write one view of a recipe. */
export const VIEW_FLAG_ARG = {
	view: {
		type: "string",
		description: `Which view to write: ${EXPORT_VIEWS.join(" | ")} (default: recipe). The work plan takes the plan flags; without --serve it is laid out in days before the service`,
	},
} as const;

/** What `--view` and the plan flags ask for: the recipe, or the work plan and when it is served. */
export type ExportView =
	| { view: "recipe" }
	| { view: "workPlan"; kitchen: KitchenContext; serveAt?: string };

/**
 * Reads `--view` and the plan flags. The recipe reads the same at any time, so
 * the plan flags only go with the work plan, which they would otherwise be
 * silently ignored for.
 */
export function resolveExportView(
	args: Record<string, unknown>,
	rawArgs: string[] | undefined,
	config: { timezone?: string },
): ExportView {
	const name = (args.view as string | undefined) ?? "recipe";
	if (!(EXPORT_VIEWS as readonly string[]).includes(name)) {
		throw new GramCLIError(
			`Unknown --view value "${name}". Expected one of: ${EXPORT_VIEWS.join(", ")}.`,
			ExitCode.Error,
		);
	}
	const hasServe = args.serve !== undefined && args.serve !== "";
	if (name === "recipe") {
		const available = collectFlag(rawArgs ?? [], "available");
		if (hasServe || args.tz || available.length > 0 || args.now) {
			throw new GramCLIError(
				"--serve, --tz, --available and --now only apply with --view work-plan: the recipe itself reads the same at any time.",
				ExitCode.Error,
			);
		}
		return { view: "recipe" };
	}
	return {
		view: "workPlan",
		kitchen: resolveKitchenContext(args, rawArgs, config),
		...(hasServe && { serveAt: parseServe(args.serve) }),
	};
}

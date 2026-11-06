import type { ViewDefinition } from "@gram-lang/renderer";
import type { Availability } from "@gram-lang/scheduler";
import {
	CLI_VIEW_NAMES,
	cliViewName,
	isPlanned,
	viewByCliName,
} from "../core/cli-views";
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
 * `--view run-sheet`. Spread them into a command's `args`.
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
			"When you are available, repeatable: 08:00-22:00 (every day), fri=18:00-22:00 (a day of the week), 2026-10-09=none (a date). Several ranges: 08:00-09:00,18:00-22:00. Default: the `availability` setting of the project, else all day",
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
	config: { timezone?: string; availability?: unknown },
): KitchenContext {
	return {
		timeZone: parseTimeZone(args.tz, config.timezone),
		availability: parseAvailability(
			collectFlag(rawArgs ?? [], "available"),
			config.availability,
		),
		now: (args.now as string | undefined) ?? new Date().toISOString(),
	};
}

/** `--view`, for the commands that write one view of a recipe: every view of the renderer. */
export const VIEW_FLAG_ARG = {
	view: {
		type: "string",
		description: `Which view to write: ${CLI_VIEW_NAMES.join(" | ")} (default: recipe). The run sheet takes the plan flags; without --serve it is laid out in days before the service`,
	},
} as const;

/** What `--view` and the plan flags ask for: a view, and for a planned one, the kitchen and when it is served. */
export interface ExportView {
	view: ViewDefinition;
	/** For a view laid out in time (the run sheet). */
	kitchen?: KitchenContext;
	serveAt?: string;
}

/**
 * Reads `--view` and the plan flags. A view that is not laid out in time (the
 * recipe) reads the same at any time, so the plan flags only go with one that
 * is, which they would otherwise be silently ignored for.
 */
export function resolveExportView(
	args: Record<string, unknown>,
	rawArgs: string[] | undefined,
	config: { timezone?: string; availability?: unknown },
): ExportView {
	const view = viewByCliName((args.view as string | undefined) ?? "recipe");
	const hasServe = args.serve !== undefined && args.serve !== "";
	if (!isPlanned(view)) {
		const available = collectFlag(rawArgs ?? [], "available");
		if (hasServe || args.tz || available.length > 0 || args.now) {
			const planned = CLI_VIEW_NAMES.filter((name) =>
				isPlanned(viewByCliName(name)),
			);
			throw new GramCLIError(
				`--serve, --tz, --available and --now only apply with --view ${planned.join(" or ")}: the ${cliViewName(view.id)} view reads the same at any time.`,
				ExitCode.Error,
			);
		}
		return { view };
	}
	return {
		view,
		kitchen: resolveKitchenContext(args, rawArgs, config),
		...(hasServe && { serveAt: parseServe(args.serve) }),
	};
}

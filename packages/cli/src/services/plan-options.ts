import type { Availability, ProjectedPlan } from "@gram-lang/scheduler";
import { project } from "@gram-lang/scheduler";
import type {
	CompilationResult,
	MiseEnPlaceMode,
	RestChoice,
} from "@gram-lang/kitchen";
import { ExitCode, GramCLIError } from "../errors";
import {
	collectFlag,
	parseAvailability,
	parseServe,
	parseTimeZone,
} from "./plan-flags";

/**
 * The flags that put a recipe on the calendar, shared by `gram plan` and by the
 * commands that show a recipe (`view`, `export`, `print`), where they add the
 * time of each step to the recipe. Spread them into a command's `args`.
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

/** What it takes to put a recipe on the calendar: when, where, and when you can cook. */
export interface PlanContext {
	/** A local date and time, "2026-10-11T13:00". */
	serveAt: string;
	timeZone: string;
	availability: Availability;
	/** The present, as an instant or a local time in `timeZone`. */
	now: string;
}

/**
 * Reads the plan flags. Without `--serve` there is no plan: `undefined`, unless
 * the command needs one (`required`), or another plan flag was given, which would
 * otherwise be silently ignored.
 */
export function resolvePlanContext(
	args: Record<string, unknown>,
	rawArgs: string[] | undefined,
	config: { timezone?: string },
	{ required = false }: { required?: boolean } = {},
): PlanContext | undefined {
	const raw = rawArgs ?? [];
	const available = collectFlag(raw, "available");
	if (args.serve === undefined || args.serve === "") {
		if (!required && (args.tz || available.length > 0 || args.now)) {
			throw new GramCLIError(
				"--tz, --available and --now only apply with --serve (when it is served).",
				ExitCode.Error,
			);
		}
		if (!required) return undefined;
	}
	return {
		serveAt: parseServe(args.serve),
		timeZone: parseTimeZone(args.tz, config.timezone),
		availability: parseAvailability(available),
		now: (args.now as string | undefined) ?? new Date().toISOString(),
	};
}

/** Places a compiled recipe on the calendar, ending when it is served. */
export function placeOnCalendar(
	compiled: CompilationResult,
	context: PlanContext,
	choice: { miseEnPlace?: MiseEnPlaceMode; rests?: RestChoice } = {},
): ProjectedPlan {
	return project(
		[
			{
				graph: compiled.tasks,
				title: compiled.title ?? undefined,
				options: choice,
			},
		],
		{
			serveAt: context.serveAt,
			timeZone: context.timeZone,
			availability: context.availability,
			now: context.now,
		},
	);
}

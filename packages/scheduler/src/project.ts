import { type Interval, availableIntervals, gapsBetween } from "./availability";
import type { TimerTask } from "./graph";
import { type LayoutResult, layout } from "./layout";
import { DEFAULT_REST_CHOICE, type RestChoice } from "./mode";
import type {
	ProjectedBlock,
	ProjectedPlan,
	ProjectedSession,
	ProjectionContext,
	ProjectionDiagnostic,
	ProjectionInput,
} from "./projection";
import {
	addDays,
	daysBetween,
	parseInstant,
	parseLocalIso,
	toLocal,
	toLocalIso,
	toUtcIso,
} from "./time";
import type { Schedule, ScheduleBlock } from "./types";

const EPS = 1e-6;

/** A stretch of hands-on work with no gap in it: it cannot be interrupted. */
interface Group {
	tasks: string[];
	start: number;
	end: number;
}

/** The hands-on blocks (`prep` and `step`), joined where one starts as the other ends. */
function activeGroups(blocks: ScheduleBlock[], offset: number): Group[] {
	const active = blocks
		.filter((b) => b.kind !== "passive" && b.end > b.start)
		.sort((a, b) => a.start - b.start);
	const groups: Group[] = [];
	for (const b of active) {
		const last = groups.at(-1);
		if (last && b.start <= last.end - offset + EPS) {
			last.tasks.push(b.task);
			last.end = b.end + offset;
		} else {
			groups.push({
				tasks: [b.task],
				start: b.start + offset,
				end: b.end + offset,
			});
		}
	}
	return groups;
}

const fits = (group: Group, intervals: Interval[]) =>
	intervals.some(
		(i) => i.start <= group.start + EPS && group.end <= i.end + EPS,
	);

interface Plan {
	result: LayoutResult;
	offset: number;
	groups: Group[];
}

/**
 * Whether making rests longer or shorter pays off: the work either side of the
 * night, the least of the two moves.
 */
const PREFERENCE: Record<RestChoice, ("shrink" | "stretch")[]> = {
	shortest: ["shrink", "stretch"],
	longest: ["stretch", "shrink"],
	balanced: [],
};

/**
 * Places a recipe's timeline on the calendar, ending when it is served, and
 * moves the rests that can move so the cook's own work falls when they are
 * available.
 *
 * Pure: the same graph and context always give the same plan, whatever the
 * machine's time zone. Instants are minutes since the epoch, so a day of 23 or
 * 25 hours counts for what it lasts; availability is read as local time.
 *
 * Greedy and explainable, not optimal. Walking back from the service, a stretch
 * of work outside the availability is moved by making the nearest rest after it
 * that is written as a range longer (the work moves earlier, to the evening
 * before) or shorter (it moves later, to the morning), in the direction the
 * choice of `rests` prefers, never beyond the range and never for a rest that is
 * exact. A rest on a named track is only stretched if the track stays free.
 * Whatever remains is reported, not hidden.
 */
export function project(
	inputs: ProjectionInput[],
	context: ProjectionContext,
): ProjectedPlan {
	const { timeZone } = context;
	const serve = parseLocalIso(context.serveAt, timeZone);
	const plan: ProjectedPlan = {
		serveAt: context.serveAt,
		timeZone,
		recipes: [],
		adjustments: [],
		unavailable: [],
		diagnostics: [],
	};
	const input = inputs[0];
	if (!input) return plan;
	if (inputs.length > 1) {
		plan.diagnostics.push({
			code: "MULTI_RECIPE_UNSUPPORTED",
			recipes: inputs.length,
		});
	}

	const options = input.options ?? {};
	const timers = new Map<string, TimerTask>();
	for (const task of input.graph.tasks) {
		if (task.kind === "passive") timers.set(task.id, task);
	}

	const overrides: Record<string, number> = {};
	const lay = (): Plan => {
		const result = layout(input.graph, {
			...options,
			restOverrides: overrides,
		});
		const offset = serve - result.schedule.totalTime;
		return {
			result,
			offset,
			groups: activeGroups(result.schedule.blocks, offset),
		};
	};
	const base = layout(input.graph, options).schedule;
	const baseOf = (id: string) => {
		const b = base.blocks.find((x) => x.kind === "passive" && x.task === id);
		return b ? b.end - b.start : undefined;
	};

	let current = lay();
	// Rests that can stretch push the work earlier by as much as they can grow:
	// the availability has to be known that far back.
	let slack = 0;
	for (const t of timers.values()) {
		if (t.duration.min !== undefined && t.duration.max !== undefined) {
			slack += t.duration.max - t.duration.min;
		}
	}
	const horizon = (p: Plan) => {
		const first =
			p.offset + Math.min(0, ...p.result.schedule.blocks.map((b) => b.start));
		return availableIntervals(
			context.availability,
			timeZone,
			first - slack,
			serve,
		);
	};
	let intervals = horizon(current);
	const largest = () => Math.max(0, ...intervals.map((i) => i.end - i.start));

	const exceeds = (g: Group) => g.end - g.start > largest() + EPS;
	const violating = (p: Plan) =>
		p.groups.filter((g) => !exceeds(g) && !fits(g, intervals));
	const contentions = (r: LayoutResult) =>
		r.diagnostics.filter((d) => d.code === "TRACK_CONTENTION").length;

	// Candidate rests for a group: written as a range, starting at or after it.
	const candidates = (p: Plan, group: Group) =>
		p.result.schedule.blocks
			.filter(
				(b) =>
					b.kind === "passive" &&
					b.start + p.offset >= group.start - EPS &&
					(() => {
						const d = timers.get(b.task)?.duration;
						return d?.min !== undefined && d.max !== undefined && d.min < d.max;
					})(),
			)
			.sort((a, b) => a.start - b.start);

	const tried = new Set<string>();
	for (;;) {
		const group = violating(current)
			.filter((g) => !tried.has(g.tasks[0]!))
			.at(-1);
		if (!group) break;
		const length = group.end - group.start;
		// How far to move the work to make it fit: later (shrink a rest) or earlier
		// (stretch one), to the nearest availability that holds it whole.
		let later: number | undefined;
		for (const i of intervals) {
			const start = Math.max(group.start, i.start);
			if (start + length <= i.end + EPS) {
				later = start - group.start;
				break;
			}
		}
		let earlier: number | undefined;
		for (const i of [...intervals].reverse()) {
			const end = Math.min(group.end, i.end);
			if (end - length >= i.start - EPS) {
				earlier = group.end - end;
				break;
			}
		}
		const preference = PREFERENCE[options.rests ?? DEFAULT_REST_CHOICE];
		const directions = (["shrink", "stretch"] as const)
			.filter((d) => (d === "shrink" ? later : earlier) !== undefined)
			.sort((a, b) => {
				const rank = (d: "shrink" | "stretch") =>
					preference.length > 0
						? preference.indexOf(d)
						: (d === "shrink" ? later : earlier)!;
				return rank(a) - rank(b);
			});

		let fixed = false;
		search: for (const rest of candidates(current, group)) {
			const duration = timers.get(rest.task)!.duration;
			const now = overrides[rest.task] ?? rest.end - rest.start;
			for (const direction of directions) {
				const target = direction === "shrink" ? now - later! : now + earlier!;
				const next = Math.min(duration.max!, Math.max(duration.min!, target));
				if (Math.abs(next - now) < EPS) continue;
				const previous = overrides[rest.task];
				overrides[rest.task] = next;
				const trial = lay();
				const grew = contentions(trial.result) > contentions(current.result);
				const stays = trial.groups.find((g) =>
					g.tasks.includes(group.tasks[0]!),
				);
				if (
					!grew &&
					stays &&
					fits(stays, intervals) &&
					violating(trial).length < violating(current).length
				) {
					current = trial;
					intervals = horizon(current);
					fixed = true;
					break search;
				}
				if (previous === undefined) delete overrides[rest.task];
				else overrides[rest.task] = previous;
			}
		}
		if (!fixed) tried.add(group.tasks[0]!);
	}

	const { schedule } = current.result;
	const { offset } = current;
	const at = (t: number) => t + offset;

	for (const [task, to] of Object.entries(overrides)) {
		const from = baseOf(task);
		if (from !== undefined && Math.abs(from - to) > EPS) {
			plan.adjustments.push({ task, from, to, reason: "avoid-unavailable" });
		}
	}
	plan.adjustments.sort((a, b) => a.task.localeCompare(b.task));

	for (const group of current.groups) {
		if (exceeds(group)) {
			plan.diagnostics.push({
				code: "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY",
				tasks: group.tasks,
				minutes: group.end - group.start,
				largest: largest(),
			});
		} else if (!fits(group, intervals)) {
			const rest = schedule.blocks
				.filter((b) => b.kind === "passive" && at(b.start) >= group.end - EPS)
				.sort((a, b) => a.start - b.start)[0];
			plan.diagnostics.push({
				code: "ACTIVE_OUTSIDE_AVAILABILITY",
				task: group.tasks[0]!,
				local: toLocalIso(group.start, timeZone),
				...(rest && { rest: rest.task }),
			});
		}
	}

	const dated = (b: ScheduleBlock): ProjectedBlock => {
		const { start, end, ...rest } = b;
		return {
			...rest,
			start: toUtcIso(at(start)),
			end: toUtcIso(at(end)),
			startLocal: toLocalIso(at(start), timeZone),
			endLocal: toLocalIso(at(end), timeZone),
		} as ProjectedBlock;
	};
	const sessions: ProjectedSession[] = schedule.sessions.map((s) => ({
		day: s.day,
		start: toUtcIso(at(s.start)),
		end: toUtcIso(at(s.end)),
		startLocal: toLocalIso(at(s.start), timeZone),
		endLocal: toLocalIso(at(s.end), timeZone),
		sections: s.sections,
	}));
	plan.recipes.push({
		...(input.title !== undefined && { title: input.title }),
		blocks: schedule.blocks.map(dated),
		sessions,
	});

	plan.diagnostics.push(
		...sessionMismatches(schedule, offset, serve, timeZone),
	);

	if (context.now !== undefined && schedule.blocks.length > 0) {
		const now = parseInstant(context.now, timeZone);
		const first = at(Math.min(...schedule.blocks.map((b) => b.start)));
		if (first < now - EPS) {
			plan.diagnostics.push({
				code: "START_IN_PAST",
				start: toUtcIso(first),
				now: toUtcIso(now),
			});
		}
	}

	if (schedule.blocks.length > 0) {
		const first = at(Math.min(...schedule.blocks.map((b) => b.start)));
		plan.unavailable = gapsBetween(intervals, first, serve).map((g) => ({
			start: toUtcIso(g.start),
			end: toUtcIso(g.end),
		}));
	}
	return plan;
}

/**
 * A working day `d` is meant to fall on the calendar day `d` days before the
 * service. A session whose hands-on work starts or ends on another one says so.
 */
function sessionMismatches(
	schedule: Schedule,
	offset: number,
	serve: number,
	timeZone: string,
): ProjectionDiagnostic[] {
	const serveDate = toLocal(serve, timeZone).date;
	const out: ProjectionDiagnostic[] = [];
	for (const s of schedule.sessions) {
		const expected = addDays(serveDate, -s.day);
		const dates = [s.start, s.end].map(
			(t) => toLocal(t + offset, timeZone).date,
		);
		const actual = dates.find((d) => d !== expected);
		if (actual !== undefined && daysBetween(expected, actual) !== 0) {
			out.push({ code: "SESSION_DAY_MISMATCH", day: s.day, expected, actual });
		}
	}
	return out;
}

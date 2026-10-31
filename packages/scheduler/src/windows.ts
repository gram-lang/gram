import { availableIntervals } from "./availability";
import type { TaskGraph } from "./graph";
import type { ProjectionContext } from "./projection";
import type {
	RunSheet,
	RunSheetEntry,
	RunSheetFixedBy,
	RunSheetVisit,
} from "./runsheet";
import { localDateTime, parseInstant, parseLocalIso, toLocalIso } from "./time";

const EPS = 1e-6;

/** A margin shorter than this is not worth telling: the visit is where it should be. */
export const WINDOW_MIN_MINUTES = 15;

interface Ref {
	visit: RunSheetVisit;
	day: number;
}

interface Constraint {
	slack: number;
	/** Set for a wait after the visit that cannot stretch: it holds the visit in place. */
	wait?: RunSheetFixedBy;
}

/**
 * How early each visit could happen, for a recipe laid out with a serving
 * time. The answer for a visit assumes every other visit stays at its
 * planned time, which is why it is always safe: everything is planned as late
 * as it can be, so a visit can only move earlier, and moving it earlier
 * shortens the wait before it and stretches the one after it, both checked
 * against the neighbours' planned times. Moving several visits, or none,
 * never breaks another window. A window is sometimes cautious, never wrong.
 *
 * Needs the graph (the written ranges of the waits). A recipe with no graph,
 * or a sheet with no serving time, is returned as it is.
 */
export function visitWindows(
	sheet: RunSheet,
	graph: TaskGraph,
	context: ProjectionContext,
): RunSheet {
	if (sheet.mode !== "calendar" || sheet.serveAt === undefined) return sheet;
	const out = structuredClone(sheet);
	const { timeZone } = context;
	const serve = parseLocalIso(sheet.serveAt, timeZone);
	const ranges = new Map<string, { min: number; max: number }>();
	for (const task of graph.tasks) {
		if (task.kind !== "passive") continue;
		const { min, max } = task.duration;
		ranges.set(task.id, {
			min: min ?? task.duration.nominal,
			max: max ?? task.duration.nominal,
		});
	}
	const graphTasks = new Map(graph.tasks.map((t) => [t.id, t]));
	// What needs each task: built once, so that finding where a wait is needed
	// is a lookup and not a walk of the whole graph for every wait.
	const dependents = new Map<string, string[]>();
	for (const t of graph.tasks) {
		if (t.kind === "passive") continue;
		for (const id of t.after) {
			const list = dependents.get(id);
			if (list) list.push(t.id);
			else dependents.set(id, [t.id]);
		}
	}
	const now =
		context.now === undefined ? undefined : parseInstant(context.now, timeZone);

	for (const recipe of out.recipes) {
		const refs: Ref[] = [];
		const waits: RunSheetEntry[] = [];
		for (const day of recipe.days) {
			for (const visit of day.visits) {
				refs.push({ visit, day: day.daysBefore });
			}
			waits.push(...day.entries.filter((e) => e.kind === "passive"));
		}
		if (refs.length === 0) continue;
		const visits = refs.map((r) => r.visit);
		const first = Math.min(...visits.map((p) => p.start));
		const intervals = availableIntervals(
			context.availability,
			timeZone,
			serve + first,
			serve,
		);

		const startsIn = (w: RunSheetEntry) => {
			let k = 0;
			visits.forEach((p, i) => {
				if (p.start <= w.from + EPS) k = i;
			});
			return k;
		};
		// Where a wait is needed: at the start of the first task that depends on
		// its step, else at the service. The wait itself ends sooner when the
		// dish just sits afterwards; what the written range bounds is the whole
		// span from its start to that need.
		const startOfTask = new Map<string, number>();
		for (const day of recipe.days) {
			for (const e of day.entries) {
				if (e.kind !== "passive") startOfTask.set(e.task, e.from);
			}
		}
		const neededAt = (w: RunSheetEntry): number => {
			const parent = graphTasks.get(w.task)?.after[0];
			if (parent === undefined) return Math.max(w.to, 0);
			let at = Infinity;
			for (const id of dependents.get(parent) ?? []) {
				const from = startOfTask.get(id);
				if (from !== undefined) at = Math.min(at, from);
			}
			return Number.isFinite(at) ? Math.max(at, w.to) : 0;
		};
		const visitAt = (minutes: number) =>
			visits.findIndex(
				(p) => p.start - EPS <= minutes && minutes <= p.end + EPS,
			);

		visits.forEach((p, k) => {
			const constraints: Constraint[] = [];
			const previous = visits[k - 1];
			if (previous) constraints.push({ slack: p.start - previous.end });

			for (const w of waits) {
				const from = startsIn(w);
				const need = neededAt(w);
				const to = visitAt(need);
				const range = ranges.get(w.task);
				const span = need - w.from;
				const planned = w.to - w.from;
				// A written range bounds the whole span. An exact wait holds the
				// span where it is when it is tight (a thaw that ends at the
				// service), and is only a minimum when the plan already leaves the
				// dish sitting afterwards (a sponge baked a day ahead).
				const written = range !== undefined && range.min < range.max;
				const maxSpan = written
					? range.max
					: span > planned + EPS
						? Infinity
						: planned;
				const minSpan = written ? range.min : planned;
				const fixed = (): RunSheetFixedBy => ({
					task: w.task,
					section: w.section,
					...(w.step !== undefined && { step: w.step }),
					...(w.track !== undefined && { track: w.track }),
					planned,
					before: to >= 0 ? "visit" : "service",
					...(to >= 0 && { sections: visits[to]!.sections }),
				});
				if (from === k && to !== k) {
					// The visit moves, the need stays: the span grows.
					constraints.push({
						slack: Math.max(0, maxSpan - span),
						wait: fixed(),
					});
				}
				if (to === k && from !== k) {
					// Bounds the margin, but it is not what holds the visit "fixed":
					// that is the wait it leads to.
					constraints.push({ slack: Math.max(0, span - minSpan) });
				}
				if (w.track !== undefined && from === k) {
					// Starting earlier must not run into the track's previous use.
					let free = Infinity;
					for (const o of waits) {
						if (o === w || o.track !== w.track) continue;
						if (o.to <= w.from + EPS) free = Math.min(free, w.from - o.to);
					}
					constraints.push({ slack: free });
				}
			}

			const start = serve + p.start;
			const end = serve + p.end;
			// The service itself is the end of the last visit: nothing earlier.
			if (p.end >= -EPS) constraints.push({ slack: 0 });
			const date = p.startLocal?.slice(0, 10);
			if (date !== undefined) {
				constraints.push({
					slack: start - localDateTime(date, 0, timeZone),
				});
			}
			if (now !== undefined) constraints.push({ slack: start - now });
			const room = intervals.find(
				(i) => i.start <= start + EPS && end <= i.end + EPS,
			);
			if (room) constraints.push({ slack: start - room.start });
			else constraints.push({ slack: 0 });

			const advance = Math.max(0, Math.min(...constraints.map((c) => c.slack)));
			if (advance >= WINDOW_MIN_MINUTES - EPS) {
				p.window = {
					advance,
					earliest: p.start - advance,
					earliestLocal: toLocalIso(start - advance, timeZone),
				};
				return;
			}
			const binding = constraints
				.filter((c) => c.wait && c.slack < WINDOW_MIN_MINUTES - EPS)
				.sort((a, b) => a.slack - b.slack)[0];
			if (binding?.wait && binding.slack <= advance + EPS) {
				p.fixedBy = binding.wait;
			}
		});
	}
	return out;
}

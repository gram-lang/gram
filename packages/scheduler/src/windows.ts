import { availableIntervals } from "./availability";
import type { TaskGraph } from "./graph";
import type { ProjectionContext } from "./projection";
import type {
	RunSheet,
	RunSheetEntry,
	RunSheetFixedBy,
	RunSheetPassage,
} from "./runsheet";
import { localDateTime, parseInstant, parseLocalIso, toLocalIso } from "./time";

const EPS = 1e-6;

/** A margin shorter than this is not worth telling: the passage is where it should be. */
export const WINDOW_MIN_MINUTES = 15;

interface Ref {
	passage: RunSheetPassage;
	day: number;
}

interface Constraint {
	slack: number;
	/** Set for a wait after the passage that cannot stretch: it holds the passage in place. */
	wait?: RunSheetFixedBy;
}

/**
 * How early each passage could happen, for a recipe laid out with a serving
 * time. The answer for a passage assumes every other passage stays at its
 * planned time, which is why it is always safe: everything is planned as late
 * as it can be, so a passage can only move earlier, and moving it earlier
 * shortens the wait before it and stretches the one after it, both checked
 * against the neighbours' planned times. Moving several passages, or none,
 * never breaks another window. A window is sometimes cautious, never wrong.
 *
 * Needs the graph (the written ranges of the waits). A recipe with no graph,
 * or a sheet with no serving time, is returned as it is.
 */
export function passageWindows(
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
	const now =
		context.now === undefined ? undefined : parseInstant(context.now, timeZone);

	for (const recipe of out.recipes) {
		const refs: Ref[] = [];
		const waits: RunSheetEntry[] = [];
		for (const day of recipe.days) {
			for (const passage of day.passages) {
				refs.push({ passage, day: day.daysBefore });
			}
			waits.push(...day.entries.filter((e) => e.kind === "passive"));
		}
		if (refs.length === 0) continue;
		const passages = refs.map((r) => r.passage);
		const first = Math.min(...passages.map((p) => p.start));
		const intervals = availableIntervals(
			context.availability,
			timeZone,
			serve + first,
			serve,
		);

		const startsIn = (w: RunSheetEntry) => {
			let k = 0;
			passages.forEach((p, i) => {
				if (p.start <= w.from + EPS) k = i;
			});
			return k;
		};
		const endsIn = (w: RunSheetEntry) =>
			passages.findIndex((p) => p.start - EPS <= w.to && w.to <= p.end + EPS);

		passages.forEach((p, k) => {
			const constraints: Constraint[] = [];
			const previous = passages[k - 1];
			if (previous) constraints.push({ slack: p.start - previous.end });

			for (const w of waits) {
				const from = startsIn(w);
				const to = endsIn(w);
				const range = ranges.get(w.task);
				const planned = w.to - w.from;
				const fixed = (): RunSheetFixedBy => ({
					task: w.task,
					section: w.section,
					...(w.step !== undefined && { step: w.step }),
					...(w.track !== undefined && { track: w.track }),
					planned,
					before: to === -1 ? "service" : "passage",
					...(to >= 0 && { sections: passages[to]!.sections }),
				});
				if (from === k && to !== k) {
					// The passage moves, the wait's end stays: the wait grows.
					constraints.push({
						slack: (range?.max ?? planned) - planned,
						wait: fixed(),
					});
				}
				if (to === k && from !== k) {
					// Bounds the margin, but it is not what holds the passage "fixed":
					// that is the wait it leads to.
					constraints.push({ slack: planned - (range?.min ?? planned) });
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
			// The service itself is the end of the last passage: nothing earlier.
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

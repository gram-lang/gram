import type { ActiveTimer } from "./types";

/** The running timers whose time is up at `now` (a done timer is never returned again). */
export function finishedTimers(
	timers: ActiveTimer[],
	now: number,
): Set<string> {
	const ids = new Set<string>();
	for (const t of timers) {
		if (!t.done && now - t.startedAt >= t.durationMs) ids.add(t.id);
	}
	return ids;
}

/** Marks the running timers named in `ids` as done; returns the same array when nothing changes. */
export function markDone(
	timers: ActiveTimer[],
	ids: ReadonlySet<string>,
): ActiveTimer[] {
	let changed = false;
	const next = timers.map((t) => {
		if (t.done || !ids.has(t.id)) return t;
		changed = true;
		return { ...t, done: true };
	});
	return changed ? next : timers;
}

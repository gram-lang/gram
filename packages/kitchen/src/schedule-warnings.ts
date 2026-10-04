import type { Location } from "@gram-lang/parser";
import type { SchedulingDiagnostic } from "@gram-lang/scheduler";
import type { ProcessedSection } from "./types";
import { type Warning, WarningCode, pushWarning } from "./warnings";

/**
 * Turns what the scheduler reports into compiler warnings: the scheduler only
 * says which section and how much, so the wording comes from here, with the
 * section's title and the source location (`ProcessedSection` is the JSON
 * output shape and carries none, so the caller supplies them).
 */
export function pushSchedulingWarnings(
	target: Warning[],
	diagnostics: SchedulingDiagnostic[],
	sections: ProcessedSection[],
	locationOf: (section: number) => Location | undefined,
): void {
	for (const d of diagnostics) {
		const section = sections[d.section];
		const title = section?.title || "unnamed";
		const loc = locationOf(d.section);
		switch (d.code) {
			case "TIME_PARADOX": {
				const rp = section?.retro_planning;
				pushWarning(target, WarningCode.TIME_PARADOX, {
					cause: `Section '${title}' (~{${rp?.value}${rp?.unit}})`,
					conflict: `downstream dependency at T${d.pulledTo}m`,
					loc,
				});
				break;
			}
			case "TRACK_CONTENTION":
				pushWarning(target, WarningCode.TRACK_CONTENTION, {
					trackName: d.trackName,
					delay: d.delay,
					item: `Step in section '${title}'`,
					loc,
				});
				break;
			case "SESSION_OVERFLOW":
				pushWarning(target, WarningCode.SESSION_OVERFLOW, {
					section: section?.title ?? null,
					day: d.day,
					overflowMinutes: d.overflowMinutes,
					loc,
				});
				break;
		}
	}
}

/**
 * Whether two scheduling warnings report the same problem. A recipe is laid
 * out several times (the legacy pass, then one timeline per mise en place
 * mode), and a problem more than one layout runs into is reported once — but
 * the figures in its message depend on the layout: the instant a time paradox
 * is pulled to, the delay of a contention. A paradox is matched on where it
 * sits in the source, a contention on its message without the delay.
 */
export function isSameSchedulingProblem(a: Warning, b: Warning): boolean {
	if (a.code !== b.code) return false;
	if (a.code === WarningCode.TIME_PARADOX && a.loc) {
		return JSON.stringify(a.loc) === JSON.stringify(b.loc);
	}
	if (a.code === WarningCode.TRACK_CONTENTION) {
		const withoutDelay = (w: Warning) =>
			w.message.replace(/delayed by \S+ min/, "delayed");
		return withoutDelay(a) === withoutDelay(b);
	}
	return a.message === b.message;
}

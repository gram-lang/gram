import type { Location } from "@gram-lang/parser";
import type { SchedulingDiagnostic } from "@gram-lang/scheduler";
import { type Warning, WarningCode, pushWarning } from "./warnings";

/**
 * Turns what the scheduler reports into compiler warnings, anchored to the
 * source of the section each one concerns (`ProcessedSection` is the JSON
 * output shape and carries no location, so the caller supplies them).
 */
export function pushSchedulingWarnings(
	target: Warning[],
	diagnostics: SchedulingDiagnostic[],
	locationOf: (section: number) => Location | undefined,
): void {
	for (const d of diagnostics) {
		const loc = locationOf(d.section);
		if (d.code === "TIME_PARADOX") {
			pushWarning(target, WarningCode.TIME_PARADOX, {
				cause: d.cause,
				conflict: d.conflict,
				loc,
			});
		} else {
			pushWarning(target, WarningCode.TRACK_CONTENTION, {
				trackName: d.trackName,
				delay: d.delay,
				item: d.item,
				loc,
			});
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

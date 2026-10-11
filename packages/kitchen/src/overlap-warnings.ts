import type { Location } from "@gram-lang/parser";
import type { Schedule } from "@gram-lang/scheduler";
import type { ProcessedSection, StepToken } from "./types";
import { type Warning, WarningCode, pushWarning } from "./warnings";

const EPS = 1e-6;

interface Passive {
	task: string;
	section: number;
	step: number;
	track?: string;
	start: number;
	end: number;
}

/** The cookware a step cites: the same `#name`, whatever the section. */
function cookwareOf(
	section: ProcessedSection | undefined,
	step: number,
	known: ReadonlySet<string>,
): Set<string> {
	const item = section?.steps[step];
	const ids = new Set<string>();
	if (item?.type !== "step") return ids;
	for (const token of item.content as StepToken[]) {
		if (typeof token === "string" || !("id" in token)) continue;
		if (known.has(token.id)) ids.add(token.id);
	}
	return ids;
}

/**
 * Two passive timers that run at the same time in steps that cite the same
 * cookware, with no named track in common: a rest that is meant to happen
 * after the other overlaps it. Only names are compared (`#oven` with `#oven`),
 * so it holds in every language. Sometimes the overlap is on purpose (two
 * trays in one oven): the warning is informative, and names the way out,
 * a track the two timers share so they take turns.
 *
 * Reads the default timeline; a pair is reported once.
 */
export function pushPassiveOverlapWarnings(
	target: Warning[],
	schedule: Schedule,
	sections: ProcessedSection[],
	cookware: ReadonlySet<string>,
	locationOf: (section: number) => Location | undefined,
): void {
	const timers: Passive[] = [];
	for (const b of schedule.blocks) {
		if (b.kind !== "passive" || b.end - b.start <= EPS) continue;
		timers.push({
			task: b.task,
			section: b.section,
			step: b.step,
			...(b.track !== undefined && { track: b.track }),
			start: b.start,
			end: b.end,
		});
	}
	const stepsLabel = (t: Passive) => {
		const title = sections[t.section]?.title || "unnamed";
		const steps = sections[t.section]?.steps ?? [];
		const n = steps
			.slice(0, t.step + 1)
			.filter((s) => s.type === "step").length;
		return `step ${n} of section '${title}'`;
	};
	const reported = new Set<string>();
	for (let i = 0; i < timers.length; i++) {
		for (let j = i + 1; j < timers.length; j++) {
			const a = timers[i]!;
			const b = timers[j]!;
			if (a.section === b.section && a.step === b.step) continue;
			if (!(a.start < b.end - EPS && b.start < a.end - EPS)) continue;
			if (a.track !== undefined && a.track === b.track) continue;
			const mine = cookwareOf(sections[a.section], a.step, cookware);
			const shared = [...cookwareOf(sections[b.section], b.step, cookware)]
				.filter((id) => mine.has(id))
				.sort()[0];
			if (shared === undefined) continue;
			// The earlier step in the source is the one the warning points at.
			const [first, second] =
				a.section < b.section || (a.section === b.section && a.step < b.step)
					? [a, b]
					: [b, a];
			const key = `${first.task}|${second.task}`;
			if (reported.has(key)) continue;
			reported.add(key);
			pushWarning(target, WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE, {
				cookware: shared,
				item: stepsLabel(first),
				other: stepsLabel(second),
				loc: locationOf(first.section),
			});
		}
	}
}

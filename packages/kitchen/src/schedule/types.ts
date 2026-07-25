import type { ProcessedStepItem } from "../types";

/**
 * A step (or comment) flattened out of a compiled section, carrying exactly
 * what the ALAP scheduling pass (see alap.ts/tracks.ts/rebase.ts) needs:
 * its own active-time cost, what intermediates it produces/consumes, and its
 * passive (background) tasks. `ls`/`lf` (latest start/finish) start at 0 and
 * are computed in place by scheduleALAP.
 *
 * Kept independent of the parser/AST on purpose (audit 2026-07-22, kitchen
 * finding F-004/P-001): every field here is either a plain value or a
 * reference to the already-built output object (`stepObj`), so the
 * scheduling phases can be unit-tested on synthetic arrays of this shape
 * without compiling a `.gram` source through the parser first — and so a
 * Rust port has an obvious, self-contained unit of translation.
 */
export interface StepSchedule {
	sectionIndex: number;
	stepObj: ProcessedStepItem;
	isComment: boolean;
	localActiveTime: number;
	productionTime: number;
	produced: string[];
	consumed: string[];
	passiveTasks: PassiveTask[];
	ls: number;
	lf: number;
}

interface PassiveTask {
	name: string;
	duration: number;
	localOffset: number;
	isNamed: boolean;
	sourceName?: string;
}

/** One passive task after track-contention resolution (tracks.ts). */
export interface ScheduledPassiveTask {
	sched: StepSchedule;
	task: PassiveTask;
	theoreticalStart: number;
	actualStart: number;
	actualEnd: number;
}

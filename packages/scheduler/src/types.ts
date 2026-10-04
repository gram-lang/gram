import type { MiseEnPlaceMode, RestChoice } from "./mode";

/** One line of a section's mise en place cost. */
export type MiseEnPlaceItem =
	| {
			kind: "gather";
			target: "ingredient" | "cookware";
			count: number;
			duration: number;
			/**
			 * How many of `count` are intermediates (`&dough`), present only when
			 * above zero. They are made during the recipe, so they can't be gathered
			 * before it starts.
			 */
			intermediates?: number;
	  }
	| {
			kind: "prepare";
			ref: { type: "ingredient" | "cookware"; id: string };
			duration: number;
			/** The ingredient is an intermediate (`&dough`); present only when true. */
			intermediate?: true;
	  };

/**
 * Mode-independent fact: what preparing section `section` costs. Present only
 * when the cost is above zero.
 */
export interface SectionMiseEnPlace {
	section: number; // index into CompilationResult.sections
	duration: number; // == sum of items[].duration (derived, kept so consumers needn't sum)
	items: MiseEnPlaceItem[];
}

export type ScheduleBlock =
	| {
			kind: "prep";
			/**
			 * The graph task it lays out; the first one when the block gathers
			 * several preparations that start and end together.
			 */
			task: string;
			section: number;
			start: number;
			end: number;
			/** Preparation of an intermediate, planned later than the rest of the section's. */
			deferred?: true;
			/**
			 * The part of the section's mise en place this block carries, present only
			 * when it isn't all of it (some of it was deferred or gathered elsewhere).
			 */
			items?: MiseEnPlaceItem[];
	  }
	| {
			kind: "step";
			task: string;
			section: number;
			step: number; // index in sections[section].steps (comments included)
			start: number;
			end: number;
	  }
	| {
			kind: "passive";
			task: string;
			section: number;
			step: number;
			track?: string; // only for named passive timers (~_name{})
			start: number;
			end: number;
	  };

/**
 * One working day of a timeline: `day` is 0 for the day itself, 1 for the day
 * before (`~{-1d}`), and so on. `start`/`end` bound its active work (passive
 * waiting is left out) and `sections` lists the sections prepared that day.
 */
export interface ScheduleSession {
	day: number;
	start: number;
	end: number;
	sections: number[];
}

/**
 * A complete timeline, in minutes from T0 = 0, preparation included. It
 * describes itself (`miseEnPlace`, `rests`), so a consumer never has to
 * remember which options produced it.
 */
export interface Schedule {
	miseEnPlace: MiseEnPlaceMode;
	rests: RestChoice;
	totalTime: number; // max(end) over blocks
	activeTime: number; // the cook's hands-on time, mise en place excluded
	preparationTime: number; // the mise en place, the sum of the `prep` tasks
	idleTime: number; // totalTime - activeTime - preparationTime
	blocks: ScheduleBlock[]; // sorted by start, then end
	sessions: ScheduleSession[]; // one per working day, furthest day first
}

export interface TimeBreakdownItem {
	label: string;
	duration: number; // in minutes
}

/**
 * The slice of a compiled section the scheduling passes read. A kitchen
 * `ProcessedSection` satisfies it as is; the scheduler knows nothing else
 * about sections (no AST, no steps, no ingredients).
 */
export interface SchedulingSection {
	// Only the breakdown labels of the legacy timeline read it.
	title?: string | null;
	/** The `~{-1d}` anchor, when the section has one. */
	retro_planning?: {
		value?: number;
		unit?: "d" | "h" | "min";
		minutes?: number;
	} | null;
	/** The intermediate (`->&dough`) the section as a whole produces. */
	intermediate_preparation?: string;
}

/**
 * A step (or comment) flattened out of a compiled section, carrying exactly
 * what the ALAP scheduling pass (see alap.ts/tracks.ts/rebase.ts) needs:
 * its own active-time cost, what intermediates it produces/consumes, and its
 * passive (background) tasks. `ls`/`lf` (latest start/finish) start at 0 and
 * are computed in place by scheduleALAP.
 *
 * Neutral on purpose (audit 2026-07-22, kitchen finding F-004/P-001): every
 * field is a plain value, so the scheduling phases can be unit-tested on
 * synthetic arrays of this shape without compiling a `.gram` source, and a
 * Rust port has an obvious, self-contained unit of translation. A step is
 * identified by its position in its section, never by a reference to the
 * compiled output: the scheduler writes nothing but its own records.
 */
export interface StepSchedule {
	/** The graph task the entry lays out (the block's `task`). */
	taskId: string;
	sectionIndex: number;
	// Index in the section's steps (comments included). Null only for a
	// synthetic mise en place entry (`isPrep`), which stands in for a section's
	// preparation and has no compiled step behind it.
	stepIndex: number | null;
	isComment: boolean;
	// True for the synthetic entry the per-section pass injects at the head of a
	// section: it is scheduled like any other work but reported as a `prep` block.
	isPrep?: boolean;
	// For an `isPrep` entry gathered at the head of another section's group: the
	// section whose preparation it is (defaults to `sectionIndex`).
	prepFor?: number;
	// For an `isPrep` entry: the preparation is an intermediate's, planned later.
	deferred?: boolean;
	// For an `isPrep` entry: the items it carries when that's not the whole entry.
	items?: MiseEnPlaceItem[];
	localActiveTime: number;
	productionTime: number;
	produced: string[];
	consumed: string[];
	passiveTasks: PassiveTask[];
	ls: number;
	lf: number;
}

export interface PassiveTask {
	/** The graph task of this timer. */
	taskId: string;
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

/**
 * A scheduling problem found while laying work out. The scheduler never builds
 * a user-facing message: the caller maps these onto its own registry and
 * words them (kitchen adds the title and the source location of `section`).
 */
export type SchedulingDiagnostic =
	| {
			code: "TIME_PARADOX";
			section: number;
			/** Where the dependency pulls the section's end, in minutes from T0 (negative: earlier). */
			pulledTo: number;
	  }
	| {
			code: "TRACK_CONTENTION";
			section: number;
			trackName: string;
			delay: number;
	  }
	| {
			code: "SESSION_OVERFLOW";
			/** The section of the session's earliest active work. */
			section: number;
			day: number;
			/** How far before the session's 24 h window its active work starts. */
			overflowMinutes: number;
	  };

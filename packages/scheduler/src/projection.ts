import type { LayoutOptions } from "./layout";
import type { TaskGraph } from "./graph";
import type { ScheduleBlock } from "./types";
import type { Weekday } from "./time";

/** A span of a day, "08:00" to "22:00". An `end` before `start` runs past midnight. */
export interface TimeRange {
	start: string;
	end: string;
}

/**
 * When the cook can work. An object rather than a union of shapes, so a key can
 * be added later without any consumer having to test for the form.
 */
export interface Availability {
	/** Every day, unless an exception says otherwise. */
	daily: TimeRange[];
	/** An exception for a day of the week; `[]` means not available at all. */
	weekdays?: Partial<Record<Weekday, TimeRange[]>>;
	/** An exception for a date ("2026-10-09"), which wins over the weekday's. */
	dates?: Record<string, TimeRange[]>;
}

/** Everything the projection needs to know about the reader, and nothing it reads from the machine. */
export interface ProjectionContext {
	/** When it is served: a local date-time, "2026-10-11T13:00", in `timeZone`. */
	serveAt: string;
	/** An IANA zone, "Europe/Paris". */
	timeZone: string;
	availability: Availability;
	/**
	 * The present, for `START_IN_PAST`: an ISO instant with `Z` or an offset, or a
	 * local time in `timeZone`. Without it, nothing is checked against the clock.
	 */
	now?: string;
}

export interface ProjectionInput {
	graph: TaskGraph;
	title?: string;
	options?: LayoutOptions;
}

type Dated<B> = B extends ScheduleBlock
	? Omit<B, "start" | "end"> & {
			/** ISO instant, UTC. */
			start: string;
			end: string;
			/** The same, as the wall clock of `timeZone` reads it: "2026-10-10T20:30". */
			startLocal: string;
			endLocal: string;
		}
	: never;

export type ProjectedBlock = Dated<ScheduleBlock>;

export interface ProjectedSession {
	day: number;
	start: string;
	end: string;
	startLocal: string;
	endLocal: string;
	sections: number[];
}

/** A rest the projection made longer or shorter, within the range the recipe allows. */
export interface RestAdjustment {
	task: string;
	/** Minutes before and after. */
	from: number;
	to: number;
	reason: "avoid-unavailable";
}

export type ProjectionDiagnostic =
	| {
			/** Hands-on work falls when the cook is not available and no rest can move it. */
			code: "ACTIVE_OUTSIDE_AVAILABILITY";
			/** The first task of the stretch of work. */
			task: string;
			/** When it starts, local. */
			local: string;
			/** The rest after it that fixes it in place, when there is one. */
			rest?: string;
	  }
	| {
			/** A stretch of work that cannot be interrupted is longer than any availability. */
			code: "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY";
			tasks: string[];
			minutes: number;
			/** The longest availability, in minutes. */
			largest: number;
	  }
	| {
			code: "SESSION_DAY_MISMATCH";
			day: number;
			/** The calendar date the day is meant to fall on. */
			expected: string;
			/** The date the work really falls on. */
			actual: string;
	  }
	| {
			code: "START_IN_PAST";
			/** ISO instant, UTC. */
			start: string;
			now: string;
	  }
	| {
			code: "MULTI_RECIPE_UNSUPPORTED";
			recipes: number;
	  };

export interface ProjectedPlan {
	serveAt: string;
	timeZone: string;
	recipes: {
		title?: string;
		blocks: ProjectedBlock[];
		sessions: ProjectedSession[];
	}[];
	adjustments: RestAdjustment[];
	/** When the cook is not available, within the plan: to grey it out on a chart. */
	unavailable: { start: string; end: string }[];
	diagnostics: ProjectionDiagnostic[];
}

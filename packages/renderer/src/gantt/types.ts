import type { ProjectedPlan } from "@gram-lang/scheduler";
import type { MiseEnPlaceMode, RestChoice } from "../types";

export type GanttTimeMode = "forward" | "reverse" | "target";

export interface GanttRenderOptions {
	/** Locale code (e.g. 'en', 'fr') for translating UI strings */
	lang?: string;
	/** Idle gaps at least this long (in minutes) get compressed. Default 60. */
	gapThresholdMinutes?: number;
	/** Virtual-minute width a compressed gap collapses to. Default 20. */
	compressedGapSize?: number;
	/** Where the mise en place goes. Default "perSection". */
	miseEnPlace?: MiseEnPlaceMode;
	/** How long a rest written as a range lasts. Default "shortest". */
	rests?: RestChoice;
	/**
	 * The recipe placed on the calendar by `project()` (`@gram-lang/scheduler`):
	 * the chart draws the plan's own blocks, so the rests it stretched show at
	 * their new length, the axis reads in real dates and times, and the hours
	 * the cook is not available are greyed out. `miseEnPlace` and `rests` are
	 * then those the plan was made with, and are ignored here.
	 */
	projection?: ProjectedPlan;
}

export interface GanttInteractivityOptions {
	timeMode: GanttTimeMode;
	/** "HH:MM", empty string when the user hasn't set one yet. */
	targetTime: string;
	isCompactMode: boolean;
}

export interface GanttInteractivityHandle {
	getOptions(): GanttInteractivityOptions;
	setOptions(opts: Partial<GanttInteractivityOptions>): void;
	dispose(): void;
}

export interface GanttTimeBlock {
	id: string;
	start: number;
	end: number;
	duration: number;
	label: string;
	tooltip: string;
	sectionIndex?: number | string;
	temperature?: string;
	isAssembly?: boolean;
	verticalIndex?: number;
	fitsInside?: boolean;
	/** A section's mise en place, drawn in its section colour. */
	isPrep?: boolean;
	/** A rest the projection made longer or shorter, with its length before and after, in minutes. */
	adjusted?: { from: number; to: number };
	/** Wall-clock readings of a projected block, for its tooltip. */
	startLabel?: string;
	endLabel?: string;
}

export interface GanttTrack {
	id: string;
	title: string;
	blocks: GanttTimeBlock[];
	type: "active" | "passive";
	dynamicHeight?: number;
}

export interface GanttTracksData {
	tracks: GanttTrack[];
	totalVirtualTime: number;
	maxRealTime: number;
	/** The compressed gaps the virtual times were computed with. */
	gaps: GanttGap[];
	/** Set for a projected chart: where it sits on the calendar. */
	calendar?: GanttCalendar;
}

/** A chart placed on the calendar: minute 0 of its axis is an instant in a zone. */
export interface GanttCalendar {
	/** Minutes since the epoch (UTC) of minute 0 of the axis. */
	origin: number;
	timeZone: string;
	/** The hours the cook is not available, in axis minutes, clipped to the chart. */
	unavailable: GanttGap[];
}

export interface GanttGap {
	start: number;
	end: number;
}

export interface GanttTimeTick {
	realTime: number;
	virtualPercent: number;
	label: string;
}

export interface GanttVisualGap {
	leftPercent: number;
	widthPercent: number;
	label: string;
}

export interface GanttLegendItem {
	id: string;
	title: string;
	colorClass: string;
}

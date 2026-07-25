export type GanttTimeMode = "forward" | "reverse" | "target";

export interface GanttRenderOptions {
	/** Locale code (e.g. 'en', 'fr') for translating UI strings */
	lang?: string;
	/** Idle gaps at least this long (in minutes) get compressed. Default 60. */
	gapThresholdMinutes?: number;
	/** Virtual-minute width a compressed gap collapses to. Default 20. */
	compressedGapSize?: number;
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

import { getDictionary } from "@gram-lang/i18n";
import type { ProcessedStep, ScheduleBlock } from "@gram-lang/kitchen";
import type {
	RenderContext,
	RenderableCompilationResult,
	ScheduleMode,
} from "../types";
import {
	describeMiseEnPlaceItem,
	miseEnPlaceForSection,
	resolveSchedule,
} from "../mise-en-place";
import { formatDuration } from "../utils";
import { formatElement } from "../formatters/element";
import { joinStepTokens } from "../utils";
import type {
	GanttGap,
	GanttLegendItem,
	GanttTimeTick,
	GanttTimeMode,
	GanttTrack,
	GanttTracksData,
	GanttVisualGap,
} from "./types";

const DEFAULT_GAP_THRESHOLD = 60; // minutes
const DEFAULT_COMPRESSED_GAP_SIZE = 20; // virtual minutes

export function formatTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.floor(minutes % 60);
	if (h > 0) {
		return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
	}
	return `${m}m`;
}

export function formatAxisTime(
	realTime: number,
	opts: { timeMode: GanttTimeMode; targetTime: string; maxRealTime: number },
): string {
	const { timeMode, targetTime, maxRealTime } = opts;
	if (timeMode === "reverse") {
		const diff = maxRealTime - realTime;
		if (diff === 0) return "T-0";
		return `T-${formatTime(diff)}`;
	}
	if (timeMode === "target" && targetTime) {
		const [th, tm] = targetTime.split(":").map(Number);
		if (
			th !== undefined &&
			tm !== undefined &&
			!Number.isNaN(th) &&
			!Number.isNaN(tm)
		) {
			const diff = maxRealTime - realTime;
			const totalTargetMins = th * 60 + tm;
			const timeAtTick = totalTargetMins - diff;

			// Handle negative times (previous day) or > 24h
			const normalizedTime = ((timeAtTick % 1440) + 1440) % 1440;
			const rh = Math.floor(normalizedTime / 60);
			const rm = normalizedTime % 60;

			const d = new Date();
			d.setHours(rh, rm, 0, 0);
			return new Intl.DateTimeFormat(undefined, {
				hour: "numeric",
				minute: "2-digit",
			}).format(d);
		}
	}
	return formatTime(realTime);
}

/**
 * Extract and merge active periods to find idle gaps eligible for
 * compression. Ported 1:1 from GramGantt.vue's `gaps` computed.
 */
export function computeGaps(
	data: RenderableCompilationResult,
	gapThreshold = DEFAULT_GAP_THRESHOLD,
	schedule: ScheduleMode = "perSection",
): GanttGap[] {
	const blocks = resolveSchedule(data, schedule)?.blocks;
	if (!blocks) return [];

	const activePeriods: { start: number; end: number }[] = [];
	let overallMaxRealTime = 0;

	for (const b of blocks) {
		// A zero-length step (a passive-only one) is not active work.
		if (b.kind === "passive" || b.end <= b.start) {
			overallMaxRealTime = Math.max(overallMaxRealTime, b.end);
			continue;
		}
		activePeriods.push({ start: b.start, end: b.end });
		overallMaxRealTime = Math.max(overallMaxRealTime, b.end);
	}

	// Add zero-duration periods at the start and end to compress
	// leading/trailing passive blocks.
	activePeriods.push({ start: 0, end: 0 });
	if (overallMaxRealTime > 0) {
		activePeriods.push({ start: overallMaxRealTime, end: overallMaxRealTime });
	}

	activePeriods.sort((a, b) => a.start - b.start);

	const merged: { start: number; end: number }[] = [];
	for (const period of activePeriods) {
		if (merged.length === 0) {
			merged.push({ ...period });
		} else {
			const last = merged[merged.length - 1]!;
			if (period.start <= last.end) {
				last.end = Math.max(last.end, period.end);
			} else {
				merged.push({ ...period });
			}
		}
	}

	const foundGaps: GanttGap[] = [];
	for (let i = 0; i < merged.length - 1; i++) {
		const current = merged[i]!;
		const next = merged[i + 1]!;
		const gapDuration = next.start - current.end;

		if (gapDuration >= gapThreshold) {
			foundGaps.push({ start: current.end, end: next.start });
		}
	}

	return foundGaps;
}

/** Maps real minutes to compressed "virtual" minutes given a set of gaps. */
export function getVirtualTime(
	realTime: number,
	gaps: GanttGap[],
	compressedGapSize = DEFAULT_COMPRESSED_GAP_SIZE,
): number {
	let subtracted = 0;

	for (const gap of gaps) {
		if (realTime <= gap.start) break;

		if (realTime >= gap.end) {
			const gapDuration = gap.end - gap.start;
			subtracted += gapDuration - compressedGapSize;
		} else {
			const timeInGap = realTime - gap.start;
			const gapDuration = gap.end - gap.start;
			const proportion = timeInGap / gapDuration;
			const virtualTimeInGap = proportion * compressedGapSize;
			subtracted += timeInGap - virtualTimeInGap;
		}
	}

	return realTime - subtracted;
}

function serializeStepContent(
	content: unknown[],
	registry: RenderContext["registry"],
	lang: string | undefined,
): string {
	if (!content || !Array.isArray(content)) return "";

	const renderContext: RenderContext = { registry, lang };

	const joined = joinStepTokens(
		content as Parameters<typeof joinStepTokens>[0],
		(c) => {
			if (typeof c === "string") return c;
			if (c && typeof c === "object") {
				const md = formatElement(c, "md", renderContext);
				// Strip basic markdown formatting from tooltip text.
				return md.replace(/[*_👉]/gu, "");
			}
			return "";
		},
		(c) =>
			typeof c !== "string" &&
			(c as unknown as Record<string, unknown>).type !== "comment",
	);

	return joined.replace(/\s+/g, " ").trim();
}

/** The temperature target and assembly flag of a step's content tokens. */
function readStepInfo(step: ProcessedStep): {
	temperature?: string;
	isAssembly: boolean;
} {
	let temperature: string | undefined;
	let isAssembly = false;
	// Step content tokens are a discriminated union (declarations,
	// references, temperatures, plain strings, ...) — narrowing each
	// member out just to read `.text`/`.quantity`/`.unit` here would
	// bury the actual logic, same tradeoff html.ts already makes for
	// step content (see its `(c: any) => ...` filters).
	for (const c of (step.content ?? []) as unknown as Record<
		string,
		unknown
	>[]) {
		if (c && typeof c === "object") {
			if (c.type === "temperature") {
				temperature =
					(c.text as string | undefined) ||
					(c.quantity
						? `${typeof c.quantity === "object" ? (c.quantity as Record<string, unknown>).value : c.quantity}${c.unit || "C"}`
						: undefined);
			}
			if (c.type === "reference") {
				isAssembly = true;
			}
		}
	}
	return { temperature, isAssembly };
}

/**
 * Build the active/passive tracks and their blocks from the chosen timeline
 * (`data.schedules[schedule].blocks`); the step blocks point back at the
 * compiled steps for their label, temperature and assembly flag.
 */
export function buildTracks(
	data: RenderableCompilationResult,
	opts: { lang?: string; schedule?: ScheduleMode } = {},
): GanttTracksData {
	const sections = data?.sections;
	const blocks: ScheduleBlock[] | undefined = resolveSchedule(
		data,
		opts.schedule,
	)?.blocks;
	if (!sections || !blocks) {
		return { tracks: [], totalVirtualTime: 0, maxRealTime: 0 };
	}

	const t = getDictionary(opts.lang);
	const gaps = computeGaps(data, DEFAULT_GAP_THRESHOLD, opts.schedule);
	const registry = data.registry;

	const cookTrack: GanttTrack = {
		id: "cook",
		title: t.playground?.views?.gantt_cook || "Actions",
		blocks: [],
		type: "active",
	};
	const passiveTracksMap = new Map<string, GanttTrack>();

	let maxRealTime = 0;
	let activeStepIndex = 0;

	const isSingleUnnamedSection = sections.length === 1 && !sections[0]?.title;
	const colorOf = (section: number): number | string =>
		isSingleUnnamedSection ? "default" : section % 9;

	for (const b of blocks) {
		const duration = b.end - b.start;

		if (b.kind === "prep") {
			const label = t.renderer?.miseEnPlace || "Mise en place";
			const entry = miseEnPlaceForSection(data, b.section);
			const detail = (entry?.items ?? [])
				.map((item) =>
					describeMiseEnPlaceItem(item, registry, t.renderer, formatDuration),
				)
				.join(" · ");
			cookTrack.blocks.push({
				id: `prep_${b.section}`,
				start: b.start,
				end: b.end,
				duration,
				label,
				tooltip: detail || label,
				sectionIndex: colorOf(b.section),
				verticalIndex: activeStepIndex++,
				fitsInside: duration * 12 >= label.length * 7 + 36,
				isPrep: true,
			});
			maxRealTime = Math.max(maxRealTime, b.end);
			continue;
		}

		const step = sections[b.section]?.steps[b.step];
		if (!step || step.type !== "step") continue;
		const { temperature, isAssembly } = readStepInfo(step);

		if (b.kind === "step") {
			// A zero-length step (a passive-only one) has no active block.
			if (duration <= 0) continue;
			const fullText = serializeStepContent(step.content, registry, opts.lang);
			const label = step.action || t.playground?.views?.gantt_cook || "Actions";

			cookTrack.blocks.push({
				id: `cook_${b.start}`,
				start: b.start,
				end: b.end,
				duration,
				label,
				tooltip:
					fullText.length > 100 ? fullText.substring(0, 100) + "..." : fullText,
				sectionIndex: colorOf(b.section),
				isAssembly,
				verticalIndex: activeStepIndex++,
				fitsInside: duration * 12 >= label.length * 7 + 36,
				temperature,
			});
			maxRealTime = Math.max(maxRealTime, b.end);
			continue;
		}

		// Passive block: a named track keeps its own row, anonymous timers share one.
		const trackName = b.track || t.playground?.views?.gantt_timer || "Timer";
		if (!passiveTracksMap.has(trackName)) {
			passiveTracksMap.set(trackName, {
				id: `track_${trackName}`,
				title: trackName.charAt(0).toUpperCase() + trackName.slice(1),
				blocks: [],
				type: "passive",
			});
		}
		passiveTracksMap.get(trackName)?.blocks.push({
			id: `task_${b.start}_${b.track}`,
			start: b.start,
			end: b.end,
			duration,
			label: formatTime(duration),
			tooltip: trackName,
			temperature,
		});
		maxRealTime = Math.max(maxRealTime, b.end);
	}

	cookTrack.dynamicHeight = Math.max(48, activeStepIndex * 40 + 16);

	const tracks = [cookTrack, ...Array.from(passiveTracksMap.values())];
	const totalVirtualTime = getVirtualTime(maxRealTime, gaps);

	return { tracks, totalVirtualTime, maxRealTime };
}

/** Axis tick calculation. Ported 1:1 from GramGantt.vue's `timeTicks` computed. */
export function computeTimeTicks(
	maxRealTime: number,
	totalVirtualTime: number,
	gaps: GanttGap[],
	timeMode: GanttTimeMode,
	targetTime: string,
): GanttTimeTick[] {
	const ticks: GanttTimeTick[] = [];

	let interval = 10;
	if (totalVirtualTime > 120) interval = 30;
	if (totalVirtualTime > 300) interval = 60;
	if (totalVirtualTime > 1200) interval = 240;

	const label = (realTime: number) =>
		formatAxisTime(realTime, { timeMode, targetTime, maxRealTime });

	for (let t = 0; t <= maxRealTime; t += interval) {
		let inGap = false;
		for (const gap of gaps) {
			if (t > gap.start && t < gap.end) {
				inGap = true;
				break;
			}
		}
		if (inGap) continue;

		ticks.push({
			realTime: t,
			virtualPercent: (getVirtualTime(t, gaps) / totalVirtualTime) * 100,
			label: label(t),
		});
	}

	// Add final tick if it doesn't align, avoiding text collisions with the
	// last regular tick.
	if (maxRealTime % interval !== 0 && maxRealTime > 0) {
		let inGap = false;
		for (const gap of gaps) {
			if (maxRealTime > gap.start && maxRealTime < gap.end) {
				inGap = true;
				break;
			}
		}
		if (!inGap) {
			const finalVirtualPercent = 100;
			if (ticks.length > 0) {
				const lastTick = ticks[ticks.length - 1]!;
				if (finalVirtualPercent - lastTick.virtualPercent < 5) {
					ticks.pop();
				}
			}
			ticks.push({
				realTime: maxRealTime,
				virtualPercent: finalVirtualPercent,
				label: label(maxRealTime),
			});
		}
	}

	return ticks;
}

/** Zig-zag "compressed" overlay regions. Ported 1:1 from `visualGaps` computed. */
export function computeVisualGaps(
	gaps: GanttGap[],
	totalVirtualTime: number,
): GanttVisualGap[] {
	return gaps.map((g) => {
		const vStart = getVirtualTime(g.start, gaps);
		const vEnd = getVirtualTime(g.end, gaps);
		const skipped = g.end - g.start;
		return {
			leftPercent: (vStart / totalVirtualTime) * 100,
			widthPercent: ((vEnd - vStart) / totalVirtualTime) * 100,
			label: `⏳ ${formatTime(skipped)}`,
		};
	});
}

/** Section legend entries. Ported 1:1 from `sectionLegendItems` computed. */
export function computeSectionLegendItems(
	data: RenderableCompilationResult,
	lang?: string,
): GanttLegendItem[] {
	const sections = data?.sections;
	if (!sections) return [];
	const t = getDictionary(lang);

	const isSingleUnnamed = sections.length === 1 && !sections[0]?.title;

	if (isSingleUnnamed) {
		return [
			{
				id: "default",
				title: t.playground?.views?.gantt_active || "Actions",
				colorClass: "section-color-default",
			},
		];
	}

	return sections.map((sec, idx: number) => {
		const s = sec as unknown as Record<string, unknown>;
		return {
			id: (s.id as string | undefined) || `section_${idx}`,
			title:
				(s.title as string | undefined) ||
				`${t.playground?.views?.gantt_section || "Section"} ${idx + 1}`,
			colorClass: `section-color-${idx % 9}`,
		};
	});
}

import {
	DEFAULT_MISE_EN_PLACE_MODE,
	type MiseEnPlaceItem,
	type ScheduleBlock,
	type MiseEnPlaceMode,
	type SectionMiseEnPlace,
	scheduleFor,
} from "@gram-lang/kitchen";
import type { RenderableCompilationResult } from "./types";

/** True when each section carries its own preparation (the default). */
export const isPerSection = (mode: MiseEnPlaceMode | undefined): boolean =>
	(mode ?? DEFAULT_MISE_EN_PLACE_MODE) === "perSection";

/** What preparing section `index` costs, when it costs anything. */
export function miseEnPlaceForSection(
	data: RenderableCompilationResult,
	index: number,
): SectionMiseEnPlace | undefined {
	return data.miseEnPlace?.find((m) => m.section === index);
}

interface Labels {
	ingredientsOverhead: string;
	cookwareOverhead: string;
	breakdownPrep: string;
	colon: string;
}

/**
 * Plain-text (not escaped) description of one line of a section's mise en
 * place — callers escape it for their own output format. Names come from the
 * registry, never from a parsed label.
 *
 * A preparation says how long it takes unless `showDuration` is false, for the
 * callers that print the duration in a column of their own.
 */
export function describeMiseEnPlaceItem(
	item: MiseEnPlaceItem,
	registry: RenderableCompilationResult["registry"] | undefined,
	labels: Labels,
	formatDuration: (minutes: number) => string,
	{ showDuration = true }: { showDuration?: boolean } = {},
): string {
	if (item.kind === "gather") {
		const label =
			item.target === "ingredient"
				? labels.ingredientsOverhead
				: labels.cookwareOverhead;
		return `${label} (${item.count} × ${formatDuration(item.duration / item.count)})`;
	}
	const entry =
		item.ref.type === "cookware"
			? registry?.cookware?.[item.ref.id]
			: registry?.ingredients?.[item.ref.id];
	const name = entry?.name ?? item.ref.id;
	const prepared = `${labels.breakdownPrep}${labels.colon}${name}`;
	return showDuration
		? `${prepared} (+ ${formatDuration(item.duration)})`
		: prepared;
}

/**
 * The mise en place items a `prep` block stands for: the part it carries when
 * the section's was split, else the whole entry of its section.
 */
export function prepItems(
	data: RenderableCompilationResult,
	block: Extract<ScheduleBlock, { kind: "prep" }>,
): MiseEnPlaceItem[] {
	return block.items ?? miseEnPlaceForSection(data, block.section)?.items ?? [];
}

/**
 * What is prepared right before section `index` in the chosen schedule: all of
 * its mise en place by section, or only what was left for later (an
 * intermediate made the same day) in the others, where the rest is gathered at
 * the start of the session (see `sessionMiseEnPlace`).
 */
export function ownMiseEnPlace(
	data: RenderableCompilationResult,
	mode: MiseEnPlaceMode | undefined,
	index: number,
): { duration: number; items: MiseEnPlaceItem[] } | undefined {
	if (isPerSection(mode)) return miseEnPlaceForSection(data, index);
	const blocks = (scheduleFor(data, mode)?.blocks ?? []).filter(
		(b): b is Extract<ScheduleBlock, { kind: "prep" }> =>
			b.kind === "prep" && !!b.deferred && b.section === index,
	);
	if (blocks.length === 0) return undefined;
	return {
		duration: blocks.reduce((sum, b) => sum + b.end - b.start, 0),
		items: blocks.flatMap((b) => prepItems(data, b)),
	};
}

/** The label of a working day: "D-3", or "Day D" for the day itself. */
export const sessionDayLabel = (
	day: number,
	labels: { sessionDay: string; sessionToday: string },
): string => (day === 0 ? labels.sessionToday : `${labels.sessionDay}${day}`);

/** One session's mise en place, as plain text to escape per output format. */
export interface SessionMiseEnPlace {
	/** "Mise en place", followed by its day ("— D-3") when the recipe spans several. */
	heading: string;
	duration: number;
	lines: { section: number; title: string | undefined; text: string }[];
}

interface SessionLabels extends Labels {
	miseEnPlace: string;
	sessionDay: string;
	sessionToday: string;
}

/**
 * The mise en place gathered at the start of each session, keyed by the first
 * section of that session (where callers print it). Empty for `perSection`,
 * where each section carries its own, and for JSON without `sessions`.
 */
export function sessionMiseEnPlace(
	data: RenderableCompilationResult,
	mode: MiseEnPlaceMode | undefined,
	labels: SessionLabels,
	formatDuration: (minutes: number) => string,
): Map<number, SessionMiseEnPlace> {
	const out = new Map<number, SessionMiseEnPlace>();
	if (isPerSection(mode)) return out;
	const schedule = scheduleFor(data, mode);
	const sessions = schedule?.sessions ?? [];
	for (const session of sessions) {
		const first = session.sections[0];
		if (first === undefined) continue;
		const lines: SessionMiseEnPlace["lines"] = [];
		let duration = 0;
		for (const section of [...session.sections].sort((a, b) => a - b)) {
			const blocks = (schedule?.blocks ?? []).filter(
				(b): b is Extract<ScheduleBlock, { kind: "prep" }> =>
					b.kind === "prep" && !b.deferred && b.section === section,
			);
			const items = blocks.flatMap((b) => prepItems(data, b));
			if (items.length === 0) continue;
			duration += blocks.reduce((sum, b) => sum + b.end - b.start, 0);
			lines.push({
				section,
				title: data.sections?.[section]?.title || undefined,
				text: items
					.map((item) =>
						describeMiseEnPlaceItem(
							item,
							data.registry,
							labels,
							formatDuration,
						),
					)
					.join(" · "),
			});
		}
		if (lines.length === 0) continue;
		out.set(first, {
			heading:
				sessions.length < 2
					? labels.miseEnPlace
					: `${labels.miseEnPlace} — ${sessionDayLabel(session.day, labels)}`,
			duration,
			lines,
		});
	}
	return out;
}

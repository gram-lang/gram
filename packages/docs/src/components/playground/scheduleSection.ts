import type { GramLocale } from "@gram-lang/i18n";
import type { MiseEnPlaceMode, RestChoice } from "@gram-lang/kitchen";
import { VIEW_SETTINGS } from "@gram-lang/renderer";
import { type PlanSettings, serveAtLabel } from "./planSettings";
import { settingValueLabel } from "./settingLabels";

/** What the "Schedule & Service" section reads of the playground. */
export interface ScheduleState {
	plan?: PlanSettings;
	schedule?: MiseEnPlaceMode;
	rests?: RestChoice;
}

/** Serving times that work, why the others don't, and the earliest from now. */
export interface ServeSuggestions {
	candidates: { serveAt: string; label: string; title: string }[];
	rejected: string[];
	earliest: { serveAt: string; label: string; text: string } | null;
}

const DEFAULT_SCHEDULE = VIEW_SETTINGS.miseEnPlace.default;
const DEFAULT_RESTS = VIEW_SETTINGS.rests.default;

/** Whether any of the section's settings is not its default. */
export function isScheduleModified(state: ScheduleState): boolean {
	return Boolean(
		state.plan?.serveAt ||
			state.plan?.customWeekdays ||
			(state.schedule && state.schedule !== DEFAULT_SCHEDULE) ||
			(state.rests && state.rests !== DEFAULT_RESTS),
	);
}

/** What the section changed, in a few words: the tooltip of its dot. */
export function scheduleBadgeTitle(
	state: ScheduleState,
	t: GramLocale,
	lang: string,
): string {
	const badges = t.playground.badges;
	const renderer = t.renderer;
	const parts: string[] = [];
	if (state.plan?.serveAt) {
		parts.push(
			badges.serveAt.replace("{time}", serveAtLabel(state.plan.serveAt, lang)),
		);
	}
	if (state.plan?.customWeekdays) parts.push(badges.customHours);
	if (state.schedule && state.schedule !== DEFAULT_SCHEDULE) {
		parts.push(
			`${renderer.scheduleLabel}: ${settingValueLabel("miseEnPlace", state.schedule, t)}`,
		);
	}
	if (state.rests && state.rests !== DEFAULT_RESTS) {
		parts.push(
			`${renderer.restsLabel}: ${settingValueLabel("rests", state.rests, t)}`,
		);
	}
	return parts.join(" · ") || badges.active;
}

/** The suggested serving times, without the earliest one, which has a pill of its own. */
export function otherCandidates(
	suggestions: ServeSuggestions | null | undefined,
) {
	if (!suggestions?.candidates) return [];
	const earliestServeAt = suggestions.earliest?.serveAt;
	if (!earliestServeAt) return suggestions.candidates;
	return suggestions.candidates.filter((c) => c.serveAt !== earliestServeAt);
}

/** "Earliest: Sun 11 Oct, 13:00" */
export function earliestLabel(t: GramLocale, label: string): string {
	return t.renderer.serving.earliest.replace("{when}", label);
}

/** The tooltip of the earliest pill: what it says, then why that time works. */
export function earliestTooltip(
	suggestions: ServeSuggestions | null | undefined,
): string {
	if (!suggestions?.earliest) return "";
	const earliest = suggestions.earliest;
	const match = suggestions.candidates.find(
		(c) => c.serveAt === earliest.serveAt,
	);
	if (match?.title) return `${earliest.text}\n• ${match.title}`;
	return earliest.text;
}

/** The tooltip that says why the other serving times were left out. */
export function rejectedTooltip(
	suggestions: ServeSuggestions | null | undefined,
	t: GramLocale,
): string {
	if (!suggestions?.rejected?.length) return "";
	return [
		t.playground.options.rejectedSlots,
		...suggestions.rejected.map((r) => `• ${r}`),
	].join("\n");
}

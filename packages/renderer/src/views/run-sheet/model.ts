import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type {
	MiseEnPlaceMode,
	ProjectionDiagnostic,
	RunSheet,
} from "@gram-lang/scheduler";
import { workingDayLabel } from "../../shared/mise-en-place";
import { portionsLabel } from "../../shared/portions";
import { formatDuration } from "../../shared/utils";
import type { CommentsMode, RenderableCompilationResult } from "../../types";
import { longDate, shortDay } from "./dates";
import type { KitItem, ProgramStep } from "./parts";
import { type VisitPass, describeDay, startPass } from "./visits";
import { plural, roundedClock, runSheetWords } from "./words";

export interface RunSheetRenderOptions {
	/** Locale code (e.g. 'en', 'fr') for the words and the dates. */
	lang?: string;
	/** Display only: a time is shown to the nearest this many minutes. Default 5. */
	roundTo?: number;
	formatDuration?: (minutes: number) => string;
	/**
	 * Show (`"show"`, the default) or hide (`"hide"`) the comments of the
	 * recipe in the steps: a note alone on a line, and one at the end of a line.
	 */
	comments?: CommentsMode;
}

/** One line of the schedule of the days: a visit, what continues without the cook, or the service. */
export interface RunSheetScheduleRow {
	kind: "visit" | "thread" | "serve";
	/** "THU 15", "D-2": set on the first row of a day only. */
	day?: string;
	/** "21:00 – 21:55", "about 55 min", "20:00". */
	time?: string;
	/** The sections of a visit, the wait of a thread, "Serve". */
	text: string;
}

/** One thing to take out, in words. */
export interface RunSheetKitLine {
	kind: KitItem["kind"];
	/** "milk 100 g", "Sponge, made Thursday". */
	text: string;
	/** "60 + 30" when a quantity is the sum of several. */
	detail?: string;
	/** The parts of `text`, for a view that sets them apart: "milk", "100 g", "in stock". */
	name: string;
	quantity?: string;
	/** "260 g": the weight, for a quantity written in another unit. */
	mass?: string;
	note?: string;
}

/**
 * Things to take out together, at the top of a visit (`perDay`, `upfront`).
 * In `perSection` mode they are on the programme lines instead; a group with a
 * `section` is only left for a section that has no step of its own in the visit.
 */
export interface RunSheetKitGroup {
	/** The section the things are for. */
	section?: string;
	items: RunSheetKitLine[];
}

/**
 * One step of a section in a visit, in words: the number the recipe view gives
 * it, its action and its text as HTML, Markdown and plain text. A standalone
 * comment is a line of its own, with no number.
 */
export type RunSheetStepLine = ProgramStep;

/** What a visit asks of one section: where to read it in the recipe, and what to do. */
export interface RunSheetProgramLine {
	/** "Mousse" */
	section: string;
	/** "steps 1 to 3", "sponge.gram, steps 1 to 3" */
	reference: string;
	/** The file an imported section comes from, "sponge.gram". */
	origin?: string;
	/** "11:55": when the section starts in this visit. Only in a plan with a serving time. */
	startTime?: string;
	/** True when the section was already worked in an earlier visit: this one goes on with it. */
	continued?: boolean;
	/** The steps of the section done in this visit, in recipe order. */
	steps: RunSheetStepLine[];
	/** In `perSection` mode, what to take out for this section, right before its steps. */
	kit?: RunSheetKitLine[];
}

/** One moment in the kitchen, in words. */
export interface RunSheetVisitModel {
	/** "21:20 → 22:00", "about 40 min". */
	slot: string;
	/** "Possible from 18:00." or the fixed times that hold it. */
	margin?: string;
	kit: RunSheetKitGroup[];
	program: RunSheetProgramLine[];
	/** What continues without the cook, then when to come back. */
	leaving: string[];
	/** The last of `leaving`: when to come back, or the service. */
	next?: string;
	/** What continues without the cook, one by one, for a view that sets name and length apart. */
	waits: RunSheetWaitLine[];
}

/** One thing that goes on without the cook. */
export interface RunSheetWaitLine {
	/** "Dough : Fridge" */
	name: string;
	/** "24 h", "12 h to 72 h", "1h (12 h to 72 h)" */
	length: string;
	/** "until 21:00", when the rest ends before the next visit. */
	until?: string;
}

export interface RunSheetDayModel {
	/** "Friday, October 16" in a plan with a serving time, "D-1" without. */
	heading: string;
	/** The slots of the day's visits, "21:20 → 22:00". */
	slot: string;
	/** Rests the plan stretched or shortened. */
	notices: string[];
	visits: RunSheetVisitModel[];
}

/** The run sheet in words: what every output (text, Markdown, HTML, calendar) is made from. */
export interface RunSheetModel {
	/** "Run sheet — Entremets" */
	title: string;
	/** Where the mise en place goes: the run sheet is laid out accordingly. */
	miseEnPlace: MiseEnPlaceMode;
	/** "For Saturday, October 17 at 20:00 · 6 portions" */
	subtitle: string;
	/** "3 days · 4 visits to the kitchen · 1h 40m of work in all" */
	summary: string;
	/** What the plan could not fix. */
	problems: string[];
	schedule: RunSheetScheduleRow[];
	days: RunSheetDayModel[];
	/** The calendar events, one per visit: when and what, ready for a calendar. */
	events: RunSheetEvent[];
}

/** A visit as a calendar event, in UTC. Only for a plan with a serving time. */
export interface RunSheetEvent {
	/** "2026-10-16T19:20:00Z" */
	start: string;
	end: string;
	/** "Entremets · Mousse, Montage" */
	title: string;
	/** To take out, then the programme, as plain lines. */
	description: string;
}

/** What the plan could not fix, one sentence each. */
export function describeProblems(
	diagnostics: ProjectionDiagnostic[],
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions,
	timeZone: string,
): string[] {
	const t = getDictionary(options.lang).renderer;
	const lang = options.lang;
	const step = options.roundTo && options.roundTo > 0 ? options.roundTo : 5;
	const fmt = options.formatDuration ?? formatDuration;
	const tasks = new Map((data.tasks?.tasks ?? []).map((x) => [x.id, x]));
	const sectionTitle = (index: number) =>
		data.sections?.[index]?.title || t.runSheetUnnamedSection;
	const stepName = (section: number, index: number) => {
		const s = data.sections?.[section]?.steps[index];
		return s?.type === "step" ? s.action : undefined;
	};
	const labelOf = (id: string): string => {
		const task = tasks.get(id);
		if (!task) return id;
		if (task.kind === "prep") {
			return `${t.miseEnPlace} — ${sectionTitle(task.section)}`;
		}
		return `${sectionTitle(task.section)} — ${stepName(task.section, task.step) || t.runSheetStep.replace("{n}", String(task.step + 1))}`;
	};
	const when = (iso: string) =>
		new Intl.DateTimeFormat(lang || "en", {
			timeZone,
			weekday: "short",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(new Date(iso));
	return diagnostics.map((d): string => {
		switch (d.code) {
			case "ACTIVE_OUTSIDE_AVAILABILITY":
				return fillTemplate(t.runSheetOutside, {
					task: labelOf(d.task),
					time: `${shortDay(d.local.slice(0, 10), lang)} ${roundedClock(d.local, step)}`,
				});
			case "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY":
				return fillTemplate(t.runSheetExceeds, {
					task: [
						...new Set(
							d.tasks.map((id) => sectionTitle(tasks.get(id)?.section ?? 0)),
						),
					].join(" + "),
					duration: fmt(d.minutes),
					largest: fmt(d.largest),
				});
			case "DAY_MISMATCH":
				return fillTemplate(t.runSheetDayMismatch, {
					day: workingDayLabel(d.day, t),
					actual: longDate(d.actual, lang),
					expected: longDate(d.expected, lang),
				});
			case "START_IN_PAST":
				return fillTemplate(t.runSheetPast, {
					start: when(d.start),
					now: when(d.now),
				});
			case "MULTI_RECIPE_UNSUPPORTED":
				return fillTemplate(t.runSheetMulti, { count: String(d.recipes) });
			default: {
				// A new code in the scheduler is a compile error here, not a blank line.
				const unknown: never = d;
				return String(unknown);
			}
		}
	});
}

/** The subtitle (when, for how many) and the summary (days, visits, work) of a run sheet. */
function describeSummary(pass: VisitPass) {
	const { sheet, data, days, w } = pass;
	const { t, lang, calendar, fmt, rounded } = w;
	const visits = days.reduce((n, d) => n + d.visits.length, 0);
	const subtitle = [
		calendar && sheet.serveAt
			? fillTemplate(t.runSheetFor, {
					date: longDate(sheet.serveAt.slice(0, 10), lang),
					time: sheet.serveAt.slice(11, 16),
				})
			: undefined,
		portionsLabel(data, lang),
	]
		.filter(Boolean)
		.join(" · ");
	const summary =
		days.length === 0
			? t.runSheetNothing
			: [
					plural(days.length, t.runSheetDays, t.runSheetDaysMany),
					plural(visits, t.runSheetVisits, t.runSheetVisitsMany),
					fillTemplate(t.runSheetWork, {
						duration: fmt(rounded(sheet.recipes[0]?.totalWork ?? 0)),
					}),
				].join(" · ");
	return { subtitle, summary };
}

/**
 * The words of a run sheet, from its structure (`runSheet()` of the scheduler)
 * and the recipe it is for. Every figure is the scheduler's; what is chosen
 * here is the wording and the rounding, which another interface is free to
 * make differently from the same data.
 *
 * The words and the clock are built once (`words.ts`), the days and their
 * visits are described in order (`visits.ts`); this chains them.
 */
export function describeRunSheet(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): RunSheetModel {
	const w = runSheetWords(data, options, sheet.mode === "calendar");
	const pass = startPass(sheet, data, options, w);
	const { t, calendar } = w;

	const schedule: RunSheetScheduleRow[] = [];
	const events: RunSheetEvent[] = [];
	const days: RunSheetDayModel[] = [];
	pass.days.forEach((day, d) => {
		const described = describeDay(pass, day, d);
		schedule.push(...described.rows);
		events.push(...described.events);
		days.push(described.model);
	});

	// The service closes the schedule.
	if (pass.days.length > 0) {
		schedule.push({
			kind: "serve",
			...(!calendar &&
				pass.days.at(-1)?.daysBefore !== 0 && { day: workingDayLabel(0, t) }),
			...(calendar && sheet.serveAt && { time: sheet.serveAt.slice(11, 16) }),
			text: t.runSheetServe,
		});
	}

	const { subtitle, summary } = describeSummary(pass);
	return {
		title: pass.recipeTitle
			? `${t.runSheetTitle} — ${pass.recipeTitle}`
			: t.runSheetTitle,
		miseEnPlace: pass.mode,
		subtitle,
		summary,
		problems: describeProblems(
			sheet.diagnostics,
			data,
			options,
			sheet.timeZone ?? "UTC",
		),
		schedule,
		days,
		events,
	};
}

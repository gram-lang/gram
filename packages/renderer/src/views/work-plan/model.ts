import { getDictionary } from "@gram-lang/i18n";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	type MiseEnPlaceMode,
	type ProjectionDiagnostic,
	type RunSheet,
	type RunSheetDay,
	type RunSheetVisit,
	type RunSheetThread,
	visitSections,
} from "@gram-lang/scheduler";
import { workingDayLabel } from "../../shared/mise-en-place";
import type { CommentsMode, RenderableCompilationResult } from "../../types";
import {
	type KitItem,
	kitCookware,
	kitIngredients,
	kitPrepared,
	type ProgramStep,
	sectionProgram,
	sectionSteps,
} from "./parts";
import { formatDuration } from "../../shared/utils";
import { kitLines } from "./lines";

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

/** One line of the planning of the days: a visit, what continues without the cook, or the service. */
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

/** The work plan in words: what every output (text, Markdown, HTML, calendar) is made from. */
export interface RunSheetModel {
	/** "Work plan — Entremets" */
	title: string;
	/** Where the mise en place goes: the work plan is laid out accordingly. */
	miseEnPlace: MiseEnPlaceMode;
	/** "For Saturday, October 17 at 20:00 · 6 servings" */
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

const pad = (n: number) => String(n).padStart(2, "0");

/** "21:38" shown as "21:40": the calculation stays to the minute, only the display rounds. */
function roundedClock(local: string, step: number): string {
	const minutes =
		Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
	const rounded = (Math.round(minutes / step) * step) % 1440;
	return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
}

/** Midday UTC of a "YYYY-MM-DD" date: a safe instant to name a calendar day with `timeZone: "UTC"`. */
const noonOf = (date: string) =>
	Date.UTC(
		Number(date.slice(0, 4)),
		Number(date.slice(5, 7)) - 1,
		Number(date.slice(8, 10)),
		12,
	);

const dateFormat = (
	date: string,
	lang: string | undefined,
	options: Intl.DateTimeFormatOptions,
) =>
	new Intl.DateTimeFormat(lang || "en", { timeZone: "UTC", ...options }).format(
		noonOf(date),
	);

const longDate = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "long", day: "numeric", month: "long" });

const weekdayName = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "long" });

const shortDay = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "short" });

/** What a rest is called: its track, else the action of its step, else "Rest". */
const restName = (
	fallback: string,
	track: string | undefined,
	action: string | undefined,
) =>
	track !== undefined
		? track.charAt(0).toUpperCase() + track.slice(1)
		: action || fallback;

export const fill = (template: string, values: Record<string, string>) =>
	template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

const plural = (n: number, one: string, many: string) =>
	fill(n === 1 ? one : many, { n: String(n) });

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
				return fill(t.runSheetOutside, {
					task: labelOf(d.task),
					time: `${shortDay(d.local.slice(0, 10), lang)} ${roundedClock(d.local, step)}`,
				});
			case "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY":
				return fill(t.runSheetExceeds, {
					task: [
						...new Set(
							d.tasks.map((id) => sectionTitle(tasks.get(id)?.section ?? 0)),
						),
					].join(" + "),
					duration: fmt(d.minutes),
					largest: fmt(d.largest),
				});
			case "DAY_MISMATCH":
				return fill(t.runSheetDayMismatch, {
					day: workingDayLabel(d.day, t),
					actual: longDate(d.actual, lang),
					expected: longDate(d.expected, lang),
				});
			case "START_IN_PAST":
				return fill(t.runSheetPast, { start: when(d.start), now: when(d.now) });
			case "MULTI_RECIPE_UNSUPPORTED":
				return fill(t.runSheetMulti, { count: String(d.recipes) });
			default: {
				// A new code in the scheduler is a compile error here, not a blank line.
				const unknown: never = d;
				return String(unknown);
			}
		}
	});
}

/**
 * The words of a work plan, from its structure (`runSheet()` of the scheduler)
 * and the recipe it is for. Every figure is the scheduler's; what is chosen
 * here is the wording and the rounding, which another interface is free to
 * make differently from the same data.
 */
export function describeRunSheet(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): RunSheetModel {
	const t = getDictionary(options.lang).renderer;
	const lang = options.lang;
	const step = options.roundTo && options.roundTo > 0 ? options.roundTo : 5;
	const fmt = options.formatDuration ?? formatDuration;
	const calendar = sheet.mode === "calendar";
	const recipe = sheet.recipes[0];
	const days = recipe?.days ?? [];
	const tasks = new Map((data.tasks?.tasks ?? []).map((x) => [x.id, x]));

	const sectionTitle = (index: number) =>
		data.sections?.[index]?.title || t.runSheetUnnamedSection;
	const stepAction = (section: number, index: number | undefined) => {
		if (index === undefined) return undefined;
		const s = data.sections?.[section]?.steps[index];
		return s?.type === "step" ? s.action : undefined;
	};
	const waitName = (w: { section: number; step?: number; track?: string }) =>
		`${sectionTitle(w.section)} : ${restName(t.runSheetRest, w.track, stepAction(w.section, w.step))}`;
	const clock = (local: string) => roundedClock(local, step);
	const rounded = (minutes: number) =>
		Math.max(step, Math.round(minutes / step) * step);
	const dayLabel = (day: RunSheetDay) => workingDayLabel(day.daysBefore, t);
	const rangeOf = (id: string) => {
		const task = tasks.get(id);
		if (task?.kind !== "passive") return undefined;
		const { min, max } = task.duration;
		return min !== undefined && max !== undefined && min < max
			? { min, max }
			: undefined;
	};
	const rangeText = (r: { min: number; max: number }) =>
		fill(t.workPlanRange, { min: fmt(r.min), max: fmt(r.max) });

	/** The name and the planned length of a wait, with the written range when it differs. */
	const threadParts = (
		th: RunSheetThread,
	): { name: string; length: string } => {
		const name = waitName(th);
		const planned = Math.round(th.planned);
		const range = th.range ?? rangeOf(th.task);
		let length: string;
		if (range && Math.abs(th.planned - range.min) < 1) {
			length = rangeText(range);
		} else if (range) {
			length = `${fmt(planned)} (${rangeText(range)})`;
		} else {
			length = fmt(planned);
		}
		return { name, length };
	};
	/** "Insert : Freeze 12 to 72 h" */
	const threadText = (th: RunSheetThread, until?: string) => {
		const { name, length } = threadParts(th);
		return `${name} ${length}${until ? `, ${until}` : ""}`;
	};

	// Where each section's work ends, to say when a preparation was made.
	const lastVisit = new Map<number, { day: number; visit: RunSheetVisit }>();
	days.forEach((day, d) => {
		for (const p of day.visits) {
			for (const s of p.sections) lastVisit.set(s, { day: d, visit: p });
		}
	});

	// The mode comes from the sheet: the plan and its kit cannot disagree.
	const mode = recipe?.miseEnPlace ?? DEFAULT_MISE_EN_PLACE_MODE;
	const allVisits = days.flatMap((day) => day.visits);
	const stepSection = (id: string) => {
		const task = tasks.get(id);
		return task?.kind === "step" ? task.section : undefined;
	};
	// Where a section is first seen, and where its first step is: a preparation
	// is needed at the step, not at the mise en place that may come before.
	const firstSeen = new Map<number, RunSheetVisit>();
	const firstWork = new Map<number, RunSheetVisit>();
	for (const p of allVisits) {
		for (const s of p.sections) if (!firstSeen.has(s)) firstSeen.set(s, p);
		for (const id of p.tasks) {
			const s = stepSection(id);
			if (s !== undefined && !firstWork.has(s)) firstWork.set(s, p);
		}
	}
	const claimed = new Set<number>();
	// The sections already worked in an earlier visit: the next one goes on with them.
	const worked = new Set<number>();
	const schedule: RunSheetScheduleRow[] = [];
	const events: RunSheetEvent[] = [];
	const dayModels: RunSheetDayModel[] = [];
	const recipeTitle = recipe?.title ?? data.title ?? undefined;

	days.forEach((day, d) => {
		const heading =
			calendar && day.date ? longDate(day.date, lang) : dayLabel(day);
		const slotOf = (p: RunSheetVisit) =>
			calendar && p.startLocal && p.endLocal
				? `${clock(p.startLocal)} → ${clock(p.endLocal)}`
				: fill(t.workPlanAbout, { duration: fmt(rounded(p.end - p.start)) });
		const rowLabel =
			calendar && day.date
				? `${shortDay(day.date, lang)} ${Number(day.date.slice(8, 10))}`.toUpperCase()
				: dayLabel(day);

		const visitModels: RunSheetVisitModel[] = [];
		day.visits.forEach((p, k) => {
			const nextVisit =
				day.visits[k + 1] ?? days[d + 1]?.visits[0] ?? undefined;
			const threads = day.threads.filter((th) => th.visit === k);

			schedule.push({
				kind: "visit",
				...(k === 0 && { day: rowLabel }),
				time: slotOf(p).replace(" → ", " – "),
				text: visitSections(p).map(sectionTitle).join(", "),
			});
			for (const th of threads) {
				schedule.push({ kind: "thread", text: threadText(th) });
			}

			// To take out: the raw things of a section once, at its first visit
			// (all of them at the first visit in `upfront`); a preparation at the
			// visit of its first step, whatever the mode.
			const present = new Set(
				p.tasks.flatMap((id) => {
					const s = stepSection(id);
					return s === undefined ? [] : [s];
				}),
			);
			const rawSections =
				mode === "upfront"
					? p === allVisits[0]
						? [...new Set(allVisits.flatMap((x) => x.sections))]
						: []
					: p.sections.filter((s) => !claimed.has(s));
			for (const s of rawSections) claimed.add(s);
			const preparedSections = [...firstSeen.keys()].filter(
				(s) => (firstWork.get(s) ?? firstSeen.get(s)) === p,
			);
			const line = (item: KitItem): RunSheetKitLine => {
				// A tin reads "tart tin ×2 (24cm)"; the rest "flour 2 cup · 260 g, made Thursday".
				const text =
					item.kind === "cookware"
						? `${item.name}${item.quantity ? ` ${item.quantity}` : ""}${item.note ? ` (${item.note})` : ""}`
						: [
								`${item.quantity ? `${item.name} ${item.quantity}` : item.name}${item.mass ? ` · ${item.mass}` : ""}`,
								item.note,
							]
								.filter(Boolean)
								.join(", ");
				return {
					kind: item.kind,
					text,
					name: item.name,
					...(item.quantity && { quantity: item.quantity }),
					...(item.mass && { mass: item.mass }),
					...(item.note && { note: item.note }),
					...(item.detail && { detail: item.detail }),
				};
			};
			const prepared = (sections: number[]) =>
				kitPrepared(data, sections, {
					lang,
					present,
					madeBefore: (_id, maker) => {
						const made = lastVisit.get(maker);
						if (!made || made.visit === p) return undefined;
						if (made.day === d) {
							return calendar && made.visit.startLocal
								? fill(t.workPlanMadeAt, {
										time: clock(made.visit.startLocal),
									})
								: t.workPlanMadeEarlier;
						}
						const madeDay = days[made.day]!;
						return fill(t.workPlanMadeOn, {
							day:
								calendar && madeDay.date
									? weekdayName(madeDay.date, lang)
									: dayLabel(madeDay),
						});
					},
				});
			// The programme: where to read each section in the recipe.
			const program: RunSheetProgramLine[] = [];
			const programOf = new Map<number, RunSheetProgramLine>();
			for (const s of p.sections) {
				const indexes = p.tasks.flatMap((id) => {
					const task = tasks.get(id);
					return task?.kind === "step" && task.section === s ? [task.step] : [];
				});
				const prog = sectionProgram(data, s, indexes, { lang });
				if (!prog) continue;
				const startAt = p.sectionStarts.find(
					(x) => x.section === s,
				)?.startLocal;
				const range =
					prog.from === prog.to
						? fill(t.workPlanStep, { n: String(prog.from) })
						: fill(t.workPlanSteps, {
								from: String(prog.from),
								to: String(prog.to),
							});
				const entry: RunSheetProgramLine = {
					section: prog.title,
					reference: prog.origin ? `${prog.origin}, ${range}` : range,
					...(prog.origin && { origin: prog.origin }),
					...(calendar && startAt && { startTime: clock(startAt) }),
					...(worked.has(s) && { continued: true }),
					steps: sectionSteps(data, s, indexes, {
						lang,
						comments: options.comments,
					}),
				};
				program.push(entry);
				programOf.set(s, entry);
			}
			for (const s of p.worked) worked.add(s);

			// By section, what to take out sits with its section, right before the
			// steps that need it; the cookware is told once, at the first section that
			// uses it. Otherwise it is one block at the top of the visit.
			const kit: RunSheetKitGroup[] = [];
			if (mode === "perSection") {
				const own = [...new Set([...rawSections, ...preparedSections])].sort(
					(a, b) => a - b,
				);
				// A tool is told once, at the first section that uses it, with the most
				// the visit asks of it: the tray of the second section is the first one's.
				const cookwareKey = (c: KitItem) => `${c.name}|${c.note ?? ""}`;
				const mostCookware = new Map(
					kitCookware(data, rawSections).map((c) => [cookwareKey(c), c]),
				);
				const seenCookware = new Set<string>();
				for (const s of own) {
					const lines = [
						...(rawSections.includes(s)
							? kitIngredients(data, [s], { lang })
							: []),
						...(preparedSections.includes(s) ? prepared([s]) : []),
						...(rawSections.includes(s)
							? kitCookware(data, [s]).flatMap((c) => {
									const key = cookwareKey(c);
									if (seenCookware.has(key)) return [];
									seenCookware.add(key);
									return [mostCookware.get(key) ?? c];
								})
							: []),
					];
					if (lines.length === 0) continue;
					const entry = programOf.get(s);
					if (entry) entry.kit = lines.map(line);
					// A section with no step in this visit has no line to hold its things.
					else kit.push({ section: sectionTitle(s), items: lines.map(line) });
				}
			} else {
				const items = [
					...kitIngredients(data, rawSections, { lang }),
					...prepared(preparedSections),
					...kitCookware(data, rawSections),
				];
				if (items.length > 0) kit.push({ items: items.map(line) });
			}

			// Leaving: what goes on, then when to come back.
			const leaving: string[] = [];
			const waits: RunSheetWaitLine[] = [];
			for (const th of threads) {
				const endsEarly =
					nextVisit && th.to < nextVisit.start - 1
						? th.toLocal
							? fill(t.workPlanUntilClock, { time: clock(th.toLocal) })
							: undefined
						: undefined;
				leaving.push(threadText(th, endsEarly));
				waits.push({
					...threadParts(th),
					...(endsEarly && { until: endsEarly }),
				});
			}
			if (nextVisit) {
				const nextDay = days.find((x) => x.visits.includes(nextVisit));
				let when: string;
				if (calendar && nextVisit.startLocal) {
					const date = nextVisit.startLocal.slice(0, 10);
					when =
						date === day.date
							? clock(nextVisit.startLocal)
							: `${weekdayName(date, lang)} ${clock(nextVisit.startLocal)}`;
				} else if (nextDay === day) {
					// No clock without a serving time: say it is the same day.
					leaving.push(t.workPlanNextVisitSameDay);
					when = "";
				} else {
					when = nextDay ? dayLabel(nextDay) : "";
				}
				if (when) leaving.push(fill(t.workPlanNextVisit, { when }));
			} else if (calendar && sheet.serveAt) {
				leaving.push(
					fill(t.workPlanServeAt, { time: sheet.serveAt.slice(11, 16) }),
				);
			} else {
				leaving.push(t.workPlanServe);
			}

			// The margin, or what holds the visit.
			let margin: string | undefined;
			if (p.window) {
				margin = fill(t.workPlanPossibleFrom, {
					time: clock(p.window.earliestLocal),
				});
			} else if (p.fixedBy) {
				const wait = {
					rest: restName(
						t.runSheetRest,
						p.fixedBy.track,
						stepAction(p.fixedBy.section, p.fixedBy.step),
					),
					section: sectionTitle(p.fixedBy.section),
					length: fmt(Math.round(p.fixedBy.planned)),
				};
				margin =
					p.fixedBy.before === "service"
						? fill(t.workPlanFixedService, wait)
						: fill(t.workPlanFixedVisit, {
								...wait,
								sections: (p.fixedBy.sections ?? [])
									.map(sectionTitle)
									.join(", "),
							});
			}

			visitModels.push({
				slot: slotOf(p),
				...(margin !== undefined && { margin }),
				kit,
				program,
				leaving,
				waits,
				...(leaving.length > 0 && { next: leaving.at(-1) }),
			});

			// One calendar event per visit, in UTC, with the lists as plain lines.
			if (calendar && p.startLocal && p.endLocal && sheet.timeZone) {
				const start = day.entries.find(
					(e) => e.start && e.from >= p.start - 1e-6,
				);
				const last = [...day.entries]
					.reverse()
					.find((e) => e.end && e.active && e.to <= p.end + 1e-6);
				if (start?.start && last?.end) {
					const lines = [
						...(kit.length > 0
							? [
									`${t.workPlanKit} :`,
									...kitLines(kit, {
										title: (section) => `${section} :`,
										item: (l) => `- ${l.text}`,
									}),
									"",
								]
							: []),
						...(program.length > 0
							? [
									`${t.workPlanProgram} :`,
									...program.flatMap((l) => [
										`- ${l.section} (${l.reference})`,
										...(l.kit ?? []).map((k) => `  - ${k.text}`),
									]),
								]
							: []),
					];
					events.push({
						start: start.start,
						end: last.end,
						title: [recipeTitle, visitSections(p).map(sectionTitle).join(", ")]
							.filter(Boolean)
							.join(" · "),
						description: lines.join("\n").trim(),
					});
				}
			}
		});

		const notices = sheet.adjustments
			.filter((a) => a.day === day.daysBefore)
			.map((a) => {
				const r = rangeOf(a.task);
				return fill(
					a.to > a.from ? t.workPlanStretchedTo : t.workPlanShortenedTo,
					{
						wait: waitName(a),
						to: fmt(Math.round(a.to)),
						range: r ? rangeText(r) : fmt(Math.round(a.from)),
					},
				);
			});

		dayModels.push({
			heading,
			slot: visitModels.map((p) => p.slot).join(" · "),
			notices,
			visits: visitModels,
		});
	});

	// The service closes the planning.
	if (days.length > 0) {
		schedule.push({
			kind: "serve",
			...(!calendar &&
				days.at(-1)?.daysBefore !== 0 && { day: workingDayLabel(0, t) }),
			...(calendar && sheet.serveAt && { time: sheet.serveAt.slice(11, 16) }),
			text: t.workPlanServe,
		});
	}

	const visits = days.reduce((n, d) => n + d.visits.length, 0);
	const portions = (data.meta as Record<string, unknown> | undefined)?.portions;
	const scale = data.scaleFactor;
	const servings =
		portions !== undefined && portions !== null && String(portions) !== ""
			? typeof scale === "number" && Math.abs(scale - 1) > 1e-6
				? fill(t.workPlanScaled, {
						count: String(portions),
						factor: new Intl.NumberFormat(lang || "en", {
							maximumFractionDigits: 2,
						}).format(scale),
					})
				: fill(t.workPlanServings, { count: String(portions) })
			: undefined;
	const subtitle = [
		calendar && sheet.serveAt
			? fill(t.workPlanFor, {
					date: longDate(sheet.serveAt.slice(0, 10), lang),
					time: sheet.serveAt.slice(11, 16),
				})
			: undefined,
		servings,
	]
		.filter(Boolean)
		.join(" · ");
	const summary =
		days.length === 0
			? t.workPlanNothing
			: [
					plural(days.length, t.workPlanDays, t.workPlanDaysMany),
					plural(visits, t.workPlanVisits, t.workPlanVisitsMany),
					fill(t.workPlanWork, {
						duration: fmt(rounded(recipe?.totalWork ?? 0)),
					}),
				].join(" · ");

	return {
		title: recipeTitle
			? `${t.workPlanTitle} — ${recipeTitle}`
			: t.workPlanTitle,
		miseEnPlace: mode,
		subtitle,
		summary,
		problems: describeProblems(
			sheet.diagnostics,
			data,
			options,
			sheet.timeZone ?? "UTC",
		),
		schedule,
		days: dayModels,
		events,
	};
}

/** "Montage (continued)": the title of a section, told when a visit goes on with it. */

import { getDictionary } from "@gram-lang/i18n";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	type ProjectionDiagnostic,
	type RunSheet,
	type RunSheetDay,
	type RunSheetVisit,
	type RunSheetThread,
} from "@gram-lang/scheduler";
import { workingDayLabel } from "./mise-en-place";
import type { RenderableCompilationResult } from "./types";
import { HTML_ICONS } from "./icons";
import {
	type KitItem,
	kitCookware,
	kitIngredients,
	kitPrepared,
	sectionProgram,
} from "./work-plan-parts";
import { escapeHtml, escapeMarkdownHtml, formatDuration } from "./utils";

export interface RunSheetRenderOptions {
	/** Locale code (e.g. 'en', 'fr') for the words and the dates. */
	lang?: string;
	/** Display only: a time is shown to the nearest this many minutes. Default 5. */
	roundTo?: number;
	formatDuration?: (minutes: number) => string;
	/**
	 * Markdown only: the level of the sheet's own heading, 1 for a document of its
	 * own (the default), 2 when it follows a recipe, whose title is the `#`.
	 */
	headingLevel?: 1 | 2;
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

/** What a visit asks of one section: where to read it in the recipe. */
export interface RunSheetProgramLine {
	/** "Mousse" */
	section: string;
	/** "steps 1 to 3", "sponge.gram, steps 1 to 3" */
	reference: string;
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

const fill = (template: string, values: Record<string, string>) =>
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
				text: p.sections.map(sectionTitle).join(", "),
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
				const text = [
					item.quantity ? `${item.name} ${item.quantity}` : item.name,
					item.note,
				]
					.filter(Boolean)
					.join(", ");
				return {
					kind: item.kind,
					text,
					name: item.name,
					...(item.quantity && { quantity: item.quantity }),
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
				};
				program.push(entry);
				programOf.set(s, entry);
			}

			// By section, what to take out sits with its section, right before the
			// steps that need it; the cookware is told once, at the first section that
			// uses it. Otherwise it is one block at the top of the visit.
			const kit: RunSheetKitGroup[] = [];
			if (mode === "perSection") {
				const own = [...new Set([...rawSections, ...preparedSections])].sort(
					(a, b) => a - b,
				);
				const seenCookware = new Set<string>();
				for (const s of own) {
					const lines = [
						...(rawSections.includes(s)
							? kitIngredients(data, [s], { lang })
							: []),
						...(preparedSections.includes(s) ? prepared([s]) : []),
						...(rawSections.includes(s)
							? kitCookware(data, [s]).filter((c) => {
									if (seenCookware.has(c.name)) return false;
									seenCookware.add(c.name);
									return true;
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
				const wait = `${waitName(p.fixedBy)} ${fmt(Math.round(p.fixedBy.planned))}`;
				margin =
					p.fixedBy.before === "service"
						? fill(t.workPlanFixedService, { wait })
						: fill(t.workPlanFixedVisit, {
								wait,
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
						title: [recipeTitle, p.sections.map(sectionTitle).join(", ")]
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

/**
 * The lines of a kit, group by group: a title above the lines of a group that
 * has one. `gap` goes between a title and what follows it, when it is needed.
 */
function kitLines(
	kit: RunSheetKitGroup[],
	format: {
		title: (section: string) => string;
		item: (line: RunSheetKitLine) => string;
		gap?: string;
	},
): string[] {
	const out: string[] = [];
	kit.forEach((group, i) => {
		if (group.section) {
			if (i > 0 && format.gap !== undefined) out.push(format.gap);
			out.push(format.title(group.section));
			if (format.gap !== undefined) out.push(format.gap);
		} else if (i > 0 && format.gap !== undefined) {
			out.push(format.gap);
		}
		for (const l of group.items) out.push(format.item(l));
	});
	return out;
}

/** The things of a group as a checklist, the cookware set apart in a list of its own. */
function kitListsHtml(
	items: RunSheetKitLine[],
	e: (value: string) => string,
): string {
	const things = items.filter((l) => l.kind !== "cookware");
	const tools = items.filter((l) => l.kind === "cookware");
	let html = "";
	if (things.length > 0) {
		html += `          <ul class="kit-list">\n`;
		for (const l of things) {
			html += `            <li class="kit-${l.kind}"><label><input type="checkbox"><span>${e(l.name)}${l.quantity ? ` <span class="kit-qty">${e(l.quantity)}${l.detail ? ` (${e(l.detail)})` : ""}</span>` : ""}${l.note ? ` <span class="kit-note">${e(l.note)}</span>` : ""}</span></label></li>\n`;
		}
		html += `          </ul>\n`;
	}
	if (tools.length > 0) {
		html += `          <ul class="kit-list kit-tools">\n`;
		for (const l of tools) {
			html += `            <li class="kit-cookware"><label><input type="checkbox"><span>${e(l.name)}</span></label></li>\n`;
		}
		html += `          </ul>\n`;
	}
	return html;
}

/** The work plan as plain text. */
export function runSheetToText(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = describeRunSheet(sheet, data, options);
	const out: string[] = [model.title];
	if (model.subtitle) out.push(model.subtitle);
	out.push(model.summary, "");
	if (model.problems.length > 0) {
		out.push(t.runSheetProblems);
		for (const p of model.problems) out.push(`  ! ${p}`);
		out.push("");
	}
	for (const row of model.schedule) {
		const lead = (row.day ?? "").padEnd(9);
		if (row.kind === "thread") {
			out.push(`${" ".repeat(9)}┆ ${row.text}`);
		} else {
			const mark = row.kind === "serve" ? "★" : "▮";
			out.push(
				`${lead}${mark} ${(row.time ?? "").padEnd(14)}${row.text}`.trimEnd(),
			);
		}
	}
	if (model.schedule.length > 0) {
		out.push("", `▮ ${t.workPlanLegendCook}   ┆ ${t.workPlanLegendThread}`);
	}
	for (const day of model.days) {
		out.push("", `${day.heading.toUpperCase()}  ${day.slot}`);
		for (const n of day.notices) out.push(`  ! ${n}`);
		for (const p of day.visits) {
			if (day.visits.length > 1) out.push("", `  ${p.slot}`);
			if (p.margin) out.push(`  ${p.margin}`);
			if (p.kit.length > 0) {
				out.push(`  ${t.workPlanKit}`);
				out.push(
					...kitLines(p.kit, {
						title: (section) => `    ${section} :`,
						item: (l) => `    [ ] ${l.text}${l.detail ? ` (${l.detail})` : ""}`,
					}),
				);
			}
			if (p.program.length > 0) {
				out.push(`  ${t.workPlanProgram}`);
				for (const l of p.program) {
					out.push(`    ${l.section} (${l.reference})`);
					for (const k of l.kit ?? []) {
						out.push(`      [ ] ${k.text}${k.detail ? ` (${k.detail})` : ""}`);
					}
				}
			}
			// Like the HTML view: the heading only for what goes on without the cook.
			if (p.waits.length > 0) {
				out.push(`  ${t.workPlanLeaving}`);
				for (const l of p.next === undefined
					? p.leaving
					: p.leaving.slice(0, -1))
					out.push(`    ${l}`);
			}
			if (p.next !== undefined) out.push(`  ${p.next}`);
		}
	}
	return `${out.join("\n").trimEnd()}\n`;
}

/** The work plan as Markdown: a heading per day, a checklist to take out. */
export function runSheetToMarkdown(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const md = escapeMarkdownHtml;
	const model = describeRunSheet(sheet, data, options);
	const h1 = "#".repeat(options.headingLevel ?? 1);
	const h2 = `${h1}#`;
	const h3 = `${h2}#`;
	const out: string[] = [`${h1} ${md(model.title)}`, ""];
	if (model.subtitle) out.push(md(model.subtitle), "");
	out.push(md(model.summary), "");
	if (model.problems.length > 0) {
		out.push(`> **${md(t.runSheetProblems)}**`);
		for (const p of model.problems) out.push(`> - ⚠️ ${md(p)}`);
		out.push("");
	}
	for (const row of model.schedule) {
		if (row.kind === "thread") {
			out.push(`  - *${md(row.text)}*`);
			continue;
		}
		const lead = [row.day, row.time].filter(Boolean).map(md).join(" · ");
		out.push(
			`- ${lead ? `**${lead}** ` : ""}${row.kind === "serve" ? "★ " : ""}${md(row.text)}`,
		);
	}
	out.push("");
	for (const day of model.days) {
		out.push(`${h2} ${md(day.heading)} · ${md(day.slot)}`, "");
		for (const n of day.notices) out.push(`> ⚠️ ${md(n)}`, "");
		for (const p of day.visits) {
			if (day.visits.length > 1) out.push(`${h3} ${md(p.slot)}`, "");
			if (p.margin) out.push(md(p.margin), "");
			if (p.kit.length > 0) {
				out.push(`**${md(t.workPlanKit)}**`, "");
				out.push(
					...kitLines(p.kit, {
						title: (section) => `*${md(section)}*`,
						item: (l) =>
							`- [ ] ${md(l.text)}${l.detail ? ` (${md(l.detail)})` : ""}`,
						gap: "",
					}),
				);
				out.push("");
			}
			if (p.program.length > 0) {
				out.push(`**${md(t.workPlanProgram)}**`, "");
				for (const l of p.program) {
					out.push(`- **${md(l.section)}** (${md(l.reference)})`);
					for (const k of l.kit ?? []) {
						out.push(
							`  - [ ] ${md(k.text)}${k.detail ? ` (${md(k.detail)})` : ""}`,
						);
					}
				}
				out.push("");
			}
			// Like the HTML view: the heading only for what goes on without the cook.
			if (p.waits.length > 0) {
				out.push(`**${md(t.workPlanLeaving)}**`, "");
				for (const l of p.next === undefined
					? p.leaving
					: p.leaving.slice(0, -1))
					out.push(`- ${md(l)}`);
				out.push("");
			}
			if (p.next !== undefined) out.push(md(p.next), "");
		}
	}
	return `${out.join("\n").trimEnd()}\n`;
}

/** "THU 15" as the name of the day and its number, to set the number apart. */
function dayParts(label: string): { name: string; number?: string } {
	const m = /^(.*\S)\s+(\d{1,2})$/.exec(label);
	return m ? { name: m[1]!, number: m[2]! } : { name: label };
}

/** The work plan as an HTML fragment, every word of the recipe escaped. */
export function runSheetToHTML(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = describeRunSheet(sheet, data, options);
	const e = escapeHtml;
	let html = `<section class="gram-run-sheet">\n  <header class="work-plan-header">\n    <h2>${e(model.title)}</h2>\n`;
	if (model.subtitle) {
		html += `    <p class="work-plan-subtitle">${e(model.subtitle)}</p>\n`;
	}
	html += `    <p class="work-plan-summary">${e(model.summary)}</p>\n`;
	if (model.problems.length > 0) {
		html += `    <section class="run-sheet-problems work-plan-problems" role="alert">\n      <h3><span class="problem-icon" aria-hidden="true">${HTML_ICONS.warning}</span> <span>${e(t.runSheetProblems)}</span></h3>\n      <ul>\n`;
		for (const p of model.problems) html += `        <li>${e(p)}</li>\n`;
		html += `      </ul>\n    </section>\n`;
	}
	if (model.schedule.length > 0) {
		// The days at a glance: the rows of a day under its name.
		const groups: RunSheetScheduleRow[][] = [];
		for (const row of model.schedule) {
			if (row.day || groups.length === 0) groups.push([]);
			groups.at(-1)!.push(row);
		}
		html += `    <ol class="work-plan-schedule">\n`;
		for (const rows of groups) {
			const day = rows[0]?.day;
			html += `      <li class="schedule-group">\n        <div class="schedule-day">`;
			if (day) {
				const { name, number } = dayParts(day);
				html += `${e(name)}${number ? `<small>${e(number)}</small>` : ""}`;
			}
			html += `</div>\n        <div class="schedule-rows">\n`;
			for (const row of rows) {
				if (row.kind === "thread") {
					html += `          <div class="schedule-row schedule-thread"><span class="schedule-line"></span><span class="schedule-text">${e(row.text)}</span></div>\n`;
				} else {
					html += `          <div class="schedule-row schedule-${row.kind}"><span class="schedule-time">${e(row.time ?? "")}</span><span class="schedule-text">${e(row.text)}</span></div>\n`;
				}
			}
			html += `        </div>\n      </li>\n`;
		}
		html += `    </ol>\n`;
		html += `    <p class="work-plan-legend"><span class="legend-cook">${e(t.workPlanLegendCook)}</span><span class="legend-thread">${e(t.workPlanLegendThread)}</span></p>\n`;
	}
	html += `  </header>\n`;
	for (const day of model.days) {
		html += `  <section class="work-plan-day">\n    <h3><span class="day-heading">${e(day.heading)}</span> <span class="day-slot">${e(day.slot)}</span></h3>\n`;
		for (const n of day.notices) {
			html += `    <p class="work-plan-notice">${e(n)}</p>\n`;
		}
		for (const p of day.visits) {
			html += `    <div class="work-plan-visit">\n`;
			const where = day.visits.length > 1 ? ` · ${e(p.slot)}` : "";
			if (p.margin) {
				html += `      <p class="work-plan-margin">${e(p.margin)}</p>\n`;
			}
			if (p.kit.length > 0) {
				html += `      <div class="work-plan-kit">\n        <h4>${e(t.workPlanKit)}${where}</h4>\n`;
				for (const group of p.kit) {
					html += `        <div class="kit-group">\n`;
					if (group.section) {
						html += `          <h5 class="kit-section-title">${e(group.section)}</h5>\n`;
					}
					html += kitListsHtml(group.items, e);
					html += `        </div>\n`;
				}
				html += `      </div>\n`;
			}
			if (p.program.length > 0) {
				html += `      <div class="work-plan-program${p.program.some((l) => l.kit?.length) ? " program-by-section" : ""}">\n        <h4>${e(t.workPlanProgram)}${where}</h4>\n        <ul>\n`;
				for (const l of p.program) {
					html += `          <li><span class="program-section">${e(l.section)}</span><span class="program-ref">${e(l.reference)}</span>${l.kit?.length ? `\n            <div class="program-kit">\n${kitListsHtml(l.kit, e)}            </div>\n          ` : ""}</li>\n`;
				}
				html += `        </ul>\n      </div>\n`;
			}
			if (p.waits.length > 0) {
				html += `      <div class="work-plan-leaving">\n        <h4>${e(t.workPlanLeaving)}</h4>\n        <ul>\n`;
				for (const w of p.waits) {
					html += `          <li><span class="wait-name">${e(w.name)}${w.until ? ` <span class="wait-until">${e(w.until)}</span>` : ""}</span><span class="wait-length">${e(w.length)}</span></li>\n`;
				}
				html += `        </ul>\n      </div>\n`;
			}
			if (p.next !== undefined) {
				html += `      <p class="leaving-next">${e(p.next)}</p>\n`;
			}
			html += `    </div>\n`;
		}
		html += `  </section>\n`;
	}
	return `${html}</section>\n`;
}

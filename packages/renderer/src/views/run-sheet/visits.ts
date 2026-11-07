import { fillTemplate } from "@gram-lang/i18n";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	type MiseEnPlaceMode,
	type RunSheet,
	type RunSheetDay,
	type RunSheetThread,
	type RunSheetVisit,
	visitSections,
} from "@gram-lang/scheduler";
import type { RenderableCompilationResult } from "../../types";
import { longDate, shortDay, weekdayName } from "./dates";
import { kitLines } from "./lines";
import type {
	RunSheetDayModel,
	RunSheetEvent,
	RunSheetKitGroup,
	RunSheetKitLine,
	RunSheetProgramLine,
	RunSheetRenderOptions,
	RunSheetScheduleRow,
	RunSheetVisitModel,
	RunSheetWaitLine,
} from "./model";
import {
	type KitItem,
	kitCookware,
	kitIngredients,
	kitPrepared,
	sectionProgram,
	sectionSteps,
} from "./parts";
import { type RunSheetWords, restName } from "./words";

/**
 * What the pass over the days and the visits of a run sheet reads and keeps:
 * the sheet, the recipe, the words, where each section is seen and worked, and
 * the two sets that grow visit after visit (`claimed`, `worked`), which is why
 * the visits are described in order.
 */
export interface VisitPass {
	sheet: RunSheet;
	data: RenderableCompilationResult;
	options: RunSheetRenderOptions;
	w: RunSheetWords;
	days: RunSheetDay[];
	/** The mode comes from the sheet: the plan and its kit cannot disagree. */
	mode: MiseEnPlaceMode;
	allVisits: RunSheetVisit[];
	/** Where each section's work ends, to say when a preparation was made. */
	lastVisit: Map<number, { day: number; visit: RunSheetVisit }>;
	/** Where a section is first seen. */
	firstSeen: Map<number, RunSheetVisit>;
	/** Where its first step is: a preparation is needed at the step, not at the mise en place before it. */
	firstWork: Map<number, RunSheetVisit>;
	/** The sections whose raw things were already told. */
	claimed: Set<number>;
	/** The sections already worked in an earlier visit: the next one goes on with them. */
	worked: Set<number>;
	recipeTitle: string | undefined;
}

export function startPass(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions,
	w: RunSheetWords,
): VisitPass {
	const recipe = sheet.recipes[0];
	const days = recipe?.days ?? [];
	const allVisits = days.flatMap((day) => day.visits);

	const lastVisit = new Map<number, { day: number; visit: RunSheetVisit }>();
	days.forEach((day, d) => {
		for (const p of day.visits) {
			for (const s of p.sections) lastVisit.set(s, { day: d, visit: p });
		}
	});

	const stepSection = (id: string) => {
		const task = w.tasks.get(id);
		return task?.kind === "step" ? task.section : undefined;
	};
	const firstSeen = new Map<number, RunSheetVisit>();
	const firstWork = new Map<number, RunSheetVisit>();
	for (const p of allVisits) {
		for (const s of p.sections) if (!firstSeen.has(s)) firstSeen.set(s, p);
		for (const id of p.tasks) {
			const s = stepSection(id);
			if (s !== undefined && !firstWork.has(s)) firstWork.set(s, p);
		}
	}

	return {
		sheet,
		data,
		options,
		w,
		days,
		mode: recipe?.miseEnPlace ?? DEFAULT_MISE_EN_PLACE_MODE,
		allVisits,
		lastVisit,
		firstSeen,
		firstWork,
		claimed: new Set(),
		worked: new Set(),
		recipeTitle: recipe?.title ?? data.title ?? undefined,
	};
}

/** The section a step task belongs to. */
const stepSectionOf = (pass: VisitPass, id: string) => {
	const task = pass.w.tasks.get(id);
	return task?.kind === "step" ? task.section : undefined;
};

/** One thing to take out, in words. */
function kitLine(item: KitItem): RunSheetKitLine {
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
}

/** The programme of a visit: where to read each section in the recipe, and what to do. */
function describeProgram(pass: VisitPass, p: RunSheetVisit) {
	const { data, options, w } = pass;
	const { t, lang, calendar, clock } = w;
	const program: RunSheetProgramLine[] = [];
	const programOf = new Map<number, RunSheetProgramLine>();
	for (const s of p.sections) {
		const indexes = p.tasks.flatMap((id) => {
			const task = w.tasks.get(id);
			return task?.kind === "step" && task.section === s ? [task.step] : [];
		});
		const prog = sectionProgram(data, s, indexes, { lang });
		if (!prog) continue;
		const startAt = p.sectionStarts.find((x) => x.section === s)?.startLocal;
		const range =
			prog.from === prog.to
				? fillTemplate(t.runSheetProgramStep, { n: String(prog.from) })
				: fillTemplate(t.runSheetProgramSteps, {
						from: String(prog.from),
						to: String(prog.to),
					});
		const entry: RunSheetProgramLine = {
			section: prog.title,
			reference: prog.origin ? `${prog.origin}, ${range}` : range,
			...(prog.origin && { origin: prog.origin }),
			...(calendar && startAt && { startTime: clock(startAt) }),
			...(pass.worked.has(s) && { continued: true }),
			steps: sectionSteps(data, s, indexes, {
				lang,
				comments: options.comments,
			}),
		};
		program.push(entry);
		programOf.set(s, entry);
	}
	return { program, programOf };
}

/**
 * What to take out for a visit. The raw things of a section once, at its first
 * visit (all of them at the first visit in `upfront`); a preparation at the
 * visit of its first step, whatever the mode. By section, what to take out sits
 * with its section, right before the steps that need it (on the programme
 * line); otherwise it is one block at the top of the visit.
 */
function describeKit(
	pass: VisitPass,
	d: number,
	p: RunSheetVisit,
	programOf: Map<number, RunSheetProgramLine>,
): RunSheetKitGroup[] {
	const { data, w, days, mode, allVisits, firstSeen, firstWork } = pass;
	const { t, lang, calendar, clock, dayLabel, sectionTitle } = w;
	const present = new Set(
		p.tasks.flatMap((id) => {
			const s = stepSectionOf(pass, id);
			return s === undefined ? [] : [s];
		}),
	);
	const rawSections =
		mode === "upfront"
			? p === allVisits[0]
				? [...new Set(allVisits.flatMap((x) => x.sections))]
				: []
			: p.sections.filter((s) => !pass.claimed.has(s));
	for (const s of rawSections) pass.claimed.add(s);
	const preparedSections = [...firstSeen.keys()].filter(
		(s) => (firstWork.get(s) ?? firstSeen.get(s)) === p,
	);
	const prepared = (sections: number[]) =>
		kitPrepared(data, sections, {
			lang,
			present,
			madeBefore: (_id, maker) => {
				const made = pass.lastVisit.get(maker);
				if (!made || made.visit === p) return undefined;
				if (made.day === d) {
					return calendar && made.visit.startLocal
						? fillTemplate(t.runSheetMadeAt, {
								time: clock(made.visit.startLocal),
							})
						: t.runSheetMadeEarlier;
				}
				const madeDay = days[made.day] as RunSheetDay;
				return fillTemplate(t.runSheetMadeOn, {
					day:
						calendar && madeDay.date
							? weekdayName(madeDay.date, lang)
							: dayLabel(madeDay),
				});
			},
		});

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
				...(rawSections.includes(s) ? kitIngredients(data, [s], { lang }) : []),
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
			if (entry) entry.kit = lines.map(kitLine);
			// A section with no step in this visit has no line to hold its things.
			else kit.push({ section: sectionTitle(s), items: lines.map(kitLine) });
		}
	} else {
		const items = [
			...kitIngredients(data, rawSections, { lang }),
			...prepared(preparedSections),
			...kitCookware(data, rawSections),
		];
		if (items.length > 0) kit.push({ items: items.map(kitLine) });
	}
	return kit;
}

/** What goes on without the cook, then when to come back. */
function describeLeaving(
	pass: VisitPass,
	day: RunSheetDay,
	nextVisit: RunSheetVisit | undefined,
	threads: RunSheetThread[],
) {
	const { sheet, days, w } = pass;
	const { t, lang, calendar, clock, dayLabel, threadParts, threadText } = w;
	const leaving: string[] = [];
	const waits: RunSheetWaitLine[] = [];
	for (const th of threads) {
		const endsEarly =
			nextVisit && th.to < nextVisit.start - 1
				? th.toLocal
					? fillTemplate(t.runSheetUntilClock, { time: clock(th.toLocal) })
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
			leaving.push(t.runSheetNextVisitSameDay);
			when = "";
		} else {
			when = nextDay ? dayLabel(nextDay) : "";
		}
		if (when) leaving.push(fillTemplate(t.runSheetNextVisit, { when }));
	} else if (calendar && sheet.serveAt) {
		leaving.push(
			fillTemplate(t.runSheetServeAt, { time: sheet.serveAt.slice(11, 16) }),
		);
	} else {
		leaving.push(t.runSheetServe);
	}
	return { leaving, waits };
}

/** The margin of a visit, or what holds it. */
function describeMargin(pass: VisitPass, p: RunSheetVisit): string | undefined {
	const { t, clock, fmt, sectionTitle, stepAction } = pass.w;
	if (p.window) {
		return fillTemplate(t.runSheetPossibleFrom, {
			time: clock(p.window.earliestLocal),
		});
	}
	if (p.fixedBy) {
		const wait = {
			rest: restName(
				t.runSheetRest,
				p.fixedBy.track,
				stepAction(p.fixedBy.section, p.fixedBy.step),
			),
			section: sectionTitle(p.fixedBy.section),
			length: fmt(Math.round(p.fixedBy.planned)),
		};
		return p.fixedBy.before === "service"
			? fillTemplate(t.runSheetFixedService, wait)
			: fillTemplate(t.runSheetFixedVisit, {
					...wait,
					sections: (p.fixedBy.sections ?? []).map(sectionTitle).join(", "),
				});
	}
	return undefined;
}

/** One calendar event per visit, in UTC, with the lists as plain lines. */
function describeEvent(
	pass: VisitPass,
	day: RunSheetDay,
	p: RunSheetVisit,
	kit: RunSheetKitGroup[],
	program: RunSheetProgramLine[],
): RunSheetEvent | undefined {
	const { sheet, w, recipeTitle } = pass;
	const { t, calendar, sectionTitle } = w;
	if (!(calendar && p.startLocal && p.endLocal && sheet.timeZone)) {
		return undefined;
	}
	const start = day.entries.find((e) => e.start && e.from >= p.start - 1e-6);
	const last = [...day.entries]
		.reverse()
		.find((e) => e.end && e.active && e.to <= p.end + 1e-6);
	if (!(start?.start && last?.end)) return undefined;
	const lines = [
		...(kit.length > 0
			? [
					`${t.runSheetKit} :`,
					...kitLines(kit, {
						title: (section) => `${section} :`,
						item: (l) => `- ${l.text}`,
					}),
					"",
				]
			: []),
		...(program.length > 0
			? [
					`${t.runSheetProgram} :`,
					...program.flatMap((l) => [
						`- ${l.section} (${l.reference})`,
						...(l.kit ?? []).map((k) => `  - ${k.text}`),
					]),
				]
			: []),
	];
	return {
		start: start.start,
		end: last.end,
		title: [recipeTitle, visitSections(p).map(sectionTitle).join(", ")]
			.filter(Boolean)
			.join(" · "),
		description: lines.join("\n").trim(),
	};
}

/** One visit: its row in the schedule, what it asks for, and its calendar event. */
function describeVisit(
	pass: VisitPass,
	day: RunSheetDay,
	d: number,
	k: number,
	slot: string,
	rowLabel: string,
) {
	const { days, w } = pass;
	const p = day.visits[k] as RunSheetVisit;
	const nextVisit = day.visits[k + 1] ?? days[d + 1]?.visits[0] ?? undefined;
	const threads = day.threads.filter((th) => th.visit === k);

	const rows: RunSheetScheduleRow[] = [
		{
			kind: "visit",
			...(k === 0 && { day: rowLabel }),
			time: slot.replace(" → ", " – "),
			text: visitSections(p).map(w.sectionTitle).join(", "),
		},
		...threads.map((th) => ({
			kind: "thread" as const,
			text: w.threadText(th),
		})),
	];

	const { program, programOf } = describeProgram(pass, p);
	for (const s of p.worked) pass.worked.add(s);
	const kit = describeKit(pass, d, p, programOf);
	const { leaving, waits } = describeLeaving(pass, day, nextVisit, threads);
	const margin = describeMargin(pass, p);
	const model: RunSheetVisitModel = {
		slot,
		...(margin !== undefined && { margin }),
		kit,
		program,
		leaving,
		waits,
		...(leaving.length > 0 && { next: leaving.at(-1) }),
	};
	return { rows, model, event: describeEvent(pass, day, p, kit, program) };
}

/** One day: its rows of the schedule, its visits, the rests the plan moved, and its events. */
export function describeDay(pass: VisitPass, day: RunSheetDay, d: number) {
	const { sheet, w } = pass;
	const { t, lang, calendar, clock, rounded, fmt, dayLabel } = w;
	const heading =
		calendar && day.date ? longDate(day.date, lang) : dayLabel(day);
	const slotOf = (p: RunSheetVisit) =>
		calendar && p.startLocal && p.endLocal
			? `${clock(p.startLocal)} → ${clock(p.endLocal)}`
			: fillTemplate(t.runSheetAbout, {
					duration: fmt(rounded(p.end - p.start)),
				});
	const rowLabel =
		calendar && day.date
			? `${shortDay(day.date, lang)} ${Number(day.date.slice(8, 10))}`.toUpperCase()
			: dayLabel(day);

	const rows: RunSheetScheduleRow[] = [];
	const events: RunSheetEvent[] = [];
	const visits: RunSheetVisitModel[] = [];
	day.visits.forEach((p, k) => {
		const described = describeVisit(pass, day, d, k, slotOf(p), rowLabel);
		rows.push(...described.rows);
		visits.push(described.model);
		if (described.event) events.push(described.event);
	});

	const notices = sheet.adjustments
		.filter((a) => a.day === day.daysBefore)
		.map((a) => {
			const r = w.rangeOf(a.task);
			return fillTemplate(
				a.to > a.from ? t.runSheetStretchedTo : t.runSheetShortenedTo,
				{
					wait: w.waitName(a),
					to: fmt(Math.round(a.to)),
					range: r ? w.rangeText(r) : fmt(Math.round(a.from)),
				},
			);
		});

	const model: RunSheetDayModel = {
		heading,
		slot: visits.map((v) => v.slot).join(" · "),
		notices,
		visits,
	};
	return { rows, events, model };
}

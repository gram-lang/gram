import { getDictionary } from "@gram-lang/i18n";
import type {
	ProjectedPlan,
	ProjectionDiagnostic,
	RunSheet,
	RunSheetDay,
	RunSheetPassage,
	RunSheetThread,
} from "@gram-lang/scheduler";
import { sessionDayLabel } from "./mise-en-place";
import type { RenderableCompilationResult } from "./types";
import { type KitItem, passageKit, sectionProgram } from "./work-plan-parts";
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

/** One line of the planning of the days: a passage, what continues without the cook, or the service. */
export interface RunSheetScheduleRow {
	kind: "passage" | "thread" | "serve";
	/** "THU 15", "D-2": set on the first row of a day only. */
	day?: string;
	/** "21:00 – 21:55", "about 55 min", "20:00". */
	time?: string;
	/** The sections of a passage, the wait of a thread, "Serve". */
	text: string;
}

/** One thing to take out, in words. */
export interface RunSheetKitLine {
	kind: KitItem["kind"];
	/** "milk 100 g", "Sponge, made Thursday". */
	text: string;
	/** "60 + 30" when a quantity is the sum of several. */
	detail?: string;
}

/** What a passage asks of one section. */
export interface RunSheetProgramLine {
	/** "Mousse" */
	section: string;
	/** "steps 1 to 3", "sponge.gram, steps 1 to 3" */
	reference: string;
	/** "Heat 5 min › Cool 30 °C 15 min": empty when no step brings anything. */
	steps: string;
}

/** One moment in the kitchen, in words. */
export interface RunSheetPassageModel {
	/** "21:20 → 22:00", "about 40 min". */
	slot: string;
	/** "Possible from 18:00." or the fixed times that hold it. */
	margin?: string;
	kit: RunSheetKitLine[];
	program: RunSheetProgramLine[];
	/** What continues without the cook, then when to come back. */
	leaving: string[];
}

export interface RunSheetDayModel {
	/** "Friday, October 16" in a plan with a serving time, "D-1" without. */
	heading: string;
	/** The slots of the day's passages, "21:20 → 22:00". */
	slot: string;
	/** Rests the plan stretched or shortened. */
	notices: string[];
	passages: RunSheetPassageModel[];
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
	/** The calendar events, one per passage: when and what, ready for a calendar. */
	events: RunSheetEvent[];
}

/** A passage as a calendar event, in UTC. Only for a plan with a serving time. */
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

/** "Served Sunday, October 11 at 13:00": the line the recipe carries once it is on the calendar. */
function servedAtText(
	plan: { serveAt?: string },
	options: RunSheetRenderOptions,
): string {
	const t = getDictionary(options.lang).renderer;
	const serveAt = plan.serveAt ?? "";
	return fill(t.runSheetServedAt, {
		date: longDate(serveAt.slice(0, 10), options.lang),
		time: serveAt.slice(11, 16),
	});
}

/** What the plan could not fix, one sentence each. */
function problemsText(
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
			case "SESSION_DAY_MISMATCH":
				return fill(t.runSheetDayMismatch, {
					day: sessionDayLabel(d.day, t),
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
	const dayLabel = (day: RunSheetDay) => sessionDayLabel(day.daysBefore, t);
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

	/** "Insert : Freeze 12 to 72 h", the planned length with the written range when it differs. */
	const threadText = (th: RunSheetThread, until?: string) => {
		const base = waitName(th);
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
		return `${base} ${length}${until ? `, ${until}` : ""}`;
	};

	// Where each section's work ends, to say when a preparation was made.
	const lastPassage = new Map<
		number,
		{ day: number; passage: RunSheetPassage }
	>();
	days.forEach((day, d) => {
		for (const p of day.passages) {
			for (const s of p.sections) lastPassage.set(s, { day: d, passage: p });
		}
	});

	const claimed = new Set<number>();
	const schedule: RunSheetScheduleRow[] = [];
	const events: RunSheetEvent[] = [];
	const dayModels: RunSheetDayModel[] = [];
	const recipeTitle = recipe?.title ?? data.title ?? undefined;

	days.forEach((day, d) => {
		const heading =
			calendar && day.date ? longDate(day.date, lang) : dayLabel(day);
		const slotOf = (p: RunSheetPassage) =>
			calendar && p.startLocal && p.endLocal
				? `${clock(p.startLocal)} → ${clock(p.endLocal)}`
				: fill(t.workPlanAbout, { duration: fmt(rounded(p.end - p.start)) });
		const rowLabel =
			calendar && day.date
				? `${shortDay(day.date, lang)} ${Number(day.date.slice(8, 10))}`.toUpperCase()
				: dayLabel(day);

		const passageModels: RunSheetPassageModel[] = [];
		day.passages.forEach((p, k) => {
			const nextPassage =
				day.passages[k + 1] ?? days[d + 1]?.passages[0] ?? undefined;
			const threads = day.threads.filter((th) => th.passage === k);

			schedule.push({
				kind: "passage",
				...(k === 0 && { day: rowLabel }),
				time: slotOf(p).replace(" → ", " – "),
				text: p.sections.map(sectionTitle).join(", "),
			});
			for (const th of threads) {
				schedule.push({ kind: "thread", text: threadText(th) });
			}

			// To take out: sections whose work starts here, once.
			const own = p.sections.filter((s) => !claimed.has(s));
			for (const s of own) claimed.add(s);
			const kit = passageKit(data, own, {
				lang,
				madeBefore: (_id, maker) => {
					const made = lastPassage.get(maker);
					if (!made || made.passage === p) return undefined;
					if (made.day === d) {
						return calendar && made.passage.startLocal
							? fill(t.workPlanMadeAt, { time: clock(made.passage.startLocal) })
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
			}).map((item): RunSheetKitLine => {
				const text = [
					item.quantity ? `${item.name} ${item.quantity}` : item.name,
					item.note,
				]
					.filter(Boolean)
					.join(", ");
				return {
					kind: item.kind,
					text,
					...(item.detail && { detail: item.detail }),
				};
			});

			// The programme: the steps of each section that fall in the passage.
			const program: RunSheetProgramLine[] = [];
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
				program.push({
					section: prog.title,
					reference: prog.origin ? `${prog.origin}, ${range}` : range,
					steps: prog.steps
						.map((st) =>
							[st.action, ...st.temperatures, ...st.timers]
								.filter(Boolean)
								.join(" "),
						)
						.join(" › "),
				});
			}

			// Leaving: what goes on, then when to come back.
			const leaving: string[] = [];
			for (const th of threads) {
				const endsEarly =
					nextPassage && th.to < nextPassage.start - 1
						? th.toLocal
							? fill(t.workPlanUntilClock, { time: clock(th.toLocal) })
							: undefined
						: undefined;
				leaving.push(threadText(th, endsEarly));
			}
			if (nextPassage) {
				const nextDay = days.find((x) => x.passages.includes(nextPassage));
				let when: string;
				if (calendar && nextPassage.startLocal) {
					const date = nextPassage.startLocal.slice(0, 10);
					when =
						date === day.date
							? clock(nextPassage.startLocal)
							: `${weekdayName(date, lang)} ${clock(nextPassage.startLocal)}`;
				} else {
					when = nextDay ? dayLabel(nextDay) : "";
				}
				leaving.push(fill(t.workPlanNextVisit, { when }));
			} else if (calendar && sheet.serveAt) {
				leaving.push(
					fill(t.workPlanServeAt, { time: sheet.serveAt.slice(11, 16) }),
				);
			} else {
				leaving.push(t.workPlanServe);
			}

			// The margin, or what holds the passage.
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
						: fill(t.workPlanFixedPassage, {
								wait,
								sections: (p.fixedBy.sections ?? [])
									.map(sectionTitle)
									.join(", "),
							});
			}

			passageModels.push({
				slot: slotOf(p),
				...(margin !== undefined && { margin }),
				kit,
				program,
				leaving,
			});

			// One calendar event per passage, in UTC, with the lists as plain lines.
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
							? [`${t.workPlanKit} :`, ...kit.map((l) => `- ${l.text}`), ""]
							: []),
						...(program.length > 0
							? [
									`${t.workPlanProgram} :`,
									...program.map(
										(l) =>
											`- ${l.section} (${l.reference})${l.steps ? ` : ${l.steps}` : ""}`,
									),
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
			slot: passageModels.map((p) => p.slot).join(" · "),
			notices,
			passages: passageModels,
		});
	});

	// The service closes the planning.
	if (days.length > 0) {
		schedule.push({
			kind: "serve",
			...(!calendar &&
				days.at(-1)?.daysBefore !== 0 && { day: sessionDayLabel(0, t) }),
			...(calendar && sheet.serveAt && { time: sheet.serveAt.slice(11, 16) }),
			text: t.workPlanServe,
		});
	}

	const visits = days.reduce((n, d) => n + d.passages.length, 0);
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
		problems: problemsText(
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
	for (const day of model.days) {
		out.push("", `${day.heading.toUpperCase()}  ${day.slot}`);
		for (const n of day.notices) out.push(`  ! ${n}`);
		for (const p of day.passages) {
			if (day.passages.length > 1) out.push("", `  ${p.slot}`);
			if (p.margin) out.push(`  ${p.margin}`);
			if (p.kit.length > 0) {
				out.push(`  ${t.workPlanKit}`);
				for (const l of p.kit) {
					out.push(`    [ ] ${l.text}${l.detail ? ` (${l.detail})` : ""}`);
				}
			}
			if (p.program.length > 0) {
				out.push(`  ${t.workPlanProgram}`);
				for (const l of p.program) {
					out.push(
						`    ${l.section} (${l.reference})${l.steps ? ` : ${l.steps}` : ""}`,
					);
				}
			}
			out.push(`  ${t.workPlanLeaving}`);
			for (const l of p.leaving) out.push(`    ${l}`);
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
		for (const p of day.passages) {
			if (day.passages.length > 1) out.push(`${h3} ${md(p.slot)}`, "");
			if (p.margin) out.push(md(p.margin), "");
			if (p.kit.length > 0) {
				out.push(`**${md(t.workPlanKit)}**`, "");
				for (const l of p.kit) {
					out.push(
						`- [ ] ${md(l.text)}${l.detail ? ` (${md(l.detail)})` : ""}`,
					);
				}
				out.push("");
			}
			if (p.program.length > 0) {
				out.push(`**${md(t.workPlanProgram)}**`, "");
				for (const l of p.program) {
					out.push(
						`- **${md(l.section)}** (${md(l.reference)})${l.steps ? ` : ${md(l.steps)}` : ""}`,
					);
				}
				out.push("");
			}
			out.push(`**${md(t.workPlanLeaving)}**`, "");
			for (const l of p.leaving) out.push(`- ${md(l)}`);
			out.push("");
		}
	}
	return `${out.join("\n").trimEnd()}\n`;
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
	html += `    <p class="work-plan-summary">${e(model.summary)}</p>\n  </header>\n`;
	if (model.problems.length > 0) {
		html += `  <section class="run-sheet-problems work-plan-problems">\n    <h3>${e(t.runSheetProblems)}</h3>\n    <ul>\n`;
		for (const p of model.problems) html += `      <li>${e(p)}</li>\n`;
		html += `    </ul>\n  </section>\n`;
	}
	if (model.schedule.length > 0) {
		html += `  <ol class="work-plan-schedule">\n`;
		for (const row of model.schedule) {
			html += `    <li class="schedule-${row.kind}">`;
			if (row.day) html += `<span class="schedule-day">${e(row.day)}</span>`;
			if (row.time) html += `<span class="schedule-time">${e(row.time)}</span>`;
			html += `<span class="schedule-text">${e(row.text)}</span></li>\n`;
		}
		html += `  </ol>\n`;
	}
	for (const day of model.days) {
		html += `  <section class="work-plan-day">\n    <h3><span class="day-heading">${e(day.heading)}</span> <span class="day-slot">${e(day.slot)}</span></h3>\n`;
		for (const n of day.notices) {
			html += `    <p class="work-plan-notice">${e(n)}</p>\n`;
		}
		for (const p of day.passages) {
			html += `    <div class="work-plan-passage">\n`;
			if (day.passages.length > 1) {
				html += `      <h4>${e(p.slot)}</h4>\n`;
			}
			if (p.margin) {
				html += `      <p class="work-plan-margin">${e(p.margin)}</p>\n`;
			}
			if (p.kit.length > 0) {
				html += `      <div class="work-plan-kit">\n        <h4>${e(t.workPlanKit)}</h4>\n        <ul>\n`;
				for (const l of p.kit) {
					html += `          <li class="kit-${l.kind}"><label><input type="checkbox"> ${e(l.text)}${l.detail ? ` <small>(${e(l.detail)})</small>` : ""}</label></li>\n`;
				}
				html += `        </ul>\n      </div>\n`;
			}
			if (p.program.length > 0) {
				html += `      <div class="work-plan-program">\n        <h4>${e(t.workPlanProgram)}</h4>\n        <ul>\n`;
				for (const l of p.program) {
					html += `          <li><strong>${e(l.section)}</strong> <small>(${e(l.reference)})</small>${l.steps ? ` <span class="program-steps">${e(l.steps)}</span>` : ""}</li>\n`;
				}
				html += `        </ul>\n      </div>\n`;
			}
			html += `      <div class="work-plan-leaving">\n        <h4>${e(t.workPlanLeaving)}</h4>\n        <ul>\n`;
			for (const l of p.leaving) html += `          <li>${e(l)}</li>\n`;
			html += `        </ul>\n      </div>\n    </div>\n`;
		}
		html += `  </section>\n`;
	}
	return `${html}</section>\n`;
}

/** What the recipe says next to one of its steps once it is on the calendar. */
export interface StepNote {
	/**
	 * The day, "Saturday, October 10 · D-1", set when the step falls on another
	 * date than the step shown before it: the order of the recipe is not the
	 * order of the time, so it can come back to a day already seen.
	 */
	day?: string;
	/** "around 21:40" */
	when: string;
	/** The rests the step starts, each with how long and until when. */
	rests: { text: string; note?: string }[];
}

/** A recipe on the calendar: what to say at the top, and next to each step. */
export interface RecipeAnnotations {
	/** "Served Sunday, October 11 at 13:00" */
	servedAt: string;
	/** What the plan could not fix, in words. */
	problems: string[];
	/** By `stepKey(section, step)`; a step the plan has no block for has no note. */
	steps: Map<string, StepNote>;
}

/** The key of a step in `RecipeAnnotations.steps`: its section and its index in the section, comments included. */
export const stepKey = (section: number, step: number) => `${section}:${step}`;

const MS_PER_DAY = 86_400_000;
const dayOf = (date: string) =>
	Date.UTC(
		Number(date.slice(0, 4)),
		Number(date.slice(5, 7)) - 1,
		Number(date.slice(8, 10)),
	) / MS_PER_DAY;

/**
 * The words to put next to each step of a recipe whose plan is known: when it
 * starts, on which day, and what it leaves resting. The same words and the same
 * rounding as the production sheet, so the two never disagree. The sheet covers
 * the first recipe of the plan, and so does this.
 */
export function annotateRecipe(
	plan: ProjectedPlan,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): RecipeAnnotations {
	const t = getDictionary(options.lang).renderer;
	const lang = options.lang;
	const round = options.roundTo && options.roundTo > 0 ? options.roundTo : 5;
	const fmt = options.formatDuration ?? formatDuration;
	const blocks = plan.recipes[0]?.blocks ?? [];
	const adjustments = new Map(plan.adjustments.map((a) => [a.task, a]));
	const serveDay = dayOf(plan.serveAt.slice(0, 10));

	const steps = new Map<string, StepNote>();
	let previous: string | undefined;
	data.sections?.forEach((section, s) => {
		section.steps.forEach((step, i) => {
			if (step.type !== "step") return;
			const block = blocks.find(
				(b) => b.kind === "step" && b.section === s && b.step === i,
			);
			if (!block) return;
			const date = block.startLocal.slice(0, 10);
			const note: StepNote = {
				...(date !== previous && {
					day: `${longDate(date, lang)} · ${sessionDayLabel(serveDay - dayOf(date), t)}`,
				}),
				when: fill(t.runSheetAround, {
					time: roundedClock(block.startLocal, round),
				}),
				rests: [],
			};
			previous = date;
			for (const rest of blocks) {
				if (rest.kind !== "passive" || rest.section !== s || rest.step !== i) {
					continue;
				}
				const minutes = (Date.parse(rest.end) - Date.parse(rest.start)) / 60000;
				const endDate = rest.endLocal.slice(0, 10);
				const until = roundedClock(rest.endLocal, round);
				const adjustment = adjustments.get(rest.task);
				note.rests.push({
					text: `${restName(t.runSheetRest, rest.track, step.action)}: ${fmt(minutes)}, ${fill(
						t.runSheetUntil,
						{
							time:
								endDate === date
									? until
									: `${shortDay(endDate, lang)} ${until}`,
						},
					)}`,
					...(adjustment && {
						note: fill(
							adjustment.to > adjustment.from
								? t.runSheetStretched
								: t.runSheetShortened,
							{ from: fmt(adjustment.from), to: fmt(adjustment.to) },
						),
					}),
				});
			}
			steps.set(stepKey(s, i), note);
		});
	});
	return {
		servedAt: servedAtText(plan, options),
		problems: problemsText(plan.diagnostics, data, options, plan.timeZone),
		steps,
	};
}

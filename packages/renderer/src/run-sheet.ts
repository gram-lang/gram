import { getDictionary } from "@gram-lang/i18n";
import type { MiseEnPlaceItem, ProcessedStep } from "@gram-lang/kitchen";
import {
	type ProjectedPlan,
	type ProjectionDiagnostic,
	type RunSheet,
	type RunSheetEntry,
	runSheet,
} from "@gram-lang/scheduler";
import { serializeStepContent } from "./gantt/layout";
import { describeMiseEnPlaceItem, sessionDayLabel } from "./mise-en-place";
import type { RenderableCompilationResult } from "./types";
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

/**
 * One line of the sheet, already in words. Plain text: each output escapes it
 * its own way.
 */
export interface RunSheetLine {
	/** The id of the task in the recipe's graph. */
	task: string;
	kind: RunSheetEntry["kind"];
	/** ISO instants, UTC, exact to the minute. */
	start: string;
	end: string;
	/** "around 21:40" */
	when: string;
	title: string;
	/** What it is made of, for a mise en place or a step. */
	detail?: string;
	/** "20 min", or for a rest, how long and until when. */
	length: string;
	note?: string;
	active: boolean;
}

export interface RunSheetDayModel {
	/** "Saturday, October 10 · D-1" */
	heading: string;
	lines: RunSheetLine[];
}

/** A production sheet in words: what every output (text, Markdown, HTML, calendar) is made from. */
export interface RunSheetModel {
	title: string;
	servedAt: string;
	days: RunSheetDayModel[];
	problems: string[];
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

/**
 * The words of a sheet, from the plan's structure and the recipe it is for:
 * the title, the days with their lines, and what could not be fixed.
 */
export function describeRunSheet(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): RunSheetModel {
	return buildModel(sheet, data, options, 0);
}

function buildModel(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions,
	recipeIndex: number,
): RunSheetModel {
	const t = getDictionary(options.lang).renderer;
	const lang = options.lang;
	const step = options.roundTo && options.roundTo > 0 ? options.roundTo : 5;
	const fmt = options.formatDuration ?? formatDuration;
	const recipe = sheet.recipes[recipeIndex];
	const registry = data.registry;
	const tasks = new Map(
		(data.tasks?.tasks ?? []).map((task) => [task.id, task]),
	);

	const sectionTitle = (index: number) =>
		data.sections?.[index]?.title || t.runSheetUnnamedSection;

	const stepNumber = (section: number, index: number) => {
		let n = 0;
		for (const [i, s] of (data.sections?.[section]?.steps ?? []).entries()) {
			if (s.type === "step") n++;
			if (i === index) break;
		}
		return n;
	};

	const stepOf = (
		section: number,
		index: number,
	): ProcessedStep | undefined => {
		const s = data.sections?.[section]?.steps[index];
		return s?.type === "step" ? s : undefined;
	};

	/** What a task is called in a sentence ("Dough — Mix"). */
	const labelOf = (id: string): string => {
		const task = tasks.get(id);
		if (!task) return id;
		if (task.kind === "prep") {
			return `${t.miseEnPlace} — ${sectionTitle(task.section)}`;
		}
		const s = stepOf(task.section, task.step);
		const name =
			s?.action ||
			fill(t.runSheetStep, {
				n: String(stepNumber(task.section, task.step)),
			});
		return `${sectionTitle(task.section)} — ${name}`;
	};

	const itemsOf = (entry: RunSheetEntry): MiseEnPlaceItem[] => {
		const task = tasks.get(entry.task);
		if (task?.kind === "prep") return task.items;
		return (
			data.miseEnPlace?.find((m) => m.section === entry.section)?.items ?? []
		);
	};

	const local = (iso: string, timeZone: string) =>
		new Intl.DateTimeFormat(lang || "en", {
			timeZone,
			weekday: "short",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(new Date(iso));

	const lineOf = (entry: RunSheetEntry): RunSheetLine => {
		const startDate = entry.startLocal.slice(0, 10);
		const when = fill(t.runSheetAround, {
			time: roundedClock(entry.startLocal, step),
		});
		const duration = fmt(entry.minutes);
		let title: string;
		let detail: string | undefined;
		let length = duration;
		let note: string | undefined;

		if (entry.kind === "prep") {
			title = labelOf(entry.task);
			detail =
				itemsOf(entry)
					.map((item) =>
						describeMiseEnPlaceItem(item, registry, t, fmt, {
							showDuration: false,
						}),
					)
					.join(" · ") || undefined;
		} else if (entry.kind === "step") {
			title = labelOf(entry.task);
			const s = stepOf(entry.section, entry.step ?? 0);
			const text = s ? serializeStepContent(s.content, registry, lang) : "";
			detail = text.length > 200 ? `${text.slice(0, 200)}…` : text || undefined;
		} else {
			const s = stepOf(entry.section, entry.step ?? 0);
			const name = restName(t.runSheetRest, entry.track, s?.action);
			title = `${name} — ${sectionTitle(entry.section)}`;
			// A step with no hands-on time of its own is left out of the sheet: the
			// rest it starts carries what it says.
			const text = s ? serializeStepContent(s.content, registry, lang) : "";
			detail = text.length > 200 ? `${text.slice(0, 200)}…` : text || undefined;
			const endDate = entry.endLocal.slice(0, 10);
			const until = roundedClock(entry.endLocal, step);
			length = `${duration}, ${fill(t.runSheetUntil, {
				time:
					endDate === startDate ? until : `${shortDay(endDate, lang)} ${until}`,
			})}`;
			if (entry.adjustment) {
				const a = entry.adjustment;
				note = fill(a.to > a.from ? t.runSheetStretched : t.runSheetShortened, {
					from: fmt(a.from),
					to: fmt(a.to),
				});
			}
		}
		return {
			task: entry.task,
			kind: entry.kind,
			start: entry.start,
			end: entry.end,
			when,
			title,
			detail,
			length,
			note,
			active: entry.active,
		};
	};

	const daysOut: RunSheetDayModel[] = (recipe?.days ?? []).map((day) => ({
		heading: `${longDate(day.date, lang)} · ${sessionDayLabel(day.daysBefore, t)}`,
		lines: day.entries
			.filter((entry) => entry.kind !== "step" || entry.minutes > 0)
			.map(lineOf),
	}));

	const when = (iso: string) => local(iso, sheet.timeZone);
	const problems = sheet.diagnostics.map((d: ProjectionDiagnostic): string => {
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

	const serveDate = sheet.serveAt.slice(0, 10);
	const recipeTitle = recipe?.title ?? data.title ?? undefined;
	return {
		title: recipeTitle
			? `${t.runSheetTitle} — ${recipeTitle}`
			: t.runSheetTitle,
		servedAt: fill(t.runSheetServedAt, {
			date: longDate(serveDate, lang),
			time: sheet.serveAt.slice(11, 16),
		}),
		days: daysOut,
		problems,
	};
}

/** The production sheet as plain text. */
export function runSheetToText(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = buildModel(sheet, data, options, 0);
	const out: string[] = [model.title, model.servedAt, ""];
	for (const day of model.days) {
		out.push(day.heading);
		for (const line of day.lines) {
			out.push(`  ${line.when.padEnd(18)}${line.title} (${line.length})`);
			if (line.detail) out.push(`${" ".repeat(20)}${line.detail}`);
			if (line.note) out.push(`${" ".repeat(20)}! ${line.note}`);
		}
		out.push("");
	}
	if (model.problems.length > 0) {
		out.push(t.runSheetProblems);
		for (const p of model.problems) out.push(`  - ${p}`);
		out.push("");
	}
	return `${out.join("\n").trimEnd()}\n`;
}

/** The production sheet as Markdown. */
export function runSheetToMarkdown(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const md = escapeMarkdownHtml;
	const model = buildModel(sheet, data, options, 0);
	const h1 = "#".repeat(options.headingLevel ?? 1);
	const h2 = `${h1}#`;
	const out: string[] = [
		`${h1} ${md(model.title)}`,
		"",
		md(model.servedAt),
		"",
	];
	for (const day of model.days) {
		out.push(`${h2} ${md(day.heading)}`, "");
		for (const line of day.lines) {
			const title = line.active
				? `**${md(line.title)}**`
				: `*${md(line.title)}*`;
			out.push(`- ${md(line.when)} — ${title} (${md(line.length)})`);
			if (line.detail) out.push(`  - ${md(line.detail)}`);
			if (line.note) out.push(`  - ⚠️ ${md(line.note)}`);
		}
		out.push("");
	}
	if (model.problems.length > 0) {
		out.push(`${h2} ${md(t.runSheetProblems)}`, "");
		for (const p of model.problems) out.push(`- ${md(p)}`);
		out.push("");
	}
	return `${out.join("\n").trimEnd()}\n`;
}

/** The production sheet as an HTML fragment, every word of the recipe escaped. */
export function runSheetToHTML(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = buildModel(sheet, data, options, 0);
	const e = escapeHtml;
	let html = `<section class="gram-run-sheet">\n  <h2>${e(model.title)}</h2>\n  <p class="run-sheet-served">${e(model.servedAt)}</p>\n`;
	for (const day of model.days) {
		html += `  <section class="run-sheet-day">\n    <h3>${e(day.heading)}</h3>\n    <ul>\n`;
		for (const line of day.lines) {
			html += `      <li class="run-sheet-entry ${line.active ? "active" : "passive"}">\n        <span class="run-sheet-when">${e(line.when)}</span>\n        <span class="run-sheet-title">${e(line.title)}</span> <small class="run-sheet-length">(${e(line.length)})</small>\n`;
			if (line.detail) {
				html += `        <p class="run-sheet-detail">${e(line.detail)}</p>\n`;
			}
			if (line.note) {
				html += `        <p class="run-sheet-note">${e(line.note)}</p>\n`;
			}
			html += `      </li>\n`;
		}
		html += `    </ul>\n  </section>\n`;
	}
	if (model.problems.length > 0) {
		html += `  <section class="run-sheet-problems">\n    <h3>${e(t.runSheetProblems)}</h3>\n    <ul>\n`;
		for (const p of model.problems) html += `      <li>${e(p)}</li>\n`;
		html += `    </ul>\n  </section>\n`;
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
	const sheet = describeRunSheet(runSheet(plan), data, options);
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
	return { servedAt: sheet.servedAt, problems: sheet.problems, steps };
}

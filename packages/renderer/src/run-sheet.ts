import { getDictionary } from "@gram-lang/i18n";
import type { MiseEnPlaceItem, ProcessedStep } from "@gram-lang/kitchen";
import type {
	ProjectionDiagnostic,
	RunSheet,
	RunSheetEntry,
} from "@gram-lang/scheduler";
import { serializeStepContent } from "./gantt/layout";
import { PRINT_CSS } from "./formatters/print";
import { describeMiseEnPlaceItem, sessionDayLabel } from "./mise-en-place";
import type { RenderableCompilationResult } from "./types";
import { escapeHtml, escapeMarkdownHtml, formatDuration } from "./utils";

export interface RunSheetRenderOptions {
	/** Locale code (e.g. 'en', 'fr') for the words and the dates. */
	lang?: string;
	/** Display only: a time is shown to the nearest this many minutes. Default 5. */
	roundTo?: number;
	formatDuration?: (minutes: number) => string;
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
			const name =
				entry.track !== undefined
					? entry.track.charAt(0).toUpperCase() + entry.track.slice(1)
					: s?.action || t.runSheetRest;
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
	const out: string[] = [`# ${md(model.title)}`, "", md(model.servedAt), ""];
	for (const day of model.days) {
		out.push(`## ${md(day.heading)}`, "");
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
		out.push(`## ${md(t.runSheetProblems)}`, "");
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

const RUN_SHEET_PRINT_CSS = `
  .gram-run-sheet h2 { font-size: 16pt; margin-bottom: 4pt; }
  .gram-run-sheet .run-sheet-served { color: var(--grey); margin-bottom: 14pt; }
  .gram-run-sheet h3 { font-size: 12pt; margin: 14pt 0 6pt; border-bottom: 1px solid var(--light-grey); padding-bottom: 2pt; }
  .gram-run-sheet ul { list-style: none; }
  .gram-run-sheet .run-sheet-entry { margin-bottom: 6pt; page-break-inside: avoid; }
  .gram-run-sheet .run-sheet-when { display: inline-block; min-width: 9em; color: var(--grey); }
  .gram-run-sheet .run-sheet-entry.passive .run-sheet-title { font-style: italic; }
  .gram-run-sheet .run-sheet-entry.active .run-sheet-title { font-weight: 700; }
  .gram-run-sheet .run-sheet-detail, .gram-run-sheet .run-sheet-note { margin-left: 9em; color: var(--dark-grey); font-size: 9pt; }
  .gram-run-sheet .run-sheet-note { font-weight: 700; }
  .gram-run-sheet .run-sheet-problems li { margin-left: 1em; list-style: disc; }
`;

/** The production sheet as a complete, print-ready HTML document. */
export function runSheetToPrintHTML(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const model = buildModel(sheet, data, options, 0);
	return `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang || "en")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.title)}</title>
  <style>${PRINT_CSS}${RUN_SHEET_PRINT_CSS}</style>
</head>
<body>
${runSheetToHTML(sheet, data, options)}</body>
</html>`;
}

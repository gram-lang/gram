import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import { TIME_DICTIONARIES, parseDuration } from "@gram-lang/i18n";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import {
	type RenderableCompilationResult,
	formatDuration,
	formatDurationRange,
	prepareViews,
	render,
} from "../src/index";

// The timers of the steps are shown the way Gram shows every time, through
// `formatDuration` (one writing of time in a page), and whatever Gram shows,
// Gram reads back.

const NB = " ";
/** `"1 h 30 min"` with a non-breaking space between each number and its unit. */
const nb = (s: string) => s.replace(/(\d) (?=\p{L})/gu, `$1${NB}`);

const LANGS = Object.keys(TIME_DICTIONARIES);

describe("formatDurationRange", () => {
	it("joins two durations with an en dash, without a word", () => {
		expect(formatDurationRange(45, 60)).toBe(nb(`45 min${NB}– 1 h`));
		expect(formatDurationRange(90, 120)).toBe(nb(`1 h 30 min${NB}– 2 h`));
	});

	it("writes the unit once when both sides are one term in the same unit", () => {
		expect(formatDurationRange(60, 120)).toBe(nb("1–2 h"));
		expect(formatDurationRange(10, 15, "fr")).toBe(nb("10–15 min"));
		expect(formatDurationRange(2880, 4320, "fr")).toBe(nb("2–3 j"));
	});

	it("speaks the display language", () => {
		expect(formatDurationRange(1440, 2160, "fr")).toBe(
			nb(`1 j${NB}– 1 j 12 h`),
		);
	});

	it("counts in days only when both sides reach a day", () => {
		expect(formatDurationRange(720, 1440)).toBe(nb("12–24 h"));
		expect(formatDurationRange(1200, 2880, "fr")).toBe(nb("20–48 h"));
	});
});

describe("Gram reads back what it shows", () => {
	const singles = [
		0, 0.5, 1, 4.5, 30, 45, 59, 60, 61, 90, 125, 1439, 1440, 1500, 2880,
	];
	const ranges: [number, number][] = [
		[1, 2],
		[10, 15],
		[45, 60],
		[60, 120],
		[90, 120],
		[4.5, 6],
		[1440, 2160],
		[2880, 4320],
		[720, 1440],
	];

	for (const lang of LANGS) {
		it(`reads every formatDuration back (${lang})`, () => {
			for (const minutes of singles) {
				const shown = formatDuration(minutes, lang);
				const read = parseDuration(shown);
				expect({ shown, read: read.ok && read.minutes }).toEqual({
					shown,
					read: minutes,
				});
			}
		});

		it(`reads every formatDurationRange back (${lang})`, () => {
			for (const [min, max] of ranges) {
				const shown = formatDurationRange(min, max, lang);
				const read = parseDuration(shown);
				expect({ shown, range: read.ok && read.range }).toEqual({
					shown,
					range: { min, max },
				});
			}
		});
	}
});

const recipe = (step: string): RenderableCompilationResult =>
	analyze(compile(getAST(`## A\n\n${step}\n`)), {}).result;

const out = (
	step: string,
	format: "html" | "markdown" | "text",
	lang?: string,
	formatDuration?: (minutes: number) => string,
): string => {
	const s = render("recipe", prepareViews(recipe(step), {}), format, {
		...(lang && { lang }),
		...(formatDuration && { formatDuration }),
	});
	if (s === null) throw new Error("nothing rendered");
	return s;
};

describe("timers of the steps", () => {
	it("shows a compound timer as formatDuration does", () => {
		expect(out("Bake ~{1h30}.", "markdown")).toContain(nb("1 h 30 min"));
		expect(out("Bake ~{90min}.", "markdown")).toContain(nb("1 h 30 min"));
		expect(out("Bake ~{1 hr 30 mins}.", "text")).toContain(nb("1 h 30 min"));
		expect(out("Cuire ~{5'30\"}.", "markdown", "fr")).toContain(
			nb("5 min 30 s"),
		);
		expect(out("Cuire ~{2 jours}.", "markdown", "fr")).toContain(nb("2 j"));
	});

	it("shows a range with formatDurationRange", () => {
		expect(out("Rise ~{1-2 h}.", "markdown")).toContain(nb("1–2 h"));
		expect(out("Rise ~{1h30-2h}.", "markdown")).toContain(
			nb(`1 h 30 min${NB}– 2 h`),
		);
		expect(out("Rise ~{45 min - 1 h}.", "text")).toContain(
			nb(`45 min${NB}– 1 h`),
		);
	});

	it("never rounds away what the author wrote past a day", () => {
		// formatDuration counts in days and hours from a day up; a timer is
		// exact, so it keeps its minutes in hours rather than lose them.
		expect(out("Cure ~{1d 2h 30min}.", "markdown")).toContain(
			nb("26 h 30 min"),
		);
	});

	it("keeps the writing of a refused timer, never an empty pill", () => {
		expect(out("Bake ~{1:30}.", "markdown")).toContain("1:30");
		expect(out("Bake ~{1:30}.", "html")).toContain(
			'<span class="timer-text">1:30</span>',
		);
	});

	it("gives the minutes to the HTML, and keeps value and unit", () => {
		const html = out("Bake ~{1h30}.", "html");
		expect(html).toContain('data-minutes="90"');
		expect(html).toContain('data-value="90"');
		expect(html).toContain('data-unit="min"');
		expect(html).toContain(
			`<span class="timer-text">${nb("1 h 30 min")}</span>`,
		);
	});
});

describe("timers with the caller's duration format", () => {
	// A surface that writes its durations its own way gets its timers written
	// the same way: one writing of time in a page.
	const minutes = (m: number) => `${Math.round(m)} minutes`;

	it("writes a timer with it, in every format", () => {
		for (const format of ["html", "markdown", "text"] as const) {
			const page = out("Bake ~{1h30}.", format, undefined, minutes);
			expect(page).toContain("Bake");
			expect(page).toContain("90 minutes");
			expect(page).not.toContain(nb("1 h 30 min"));
		}
	});

	it("writes each end of a range with it, joined by an en dash", () => {
		expect(out("Rise ~{1-2 h}.", "markdown", undefined, minutes)).toContain(
			`60 minutes${NB}– 120 minutes`,
		);
	});

	it("keeps the writing of a refused timer", () => {
		expect(out("Bake ~{1:30}.", "markdown", undefined, minutes)).toContain(
			"1:30",
		);
	});
});

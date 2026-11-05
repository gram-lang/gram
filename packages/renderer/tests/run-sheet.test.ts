import { describe, expect, it } from "bun:test";
import { compile, scheduleFor } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import { getAST } from "@gram-lang/parser";
import { project, runSheet, visitSections } from "@gram-lang/scheduler";
import type { MiseEnPlaceMode } from "@gram-lang/scheduler";
import {
	describeRunSheet,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToPrintHTML,
	runSheetToText,
	sectionProgram,
} from "../src/index";

const BREAD = `---
title: Country bread
portions: 4
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake at ^{230C} for ~{30min}.
`;

const ENTREMETS = `---
title: Entremets
portions: 6
---

## Sponge ->&sponge ~{-2d}

[Mix] Whisk @flour{60g} with @sugar{30g} in the #bowl{}.

[Chill] Chill ~_{12-48h}.

## Mousse ->&mousse ~{-1d}

[Whip] Whip @cream{250g} with &sponge and @sugar{30g} using the #whisk{} and #bowl{}.

[Freeze] Freeze ~_{12-48h}.

## Glaze ->&glaze

[Heat] Heat @sugar{20g} to ^{80C} ~{5min}.

[Cool] Cool ~_{90min}.

## Finish

[Assemble] Unmould &mousse and cover with &glaze.
`;

const context = (patch = {}) => ({
	serveAt: "2026-10-11T13:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	...patch,
});
const planOf = (c: ReturnType<typeof compile>, patch = {}) =>
	runSheet(
		project([{ graph: c.tasks, title: c.title ?? undefined }], context(patch)),
		{
			graph: c.tasks,
			context: context(patch),
		},
	);

type Kitted = {
	kit: { items: { text: string; kind: string }[] }[];
	program: { kit?: { text: string; kind: string }[] }[];
};
/** Every line to take out in a visit: at the top, or with its section. */
const kitOf = (p: Kitted) => [
	...p.kit.flatMap((g) => g.items),
	...p.program.flatMap((l) => l.kit ?? []),
];
const kitTexts = (p: Kitted) => kitOf(p).map((l) => l.text);

const compiled = compile(getAST(BREAD));
const sheet = planOf(compiled);

const entremets = compile(getAST(ENTREMETS));
const entremetsContext = context({
	serveAt: "2026-10-17T20:00",
	availability: { daily: [{ start: "08:00", end: "23:00" }] },
});
const entremetsSheet = runSheet(
	project([{ graph: entremets.tasks, title: "Entremets" }], entremetsContext),
	{ graph: entremets.tasks, context: entremetsContext },
);

describe("the model of the work plan", () => {
	const model = describeRunSheet(sheet, compiled);

	it("opens with the title, when it is served for how many, and the totals", () => {
		expect(model.title).toBe("Work plan — Country bread");
		expect(model.subtitle).toBe("For Sunday, October 11 at 13:00 · 4 servings");
		expect(model.summary).toBe(
			"2 days · 2 visits to the kitchen · 55m of work in all",
		);
	});

	it("lists a row per visit, the waits that go on without the cook, and the service", () => {
		expect(model.schedule.map((r) => [r.kind, r.day, r.time, r.text])).toEqual([
			["visit", "SAT 10", "21:40 – 22:00", "Dough"],
			["thread", undefined, undefined, "Dough : Rise 14h 30m (8h to 16h)"],
			["visit", "SUN 11", "12:30 – 13:00", "Bake"],
			["serve", undefined, "13:00", "Serve"],
		]);
	});

	it("says what to take out, and what an earlier visit made", () => {
		const [saturday, sunday] = model.days;
		expect(kitTexts(saturday!.visits[0]!)).toEqual([
			"flour 500 g",
			"water 350 ml",
		]);
		expect(kitTexts(sunday!.visits[0]!)).toEqual(["Dough, made Saturday"]);
	});

	it("gives the programme of each section with the steps it covers", () => {
		const [saturday, sunday] = model.days;
		expect(saturday!.visits[0]!.program).toEqual([
			expect.objectContaining({ section: "Dough", reference: "steps 1 to 2" }),
		]);
		expect(sunday!.visits[0]!.program).toEqual([
			expect.objectContaining({ section: "Bake", reference: "step 1" }),
		]);
	});

	it("says what continues and when to come back", () => {
		const [saturday, sunday] = model.days;
		expect(saturday!.visits[0]!.leaving).toEqual([
			"Dough : Rise 14h 30m (8h to 16h)",
			"Next visit: Sunday 12:30",
		]);
		expect(sunday!.visits[0]!.leaving).toEqual(["Serve at 13:00"]);
	});

	it("tells a rest the plan stretched, on the day it starts", () => {
		expect(model.days[0]!.notices).toEqual([
			"Dough : Rise extended to 14h 30m (planned 8h to 16h) so the work falls within your availability.",
		]);
	});

	it("rounds the display to the nearest five minutes, the sheet staying exact", () => {
		expect(model.days[0]!.slot).toBe("21:40 → 22:00");
		const quarter = describeRunSheet(sheet, compiled, { roundTo: 15 });
		expect(quarter.days[0]!.slot).toBe("21:45 → 22:00");
		expect(sheet.recipes[0]!.days[0]!.visits[0]!.startLocal).toBe(
			"2026-10-10T21:38",
		);
	});

	it("makes one calendar event per visit, in UTC, with the lists as plain lines", () => {
		expect(model.events).toHaveLength(2);
		expect(model.events[0]).toMatchObject({
			start: "2026-10-10T19:38:00Z",
			title: "Country bread · Dough",
		});
		expect(model.events[0]!.description).toContain("- Dough (steps 1 to 2)");
		expect(model.events[0]!.description).toContain("  - flour 500 g");
	});
});

describe("a plan of several days", () => {
	const model = describeRunSheet(entremetsSheet, entremets);

	it("has a block per day and a visit per moment in the kitchen", () => {
		expect(model.days.map((d) => d.visits.length)).toEqual([1, 1, 2]);
		expect(model.summary).toContain("3 days · 4 visits to the kitchen");
	});

	it("takes the first visit of a day for the margin and holds the next by its wait", () => {
		const [first] = model.days;
		expect(first!.visits[0]!.margin).toBe("Possible from 08:00.");
		const [, , saturday] = model.days;
		expect(saturday!.visits[0]!.margin).toBe(
			"Can't start earlier: the “Cool” wait (Glaze) can't be longer than 1h 30m and must be over before Finish.",
		);
	});

	it("names preparations by the section that makes them, with when", () => {
		const [, friday, saturday] = model.days;
		expect(kitTexts(friday!.visits[0]!)).toContain("Sponge, made Thursday");
		expect(kitTexts(saturday!.visits[1]!)).toEqual([
			"Mousse, made Friday",
			"Glaze, made at 18:25",
		]);
	});

	it("lists the cookware once", () => {
		const friday = kitOf(model.days[1]!.visits[0]!);
		expect(
			friday.filter((k) => k.kind === "cookware").map((k) => k.text),
		).toEqual(["whisk", "bowl"]);
	});

	it("without a serving time: days are D-n, slots are durations, no margin", () => {
		const relative = describeRunSheet(
			runSheet(entremets.schedule, { title: "Entremets" }),
			entremets,
		);
		expect(relative.subtitle).toBe("6 servings");
		expect(relative.schedule.map((r) => r.day).filter(Boolean)).toEqual([
			"D-2",
			"D-1",
			"Day D",
		]);
		expect(relative.days[0]!.slot).toBe("~ 5m");
		expect(relative.days.every((d) => d.visits.every((p) => !p.margin))).toBe(
			true,
		);
		const last = relative.days.at(-1)!.visits.at(-1)!;
		expect(last.leaving).toEqual(["Serve"]);
		// Two visits on the same day: no clock to give, so it says so.
		const sameDay = relative.days
			.flatMap((d) => d.visits)
			.filter((p) => p.leaving.includes("Next visit: later the same day"));
		expect(sameDay.length).toBeGreaterThan(0);
		expect(relative.days[0]!.visits[0]!.leaving.at(-1)).toBe("Next visit: D-1");
		expect(relative.events).toEqual([]);
	});
});

describe("a section that comes from an import, and a base kept in stock", () => {
	const imported = structuredClone(entremets);
	// The composer tags a spliced section; a stocked base is a synthetic ingredient.
	(imported.sections[0] as { module?: unknown }).module = {
		binding: "sponge",
		uri: "bases/sponge.gram",
		title: "Sponge",
		mode: "inline",
	};
	imported.registry.ingredients.cream!.is_module_synthetic = true;
	const model = describeRunSheet(entremetsSheet, imported);

	it("names the file the steps are read in", () => {
		const [line] = model.days[0]!.visits[0]!.program;
		expect(line!.reference).toBe("sponge.gram, steps 1 to 2");
		expect(line!.origin).toBe("sponge.gram");
		expect(runSheetToText(entremetsSheet, imported)).toContain(
			"SPONGE — sponge.gram (Start: ",
		);
		expect(runSheetToMarkdown(entremetsSheet, imported)).toContain(
			"### Sponge · sponge.gram · Start: ",
		);
		expect(runSheetToHTML(entremetsSheet, imported)).toContain(
			'<span class="sec-origin">sponge.gram</span>',
		);
	});

	it("lists a stocked base used as a preparation, in stock", () => {
		const stocked = structuredClone(entremets);
		stocked.registry.ingredients.glaze = {
			id: "glaze",
			name: "Glaze",
			is_module_synthetic: true,
		};
		delete (stocked.registry.ingredients.glaze as { is_intermediate?: boolean })
			.is_intermediate;
		// The section that made it is gone: the glaze is only used.
		stocked.sections[2]!.intermediate_preparation = undefined;
		const model = describeRunSheet(entremetsSheet, stocked);
		const texts = model.days
			.flatMap((d) => d.visits)
			.flatMap((p) => kitTexts(p));
		expect(texts).toContain("glaze, in stock");
	});

	it("marks an ingredient that stands for a stocked import", () => {
		expect(kitTexts(model.days[1]!.visits[0]!)).toContain(
			"cream 250 g, in stock",
		);
	});
});

describe("runSheetToText", () => {
	const text = runSheetToText(sheet, compiled);

	it("starts with the planning of the days", () => {
		const lines = text.split("\n");
		expect(lines[0]).toBe("Work plan — Country bread");
		expect(lines[1]).toBe("For Sunday, October 11 at 13:00 · 4 servings");
		expect(text).toMatch(/SAT 10\s+▮ 21:40 – 22:00\s+Dough/);
		expect(text).toMatch(/★ 13:00\s+Serve/);
	});

	it("gives a block per day: what to take out, the steps, what to do on leaving", () => {
		expect(text).toContain("SATURDAY, OCTOBER 10  21:40 → 22:00");
		expect(text).toContain("DOUGH (Start: 21:40)");
		expect(text).toContain("    Mise en place\n      [ ] flour 500 g");
		expect(text).toContain(
			"      1. [Mix] Mix flour with water and knead 20 min.",
		);
		expect(text).toContain("      2. [Rise] Let it rise 8-16 h.");
		expect(text).toContain("BEFORE LEAVING");
		expect(text).toContain("Next visit: Sunday 12:30");
	});

	it("lays the mise en place out as a block of its own when it is told per day", () => {
		const day = runSheetToText(planIn(compiled, "perDay"), compiled);
		expect(day).toContain("MISE EN PLACE\n    [ ] flour 500 g");
		expect(day).toContain("EXECUTION\n    DOUGH (Start:");
		expect(day).toContain("BEFORE LEAVING");
	});

	it("speaks French, dates included", () => {
		const fr = runSheetToText(sheet, compiled, { lang: "fr" });
		expect(fr).toContain("Planning de préparation — Country bread");
		expect(fr).toContain("Pour le dimanche 11 octobre à 13:00 · 4 parts");
		expect(fr).toContain("SAMEDI 10 OCTOBRE");
		expect(
			runSheetToText(planIn(compiled, "perDay"), compiled, { lang: "fr" }),
		).toContain("MISE EN PLACE");
		expect(fr).toContain("Exécution");
		expect(fr).toContain("Début : ");
		expect(fr).toContain("EN PARTANT");
		expect(fr).toContain("Dough, fait samedi");
		expect(fr).toContain("prolongé à");
	});
});

describe("text, Markdown and HTML say the same", () => {
	const visits = describeRunSheet(sheet, compiled).days.flatMap(
		(d) => d.visits,
	);
	const count = (s: string) => (s.match(/before leaving/gi) ?? []).length;

	it("closes every visit with what to do on leaving, whatever it goes on with", () => {
		expect(visits.some((p) => p.waits.length === 0)).toBe(true);
		expect(count(runSheetToText(sheet, compiled))).toBe(visits.length);
		expect(count(runSheetToMarkdown(sheet, compiled))).toBe(visits.length);
		expect(count(runSheetToHTML(sheet, compiled))).toBe(visits.length);
	});

	it("tells the same steps, numbered the same", () => {
		const text = runSheetToText(sheet, compiled);
		const md = runSheetToMarkdown(sheet, compiled);
		const html = runSheetToHTML(sheet, compiled);
		expect(text).toContain("1. [Bake] Shape dough");
		expect(md).toContain("1. **[Bake]** Shape");
		expect(html).toContain(
			'<li value="1"><span class="step-action-badge">Bake</span>',
		);
	});

	it("still tells when to come back", () => {
		for (const p of visits) {
			expect(runSheetToText(sheet, compiled)).toContain(p.next!);
			expect(runSheetToMarkdown(sheet, compiled)).toContain(p.next!);
		}
	});
});

describe("what could not be fixed", () => {
	const exact = compile(getAST(BREAD.replace("~_{8-16h}", "~_{8h}")));
	const text = runSheetToText(planOf(exact), exact);

	it("is listed under the title", () => {
		expect(text).toContain("To fix");
		expect(text).toMatch(
			/Mise en place — Dough, around Sun 04:10, falls when you are not available, and no wait can be moved to fix it/,
		);
		expect(text.indexOf("To fix")).toBeLessThan(text.indexOf("▮"));
	});

	it("is in the language asked for", () => {
		expect(runSheetToText(planOf(exact), exact, { lang: "fr" })).toContain(
			"À régler",
		);
	});

	it("says when a stretch of work is longer than any availability", () => {
		const long = compile(
			getAST("## Roast\n\n[Prepare] Prepare @lamb{2kg} for ~{180min}.\n"),
		);
		const out = runSheetToText(
			planOf(long, {
				availability: { daily: [{ start: "18:00", end: "20:00" }] },
			}),
			long,
		);
		expect(out).toContain(
			"Roast takes 3h 1m without a break, more than your longest availability (2h)",
		);
	});

	it("renders an alert section in HTML with problem icon and heading", () => {
		const html = runSheetToHTML(planOf(exact), exact);
		expect(html).toContain(
			'class="run-sheet-problems work-plan-problems" role="alert"',
		);
		expect(html).toContain('class="problem-icon"');
		expect(html).toContain("To fix");
		expect(html).toContain("<li>Mise en place — Dough, around Sun 04:10");
	});

	it("renders the alert section in French in HTML", () => {
		const html = runSheetToHTML(planOf(exact), exact, { lang: "fr" });
		expect(html).toContain("À régler");
	});
});

describe("runSheetToMarkdown", () => {
	const md = runSheetToMarkdown(sheet, compiled);

	it("has a title, a heading per day and checklists", () => {
		expect(md).toContain("# Work plan — Country bread");
		expect(md).toContain("## Saturday, October 10 · 21:40 → 22:00");
		expect(md).toContain(
			"### Dough · Start: 21:40\n\n**Mise en place**\n\n- [ ] flour 500 g",
		);
		expect(md).toContain("**Execution**\n\n1. **[Mix]** Mix **flour** with");
	});

	it("numbers the three parts of a visit when the mise en place is told per day", () => {
		const day = runSheetToMarkdown(planIn(compiled, "perDay"), compiled);
		expect(day).toContain("### 1. Mise en place\n\n- [ ] flour 500 g");
		expect(day).toContain("### 2. Execution\n\n**Dough** · Start:");
		expect(day).toContain("### 3. Before leaving");
	});

	it("puts the adjustment under its day", () => {
		expect(md).toContain("> ⚠️ Dough : Rise extended to 14h 30m");
	});
});

describe("runSheetToHTML", () => {
	const html = runSheetToHTML(sheet, compiled);

	it("is a section with the planning, then a block per day", () => {
		expect(html).toContain('<section class="gram-run-sheet">');
		expect(html).toContain('<ol class="work-plan-schedule">');
		expect(html).toContain('<section class="work-plan-day">');
		expect(html).toContain(
			'<span class="day-heading">Saturday, October 10</span>',
		);
		expect(html).toContain(
			'<input type="checkbox"><span>flour <span class="kit-qty">500 g</span></span>',
		);
		expect(html).toContain('<li class="schedule-group">');
		expect(html).toContain('class="box-123 box-step-3 work-plan-leaving"');
		expect(html).toContain('<p class="leaving-next">Serve at 13:00</p>');
		expect(html).toContain('class="work-plan-notice"');
	});

	it("needs no script", () => {
		expect(html).not.toContain("<script");
	});

	it("escapes everything that comes from the recipe", () => {
		const hostile = compile(
			getAST(
				"---\ntitle: <img src=x onerror=alert(1)>\n---\n\n## <script>alert(1)</script> ->&d\n\n[<b>Mix</b>] Mix @<i>flour</i>{1g} <i>now</i> ~{5min}.\n\n[Rest] Wait ~_{1h}.\n\n## Bake\n\n[Bake] Bake &d{1g} ~{5min}.\n",
			),
		);
		const out = runSheetToHTML(
			planOf(hostile, {
				availability: { daily: [{ start: "00:00", end: "24:00" }] },
			}),
			hostile,
		);
		expect(out).not.toContain("<script>");
		expect(out).not.toContain("<img");
		expect(out).not.toContain("<b>");
		expect(out).toContain("&lt;script&gt;");
		expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
	});
});

describe("runSheetToPrintHTML", () => {
	const html = runSheetToPrintHTML(sheet, compiled, { lang: "fr" });

	it("is a complete document with the plan inside and the language set", () => {
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html).toContain('<html lang="fr">');
		expect(html).toContain(
			"<title>Planning de préparation — Country bread</title>",
		);
		expect(html).toContain('<section class="gram-run-sheet">');
		expect(html).toContain("page-break-before: always");
	});
});

const TART = `---
title: Tart
---

## Pastry ->&pastry

Rub @flour{200g} with @butter{100g} in the #bowl{}.

## Filling

Mix &pastry{} with @flour{20g} and @sugar{50g} in the #bowl{}.
`;

/** A plan in the given mode, with a serving time. */
const planIn = (
	c: ReturnType<typeof compile>,
	miseEnPlace: MiseEnPlaceMode,
	patch = {},
) => {
	const ctx = context({
		serveAt: "2026-10-17T20:00",
		availability: { daily: [{ start: "08:00", end: "23:00" }] },
		...patch,
	});
	return runSheet(
		project([{ graph: c.tasks, options: { miseEnPlace } }], ctx),
		{ graph: c.tasks, context: ctx },
	);
};
/** The groups of each visit, as [section, lines]. */
const visits = (
	sheet: ReturnType<typeof runSheet>,
	c: ReturnType<typeof compile>,
) =>
	describeRunSheet(sheet, c).days.flatMap((d) =>
		d.visits.map((p) =>
			p.kit.map((g) => [
				g.section,
				g.items.map((l) => l.text + (l.detail ? ` (${l.detail})` : "")),
			]),
		),
	);

describe("the kit follows the mise en place mode of the sheet", () => {
	it("upfront: every raw thing at the first visit, preparations at their first step", () => {
		const v = visits(planIn(entremets, "upfront"), entremets);
		expect(v[0]).toEqual([
			[
				undefined,
				[
					"flour 60 g",
					"sugar 80 g (30 + 30 + 20)",
					"cream 250 g",
					"bowl",
					"whisk",
				],
			],
		]);
		expect(v[1]).toEqual([[undefined, ["Sponge, made Thursday"]]]);
		expect(v[2]).toEqual([]);
		expect(v[3]).toEqual([
			[undefined, ["Mousse, made Friday", "Glaze, made at 18:25"]],
		]);
	});

	it("perDay: raw things at each section's first visit, preparations at the first step", () => {
		const v = visits(planIn(entremets, "perDay"), entremets);
		expect(v[2]).toEqual([[undefined, ["sugar 20 g"]]]);
		expect(v[3]?.[0]?.[1]).toEqual([
			"Mousse, made Friday",
			expect.stringMatching(/^Glaze, made at/),
		]);
	});

	it("is the same without a serving time, the mode read from the schedule", () => {
		const sheet = runSheet(
			{ ...entremets.schedule, miseEnPlace: "upfront" },
			{ title: "Entremets" },
		);
		expect(sheet.recipes[0]!.miseEnPlace).toBe("upfront");
		expect(visits(sheet, entremets)[0]?.[0]?.[1]).toContain(
			"sugar 80 g (30 + 30 + 20)",
		);
	});

	it("perSection: what to take out sits with its section, the cookware once at the first", () => {
		const tart = compile(getAST(TART));
		const [visit] = describeRunSheet(planIn(tart, "perSection"), tart).days[0]!
			.visits;
		expect(visit!.kit).toEqual([]);
		expect(
			visit!.program.map((l) => [l.section, l.kit?.map((k) => k.text)]),
		).toEqual([
			["Pastry", ["flour 200 g", "butter 100 g", "bowl"]],
			["Filling", ["flour 20 g", "sugar 50 g"]],
		]);
	});

	it("perDay and upfront: one group, the quantities summed", () => {
		const tart = compile(getAST(TART));
		for (const mode of ["perDay", "upfront"] as const) {
			expect(visits(planIn(tart, mode), tart)).toEqual([
				[
					[
						undefined,
						["flour 220 g (200 + 20)", "butter 100 g", "sugar 50 g", "bowl"],
					],
				],
			]);
		}
	});

	it("shows the things under their section in text, Markdown, HTML, print and the calendar", () => {
		const tart = compile(getAST(TART));
		const sheet = planIn(tart, "perSection");
		expect(runSheetToText(sheet, tart)).toContain(
			"  PASTRY (Start: 19:55)\n    Mise en place\n      [ ] flour 200 g",
		);
		expect(runSheetToMarkdown(sheet, tart)).toContain("### Filling · Start:");
		expect(runSheetToMarkdown(sheet, tart)).toContain("- [ ] flour 20 g");
		const html = runSheetToHTML(sheet, tart);
		expect(html).toContain('class="section-station-card"');
		expect(html).toContain('<h5 class="mep-sub-title">Ingredients</h5>');
		expect(html).not.toContain('class="box-123 box-step-1"');
		expect(runSheetToPrintHTML(sheet, tart)).toContain(".section-station-card");
		const [event] = describeRunSheet(sheet, tart).events;
		expect(event!.description).toContain("- Pastry (step 1)\n  - flour 200 g");
		// Per working day, the visit is three boxes: take out, do, leave.
		const one = planIn(tart, "perDay");
		const boxes = runSheetToHTML(one, tart);
		expect(boxes).toContain('class="box-123 box-step-1"');
		expect(boxes).toContain('class="box-123 box-step-2"');
		expect(boxes).not.toContain('class="section-station-card"');
		expect(runSheetToText(one, tart)).toContain("MISE EN PLACE");
	});
});

describe("the work plan carries the steps of the recipe", () => {
	it("gives each section its steps, as the recipe numbers them, with their tokens", () => {
		const html = runSheetToHTML(sheet, compiled);
		expect(html).toContain('<ol class="exec-steps-list">');
		expect(html).toContain(
			'<li value="1"><span class="step-action-badge">Mix</span> <span class="step-content">Mix ',
		);
		expect(html).toContain(
			'<span class="temp" data-value="230" data-unit="°C">',
		);
		expect(html).toContain('<span class="timer" ');
		for (const icon of [
			"gicon-timer",
			"gicon-hourglass",
			"gicon-thermometer",
		]) {
			expect(html).not.toContain(icon);
		}
		expect(html).not.toContain("program-ref");
	});

	it("tells when each section starts, text only, and only with a serving time", () => {
		const model = describeRunSheet(sheet, compiled);
		expect(model.days[0]!.visits[0]!.program[0]!.startTime).toBe("21:40");
		expect(model.days[1]!.visits[0]!.program[0]!.startTime).toBe("12:30");
		const html = runSheetToHTML(sheet, compiled);
		expect(html).toContain(
			'<span class="sec-time-pill">Start: <strong>21:40</strong></span>',
		);
		const relative = describeRunSheet(
			runSheet(scheduleFor(compiled, "perSection")!, { graph: compiled.tasks }),
			compiled,
		);
		for (const day of relative.days) {
			for (const l of day.visits.flatMap((p) => p.program)) {
				expect(l.startTime).toBeUndefined();
			}
		}
		expect(
			runSheetToHTML(
				runSheet(scheduleFor(compiled, "perSection")!, {
					graph: compiled.tasks,
				}),
				compiled,
			),
		).not.toContain("sec-time-pill");
	});

	it("rounds the start of a section like the rest of the display", () => {
		const model = describeRunSheet(sheet, compiled, { roundTo: 15 });
		expect(model.days[0]!.visits[0]!.program[0]!.startTime).toBe("21:45");
	});

	it("keeps the section and the range for a recipe with no [Action], the steps without a badge", () => {
		const bare = compile(
			getAST(
				"## Bake\n\nHeat the oven to ^{180C}.\n\nBake ~{20min}.\n\nServe.\n",
			),
		);
		const model = describeRunSheet(planOf(bare), bare);
		const [line] = model.days[0]!.visits[0]!.program;
		expect(line).toMatchObject({ section: "Bake", reference: "steps 1 to 3" });
		expect(line!.steps.map((x) => [x.number, x.action])).toEqual([
			[1, undefined],
			[2, undefined],
			[3, undefined],
		]);
		const html = runSheetToHTML(planOf(bare), bare);
		expect(html).toContain(
			'<li value="1"><span class="step-content">Heat the oven',
		);
		expect(html).not.toContain("step-action-badge");
	});

	it("shows a standalone comment where it stands, without a number", () => {
		const noted = compile(
			getAST(
				"## Cake\n\n[Mix] Mix @flour{100g}.\n\n// Do not overmix.\n\n[Bake] Bake ~{20min}.\n",
			),
		);
		const [line] = describeRunSheet(planOf(noted), noted).days[0]!.visits[0]!
			.program;
		expect(line!.steps.map((x) => [x.number, x.comment, x.text])).toEqual([
			[1, undefined, "Mix flour."],
			[undefined, true, "Do not overmix."],
			[2, undefined, "Bake 20 min."],
		]);
		const html = runSheetToHTML(planOf(noted), noted);
		expect(html).toContain('<li class="step-comment">Do not overmix.</li>');
		expect(html).toContain('<li value="2">');
		expect(runSheetToText(planOf(noted), noted)).toContain(
			"      1. [Mix] Mix flour.\n        (Do not overmix.)\n      2. [Bake] Bake 20 min.",
		);
		expect(runSheetToMarkdown(planOf(noted), noted)).toContain(
			"1. **[Mix]** Mix **flour**.\n> *Do not overmix.*\n\n2. **[Bake]**",
		);
	});

	it("shows no tooltip and no intermediate at the end of a step", () => {
		const made = compile(
			getAST(
				"## A\n\n[Mix] Mix @flour{100g} for ~{5min}. ->&batter{}\n\n## B\n\n[Bake] Bake &batter{} at ^{200C}.\n",
			),
		);
		const sheetOf = planOf(made);
		const html = runSheetToHTML(sheetOf, made);
		expect(html).not.toContain("data-tooltip");
		expect(html).not.toContain("declaration");
		// The preparation used by a step is still named: only the one it makes is left out.
		expect(html).toContain('<span class="reference"');
		const [a] = describeRunSheet(sheetOf, made).days[0]!.visits[0]!.program;
		expect(a!.steps[0]!.text).toBe("Mix flour for 5 min.");
		expect(a!.steps[0]!.md).not.toContain("batter");
		expect(runSheetToText(sheetOf, made)).toContain(
			"1. [Mix] Mix flour for 5 min.\n",
		);
	});

	it("goes on with a section already worked in an earlier visit", () => {
		const doubled = structuredClone(sheet);
		const [day] = doubled.recipes[0]!.days;
		const first = day!.visits[0]!;
		day!.visits.push({
			...structuredClone(first),
			start: first.end + 120,
			end: first.end + 140,
			startLocal: "2026-10-10T23:50",
			endLocal: "2026-10-11T00:10",
			sectionStarts: [
				{ section: 0, start: first.end + 120, startLocal: "2026-10-10T23:50" },
			],
		});
		const [a, b] = describeRunSheet(doubled, compiled).days[0]!.visits;
		expect(a!.program[0]!.continued).toBeUndefined();
		expect(b!.program[0]).toMatchObject({
			continued: true,
			startTime: "23:50",
		});
		expect(runSheetToHTML(doubled, compiled)).toContain(
			'<span class="sec-cont">(continued)</span>',
		);
		expect(runSheetToText(doubled, compiled)).toContain(
			"DOUGH (CONTINUED) (Start: 23:50)",
		);
	});

	it("sectionProgram counts steps as the recipe does, from the first to the last", () => {
		const c = compile(getAST("## A\n\nOne.\n\nTwo.\n\nThree.\n"));
		expect(sectionProgram(c, 0, [0, 2])).toEqual({
			section: 0,
			title: "A",
			from: 1,
			to: 3,
		});
		expect(sectionProgram(c, 0, [])).toBeUndefined();
	});
});

const CANNELES = `---
title: Cannelés
portions: 4
---

## Batter ->&batter ~{-1d}

[Mix] Mix @flour{300g} with @milk{1l}.

[Chill] Chill ~_{24h}.

## Bake

[Bake] Bake &batter for ~{30min}.
`;

const FILLED_PIE = `---
title: Filled pie
portions: 4
---

## Dough ->&dough ~{-2d}

[Mix] Mix @flour{300g} ~{10min}.

[Rest] Rest ~_{24h}.

## Filling ->&filling ~{-1d}

[Chop] Chop @onion{2}(diced) with the #knife{} ~{10min}.

[Rest] Rest ~_{24h}.

## Assemble

[Fill] Fill &dough with &filling in the #tin{} ~{10min}.
`;

const RECIPES = {
	cannelés: CANNELES,
	entremets: ENTREMETS,
	"filled pie": FILLED_PIE,
	bread: BREAD,
};
const MODES: MiseEnPlaceMode[] = ["perSection", "upfront", "perDay"];

/** A plan in `mode`, with a serving time (calendar) or without (relative). */
const sheetOf = (
	c: ReturnType<typeof compile>,
	mode: MiseEnPlaceMode,
	calendar: boolean,
) => {
	if (!calendar) {
		const schedule = scheduleFor(c, mode);
		if (!schedule) throw new Error("no schedule");
		return runSheet(schedule, { graph: c.tasks });
	}
	return planIn(c, mode);
};

describe("the work plan, whatever the mode and the clock", () => {
	for (const [name, source] of Object.entries(RECIPES)) {
		for (const mode of MODES) {
			const c = compile(getAST(source));
			const calendar = sheetOf(c, mode, true);
			const relative = sheetOf(c, mode, false);
			it(`${name}, ${mode}: without a clock, each visit is on the day the calendar puts it`, () => {
				const daysOf = (sheet: ReturnType<typeof runSheet>) =>
					sheet.recipes[0]!.days.flatMap((d) =>
						d.visits.map(() => d.daysBefore),
					);
				expect(daysOf(relative)).toEqual(daysOf(calendar));
			});

			it(`${name}, ${mode}: a visit is named after the sections it works on`, () => {
				const tasks = new Map(c.tasks.tasks.map((t) => [t.id, t]));
				for (const sheet of [calendar, relative]) {
					const real = sheet.recipes[0]!.days.flatMap((d) => d.visits);
					const heads = describeRunSheet(sheet, c)
						.schedule.filter((row) => row.kind === "visit")
						.map((row) => row.text);
					expect(heads).toHaveLength(real.length);
					real.forEach((v, k) => {
						const worked = [
							...new Set(
								v.tasks.flatMap((id) => {
									const t = tasks.get(id);
									return t?.kind === "step" ? [t.section] : [];
								}),
							),
						].sort((a, b) => a - b);
						expect(v.worked).toEqual(worked);
						const expected = visitSections(v)
							.map((s) => c.sections[s]?.title)
							.join(", ");
						expect(heads[k]).toBe(expected);
					});
				}
			});

			it(`${name}, ${mode}: without a clock, "later the same day" is only said inside a day`, () => {
				for (const day of describeRunSheet(relative, c).days) {
					day.visits.forEach((v, k) => {
						const last = k === day.visits.length - 1;
						expect(v.leaving.includes("Next visit: later the same day")).toBe(
							!last,
						);
					});
				}
			});
		}
	}
});

describe("the weight and the cookware of the mise en place", () => {
	const DB = {
		flour: { name: "Flour", physical: { density: 0.55 } },
		"lemon-juice": { name: "Lemon juice", physical: { density: 1.03 } },
	};
	const SRC =
		"## A\n\nMix @flour{2cup} with @lemon juice{120ml} and @sugar{50g} in a #tray{2}(large).\n\n## B\n\nAdd @flour{1cup} on the #tray{3}(large) and a #tin{}(24cm).\n";
	const analyzedOf = (standardize: boolean) =>
		analyze(compile(getAST(SRC)), DB as never, {
			enableMassStandardization: standardize,
		}).result;
	const kitFor = (c: ReturnType<typeof compile>, mode: MiseEnPlaceMode) =>
		describeRunSheet(planIn(c, mode), c).days.flatMap((d) =>
			d.visits.flatMap((p) => [
				...p.kit.flatMap((g) => g.items),
				...p.program.flatMap((l) => l.kit ?? []),
			]),
		);

	it("tells the weight of a quantity written in another unit, when standardized", () => {
		const items = kitFor(analyzedOf(true), "perSection");
		const flour = items.filter((i) => i.name === "flour");
		expect(flour.map((i) => [i.quantity, i.mass])).toEqual([
			["2 cup", "260.3 g"],
			["1 cup", "130.1 g"],
		]);
		expect(items.find((i) => i.name === "lemon juice")).toMatchObject({
			quantity: "120 ml",
			mass: "123.6 g",
		});
		expect(items.find((i) => i.text.startsWith("flour 2 cup"))!.text).toBe(
			"flour 2 cup · 260.3 g",
		);
	});

	it("does not repeat a quantity that already is a weight, nor invent one", () => {
		const items = kitFor(analyzedOf(true), "perSection");
		expect(items.find((i) => i.name === "sugar")!.mass).toBeUndefined();
		for (const i of kitFor(analyzedOf(false), "perSection")) {
			expect(i.mass).toBeUndefined();
		}
	});

	it("sums the weights of an ingredient asked by several sections", () => {
		const items = kitFor(analyzedOf(true), "perDay");
		const flour = items.find((i) => i.name === "flour")!;
		expect(flour).toMatchObject({
			quantity: "3 cup",
			detail: "2 + 1",
			mass: "390.4 g",
		});
	});

	it("writes the weight in text, Markdown and HTML", () => {
		const c = analyzedOf(true);
		const sheet = planIn(c, "perSection");
		expect(runSheetToText(sheet, c)).toContain("[ ] flour 2 cup · 260.3 g");
		expect(runSheetToMarkdown(sheet, c)).toContain(
			"- [ ] flour 2 cup · 260.3 g",
		);
		expect(runSheetToHTML(sheet, c)).toContain(
			'<span class="kit-qty"><span class="kit-orig">2 cup</span><span class="kit-mass">260.3 g</span></span>',
		);
		const plain = analyzedOf(false);
		expect(runSheetToHTML(planIn(plain, "perSection"), plain)).not.toContain(
			"kit-mass",
		);
	});

	it("tells how many of a tool and its size, the most asked at once", () => {
		const c = compile(getAST(SRC));
		const tools = kitFor(c, "perDay").filter((i) => i.kind === "cookware");
		expect(tools.map((i) => [i.name, i.quantity, i.note, i.text])).toEqual([
			["tray", "×3", "large", "tray ×3 (large)"],
			["tin", undefined, "24cm", "tin (24cm)"],
		]);
	});

	it("by section, tells a tool once with the most the visit asks of it", () => {
		const c = compile(getAST(SRC));
		const tools = kitFor(c, "perSection").filter((i) => i.kind === "cookware");
		expect(tools.map((i) => i.text)).toEqual(["tray ×3 (large)", "tin (24cm)"]);
	});

	it("writes the tool details in the HTML and the text", () => {
		const c = compile(getAST(SRC));
		const sheet = planIn(c, "perDay");
		const html = runSheetToHTML(sheet, c);
		expect(html).toContain(
			'<li class="kit-cookware has-qty"><label><input type="checkbox"><span>tray <span class="kit-detail">(large)</span> <span class="kit-qty">×3</span></span></label></li>',
		);
		expect(runSheetToText(sheet, c)).toContain("[ ] tray ×3 (large)");
		// A tool with nothing to add stays a name alone.
		const bare = compile(getAST("## A\n\nHeat the #pan{}.\n"));
		expect(runSheetToHTML(planOf(bare), bare)).toContain(
			'<li class="kit-cookware"><label><input type="checkbox"><span>pan</span></label></li>',
		);
	});
});

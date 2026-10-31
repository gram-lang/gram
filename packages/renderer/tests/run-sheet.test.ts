import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import {
	describeRunSheet,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToPrintHTML,
	runSheetToText,
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

	it("lists a row per passage, the waits that go on without the cook, and the service", () => {
		expect(model.schedule.map((r) => [r.kind, r.day, r.time, r.text])).toEqual([
			["passage", "SAT 10", "21:40 – 22:00", "Dough"],
			["thread", undefined, undefined, "Dough : Rise 14h 30m (8h to 16h)"],
			["passage", "SUN 11", "12:30 – 13:00", "Bake"],
			["serve", undefined, "13:00", "Serve"],
		]);
	});

	it("says what to take out, and what an earlier passage made", () => {
		const [saturday, sunday] = model.days;
		expect(saturday!.passages[0]!.kit.map((k) => k.text)).toEqual([
			"flour 500 g",
			"water 350 ml",
		]);
		expect(sunday!.passages[0]!.kit.map((k) => k.text)).toEqual([
			"Dough, made Saturday",
		]);
	});

	it("gives the programme of each section with the steps it covers", () => {
		const [saturday, sunday] = model.days;
		expect(saturday!.passages[0]!.program).toEqual([
			{
				section: "Dough",
				reference: "steps 1 to 2",
				steps: "Mix 20 min › Rise 8 to 16 h",
				sequence: [
					{ action: "Mix", temperatures: [], timers: ["20 min"] },
					{ action: "Rise", temperatures: [], timers: ["8 to 16 h"] },
				],
			},
		]);
		expect(sunday!.passages[0]!.program[0]).toMatchObject({
			section: "Bake",
			reference: "step 1",
			steps: "Bake 230 °C 30 min",
		});
	});

	it("says what continues and when to come back", () => {
		const [saturday, sunday] = model.days;
		expect(saturday!.passages[0]!.leaving).toEqual([
			"Dough : Rise 14h 30m (8h to 16h)",
			"Next visit: Sunday 12:30",
		]);
		expect(sunday!.passages[0]!.leaving).toEqual(["Serve at 13:00"]);
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
		expect(sheet.recipes[0]!.days[0]!.passages[0]!.startLocal).toBe(
			"2026-10-10T21:38",
		);
	});

	it("makes one calendar event per passage, in UTC, with the lists as plain lines", () => {
		expect(model.events).toHaveLength(2);
		expect(model.events[0]).toMatchObject({
			start: "2026-10-10T19:38:00Z",
			title: "Country bread · Dough",
		});
		expect(model.events[0]!.description).toContain("To take out :");
		expect(model.events[0]!.description).toContain("- flour 500 g");
	});
});

describe("a plan of several days", () => {
	const model = describeRunSheet(entremetsSheet, entremets);

	it("has a block per day and a passage per moment in the kitchen", () => {
		expect(model.days.map((d) => d.passages.length)).toEqual([1, 1, 2]);
		expect(model.summary).toContain("3 days · 4 visits to the kitchen");
	});

	it("takes the first passage of a day for the margin and holds the next by its wait", () => {
		const [first] = model.days;
		expect(first!.passages[0]!.margin).toBe("Possible from 08:00.");
		const [, , saturday] = model.days;
		expect(saturday!.passages[0]!.margin).toBe(
			"Fixed times: Glaze : Cool 1h 30m, before Finish.",
		);
	});

	it("names preparations by the section that makes them, with when", () => {
		const [, friday, saturday] = model.days;
		expect(friday!.passages[0]!.kit.map((k) => k.text)).toContain(
			"Sponge, made Thursday",
		);
		expect(saturday!.passages[1]!.kit.map((k) => k.text)).toEqual([
			"Mousse, made Friday",
			"Glaze, made at 18:25",
		]);
	});

	it("lists the cookware once", () => {
		const friday = model.days[1]!.passages[0]!.kit;
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
		expect(relative.days.every((d) => d.passages.every((p) => !p.margin))).toBe(
			true,
		);
		const last = relative.days.at(-1)!.passages.at(-1)!;
		expect(last.leaving).toEqual(["Serve"]);
		// Two visits on the same day: no clock to give, so it says so.
		const sameDay = relative.days
			.flatMap((d) => d.passages)
			.filter((p) => p.leaving.includes("Next visit: later the same day"));
		expect(sameDay.length).toBeGreaterThan(0);
		expect(relative.days[0]!.passages[0]!.leaving.at(-1)).toBe(
			"Next visit: D-1",
		);
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
		expect(model.days[0]!.passages[0]!.program[0]!.reference).toBe(
			"sponge.gram, steps 1 to 2",
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
			.flatMap((d) => d.passages)
			.flatMap((p) => p.kit.map((k) => k.text));
		expect(texts).toContain("glaze, in stock");
	});

	it("marks an ingredient that stands for a stocked import", () => {
		expect(model.days[1]!.passages[0]!.kit.map((k) => k.text)).toContain(
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

	it("gives a block per day with its three lists", () => {
		expect(text).toContain("SATURDAY, OCTOBER 10  21:40 → 22:00");
		expect(text).toContain("[ ] flour 500 g");
		expect(text).toContain(
			"Dough (steps 1 to 2) : Mix 20 min › Rise 8 to 16 h",
		);
		expect(text).toContain("Next visit: Sunday 12:30");
	});

	it("speaks French, dates included", () => {
		const fr = runSheetToText(sheet, compiled, { lang: "fr" });
		expect(fr).toContain("Planning de préparation — Country bread");
		expect(fr).toContain("Pour le dimanche 11 octobre à 13:00 · 4 parts");
		expect(fr).toContain("SAMEDI 10 OCTOBRE");
		expect(fr).toContain("À sortir");
		expect(fr).toContain("Au programme");
		expect(fr).toContain("En partant");
		expect(fr).toContain("Dough, fait samedi");
		expect(fr).toContain("prolongé à");
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
});

describe("runSheetToMarkdown", () => {
	const md = runSheetToMarkdown(sheet, compiled);

	it("has a title, a heading per day and checklists", () => {
		expect(md).toContain("# Work plan — Country bread");
		expect(md).toContain("## Saturday, October 10 · 21:40 → 22:00");
		expect(md).toContain("- [ ] flour 500 g");
		expect(md).toContain("**To take out**");
		expect(md).toMatch(/- \*\*Dough\*\* \(steps 1 to 2\) : Mix 20 min › Rise/);
	});

	it("puts the adjustment under its day", () => {
		expect(md).toContain("> ⚠️ Dough : Rise extended to 14h 30m");
	});

	it("goes one level down when it follows a recipe", () => {
		const two = runSheetToMarkdown(sheet, compiled, { headingLevel: 2 });
		expect(two).toContain("## Work plan — Country bread");
		expect(two).toContain("### Saturday, October 10");
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
		expect(html).toContain('class="work-plan-leaving"');
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

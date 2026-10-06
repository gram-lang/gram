import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { type ProjectedPlan, project } from "@gram-lang/scheduler";
import {
	annotateRecipe,
	stepKey,
	toHTML,
	toMarkdown,
	toPrintHTML,
} from "../src/index";

const BREAD = `---
title: Country bread
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake for ~{30min}.
`;

const compiled = compile(getAST(BREAD));
const planOf = (c = compiled, patch = {}): ProjectedPlan =>
	project([{ graph: c.tasks, title: "Country bread" }], {
		serveAt: "2026-10-11T13:00",
		timeZone: "Europe/Paris",
		availability: { daily: [{ start: "08:00", end: "22:00" }] },
		...patch,
	});
const plan = planOf();

describe("annotateRecipe", () => {
	const notes = annotateRecipe(plan, compiled);

	it("says when it is served and what could not be fixed, in words", () => {
		expect(notes.servedAt).toBe("Served Sunday, October 11 at 13:00");
		expect(notes.problems).toEqual([
			"The work of Day D falls on Saturday, October 10 instead of Sunday, October 11.",
		]);
	});

	it("gives each step a time, to the nearest five minutes", () => {
		expect(notes.steps.get(stepKey(0, 0))?.when).toBe("around 21:40");
		expect(notes.steps.get(stepKey(0, 1))?.when).toBe("around 22:00");
		expect(notes.steps.get(stepKey(1, 0))?.when).toBe("around 12:30");
	});

	it("names the day on the first step and again when it changes", () => {
		expect(notes.steps.get(stepKey(0, 0))?.day).toBe(
			"Saturday, October 10 · D-1",
		);
		expect(notes.steps.get(stepKey(0, 1))?.day).toBeUndefined();
		expect(notes.steps.get(stepKey(1, 0))?.day).toBe(
			"Sunday, October 11 · Day D",
		);
	});

	it("lists what a step leaves resting, with the note of a stretched rest", () => {
		const rise = notes.steps.get(stepKey(0, 1))!;
		expect(rise.rests).toEqual([
			{
				text: "Rise: 14h 30m, until around Sun 12:30",
				note: "Wait stretched from 8h to 14h 30m to stay out of your unavailable hours",
			},
		]);
		expect(notes.steps.get(stepKey(0, 0))?.rests).toEqual([]);
	});

	it("has no note for a comment, nor for a step the plan has no block for", () => {
		expect(notes.steps.get(stepKey(0, 9))).toBeUndefined();
	});

	it("comes back to a day already seen when the order of the recipe is not that of the time", () => {
		const three = compile(
			getAST(
				"## A\n\nOne @a{1g}.\n\n## B\n\nTwo @b{1g}.\n\n## C\n\nThree @c{1g}.\n",
			),
		);
		const block = (section: number, local: string) => ({
			kind: "step" as const,
			task: `s${section}.0`,
			section,
			step: 0,
			start: `${local}:00Z`,
			end: `${local}:00Z`,
			startLocal: local,
			endLocal: local,
		});
		const crafted = {
			serveAt: "2026-10-11T13:00",
			timeZone: "Europe/Paris",
			recipes: [
				{
					blocks: [
						block(0, "2026-10-10T20:00"),
						block(1, "2026-10-11T09:00"),
						block(2, "2026-10-10T22:00"),
					],
					sessions: [],
				},
			],
			adjustments: [],
			unavailable: [],
			diagnostics: [],
		} as unknown as ProjectedPlan;
		const days = annotateRecipe(crafted, three);
		expect(days.steps.get(stepKey(0, 0))?.day).toContain("October 10");
		expect(days.steps.get(stepKey(1, 0))?.day).toContain("October 11");
		expect(days.steps.get(stepKey(2, 0))?.day).toContain("October 10");
	});

	it("speaks French, dates included", () => {
		const fr = annotateRecipe(plan, compiled, { lang: "fr" });
		expect(fr.servedAt).toBe("Servi le dimanche 11 octobre à 13:00");
		expect(fr.steps.get(stepKey(0, 0))?.day).toBe("samedi 10 octobre · J-1");
		expect(fr.steps.get(stepKey(0, 0))?.when).toBe("vers 21:40");
	});
});

describe("toMarkdown with a projection", () => {
	const md = toMarkdown(compiled, { projection: plan });

	it("opens the instructions with when it is served and what to fix", () => {
		const instructions = md.slice(md.indexOf("## 👨‍🍳 Instructions"));
		expect(instructions).toContain("> **Served Sunday, October 11 at 13:00**");
		expect(instructions).toContain("> - The work of Day D falls on Saturday");
	});

	it("puts the day before its steps and the time after each", () => {
		expect(md).toContain("**Saturday, October 10 · D-1**\n\n1. **[Mix]**");
		expect(md).toMatch(/knead ⏲️ 20 min\. — \*around 21:40\*/);
		expect(md).toContain("**Sunday, October 11 · Day D**\n\n1. **[Bake]**");
	});

	it("lists a rest under its step, with its note", () => {
		expect(md).toContain("   - ⏳ Rise: 14h 30m, until around Sun 12:30");
		expect(md).toContain("   - ⚠️ *Wait stretched from 8h to 14h 30m");
	});

	it("shows the total time of the plan, not of the default timeline", () => {
		const plain = toMarkdown(compiled);
		const total = (text: string) => /Total Time\*\*: ([^\n]+)/.exec(text)![1];
		expect(total(plain)).not.toBe(total(md));
		// 21:38 on Saturday to 13:00 on Sunday: 15 h 22.
		expect(total(md)).toBe("15h 22m");
	});

	it("is the recipe as it always was without a projection", () => {
		expect(toMarkdown(compiled, { projection: undefined })).toBe(
			toMarkdown(compiled),
		);
		expect(toMarkdown(compiled)).not.toContain("around");
	});
});

describe("toHTML and toPrintHTML with a projection", () => {
	it("write the summary, the day between steps and the time in each step", () => {
		for (const html of [
			toHTML(compiled, { projection: plan }),
			toPrintHTML(compiled, { projection: plan }),
		]) {
			expect(html).toContain('<aside class="plan-summary">');
			expect(html).toContain("Served Sunday, October 11 at 13:00");
			expect(html).toContain(
				'<li class="step-day">Saturday, October 10 · D-1</li>',
			);
			expect(html).toContain('<span class="step-when">around 21:40</span>');
			expect(html).toContain(
				'<span class="step-rest">Rise: 14h 30m, until around Sun 12:30</span>',
			);
			expect(html).toContain('<em class="step-note">Wait stretched');
		}
	});

	it("put the day before the step it announces, inside the list", () => {
		const html = toHTML(compiled, { projection: plan });
		const day = html.indexOf('<li class="step-day">Saturday');
		const first = html.indexOf('<li value="1"', day);
		expect(day).toBeGreaterThan(html.indexOf('<ol class="steps">'));
		expect(first).toBeGreaterThan(day);
	});

	it("speak the language asked for", () => {
		const html = toHTML(compiled, { projection: plan, lang: "fr" });
		expect(html).toContain("Servi le dimanche 11 octobre à 13:00");
		expect(html).toContain("vers 21:40");
		expect(html).toContain("Attente allongée de");
	});

	it("escape everything that comes from the recipe", () => {
		const hostile = compile(
			getAST(
				"---\ntitle: <b>x</b>\n---\n\n## <script>alert(1)</script> ->&d\n\n[<img src=x onerror=alert(1)>] Mix @flour{1g}, wait ~_{1-3h}.\n\n## Bake\n\n[Bake] Bake &d{1g} ~{5min}.\n",
			),
		);
		const p = planOf(hostile, {
			availability: { daily: [{ start: "00:00", end: "24:00" }] },
		});
		for (const out of [
			toHTML(hostile, { projection: p, runSheet: true }),
			toPrintHTML(hostile, { projection: p, runSheet: true }),
		]) {
			expect(out).not.toContain("<script>");
			expect(out).not.toContain("<img src=x");
		}
	});
});

describe("the production sheet after the recipe", () => {
	it("is written after the nutrition, one heading level down in Markdown", () => {
		const md = toMarkdown(compiled, { projection: plan, runSheet: true });
		expect(md.indexOf("## Production sheet — Country bread")).toBeGreaterThan(
			md.indexOf("## 👨‍🍳 Instructions"),
		);
		expect(md).toContain("### Saturday, October 10 · D-1");
		expect(md).toContain("### To fix");
		expect(md.match(/^# /gm)).toHaveLength(1); // only the recipe's own title
	});

	it("follows the recipe in HTML and in the print document, with its styles", () => {
		const html = toHTML(compiled, { projection: plan, runSheet: true });
		expect(html.indexOf('<section class="gram-run-sheet">')).toBeGreaterThan(
			html.indexOf('<div class="instructions">'),
		);
		const print = toPrintHTML(compiled, { projection: plan, runSheet: true });
		expect(print).toContain('<section class="gram-run-sheet">');
		expect(print).toContain(".run-sheet-entry");
		expect(print).toContain(".plan-summary");
	});

	it("needs a projection: without one, the option does nothing", () => {
		expect(toMarkdown(compiled, { runSheet: true })).toBe(toMarkdown(compiled));
		expect(toHTML(compiled, { runSheet: true })).toBe(toHTML(compiled));
	});

	it("is not written unless asked for", () => {
		expect(toMarkdown(compiled, { projection: plan })).not.toContain(
			"Production sheet",
		);
	});
});

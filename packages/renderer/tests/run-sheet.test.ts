import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import {
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToPrintHTML,
	runSheetToText,
} from "../src/index";

const BREAD = `---
title: Country bread
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake at ^{230C} for ~{30min}.
`;

const compiled = compile(getAST(BREAD));
const context = (patch = {}) => ({
	serveAt: "2026-10-11T13:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	...patch,
});
const sheetOf = (c = compiled, patch = {}) =>
	runSheet(
		project([{ graph: c.tasks, title: "Country bread" }], context(patch)),
	);
const sheet = sheetOf();

describe("runSheetToText", () => {
	const text = runSheetToText(sheet, compiled);

	it("opens with the title and when it is served", () => {
		const [title, served] = text.split("\n");
		expect(title).toBe("Production sheet — Country bread");
		expect(served).toBe("Served Sunday, October 11 at 13:00");
	});

	it("gives each day a heading with its distance from the service", () => {
		expect(text).toContain("Saturday, October 10 · D-1");
		expect(text).toContain("Sunday, October 11 · Day D");
	});

	it("lists the tasks of a day in order, to the nearest five minutes", () => {
		// The kneading starts at 21:38 on the wall clock and shows as 21:40.
		expect(text).toMatch(/around 21:40\s+Mise en place — Dough/);
		const saturday = text.slice(0, text.indexOf("Sunday, October 11 ·"));
		expect(saturday.indexOf("Mise en place")).toBeLessThan(
			saturday.indexOf("Dough — Mix"),
		);
	});

	it("says what a step is made of and what a mise en place gathers", () => {
		expect(text).toContain("Mix flour (500 g) with water (350 ml)");
		expect(text).toContain("Let it rise");
		expect(text).toContain("Ingredients lookup (base)");
	});

	it("shows a rest with how long it lasts and until when, and why it was stretched", () => {
		expect(text).toMatch(/Rise — Dough \(14h 30m, until around Sun 12:30\)/);
		expect(text).toContain(
			"! Rest stretched from 8h to 14h 30m to stay out of your unavailable hours",
		);
	});

	it("leaves the weekday out when a rest ends the day it starts", () => {
		const overnight = runSheetToText(
			sheetOf(compiled, {
				availability: { daily: [{ start: "00:00", end: "24:00" }] },
				serveAt: "2026-10-11T13:00",
			}),
			compiled,
		);
		expect(overnight).toMatch(/8h, until around 12:30\)/);
	});
});

describe("runSheetToText in French", () => {
	const text = runSheetToText(sheet, compiled, { lang: "fr" });

	it("speaks French, dates included", () => {
		expect(text).toContain("Fiche de production — Country bread");
		expect(text).toContain("Servi le dimanche 11 octobre à 13:00");
		expect(text).toContain("samedi 10 octobre · J-1");
		expect(text).toContain("dimanche 11 octobre · Jour J");
		expect(text).toMatch(/vers 21:40/);
		expect(text).toContain("Repos allongé de");
	});
});

describe("what could not be fixed", () => {
	const exact = compile(getAST(BREAD.replace("~_{8-16h}", "~_{8h}")));
	const text = runSheetToText(sheetOf(exact), exact);

	it("is listed after the days", () => {
		expect(text).toContain("To fix");
		expect(text).toMatch(
			/Mise en place — Dough, around Sun 04:10, falls when you are not available, and no rest can be moved to fix it/,
		);
		expect(text.indexOf("To fix")).toBeGreaterThan(text.indexOf("Day D"));
	});

	it("is in the language asked for", () => {
		expect(runSheetToText(sheetOf(exact), exact, { lang: "fr" })).toContain(
			"À régler",
		);
	});

	it("says when a stretch of work is longer than any availability", () => {
		const long = compile(
			getAST("## Roast\n\n[Prepare] Prepare @lamb{2kg} for ~{180min}.\n"),
		);
		const out = runSheetToText(
			sheetOf(long, {
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

	it("has a title, a heading per day and a list of tasks", () => {
		expect(md).toContain("# Production sheet — Country bread");
		expect(md).toContain("## Saturday, October 10 · D-1");
		expect(md).toMatch(/- around 21:40 — \*\*Dough — Mix\*\*/);
	});

	it("puts a rest in italics, with its adjustment under it", () => {
		expect(md).toMatch(/\*Rise — Dough\* \(14h 30m, until around Sun 12:30\)/);
		expect(md).toContain("⚠️ Rest stretched");
	});
});

describe("runSheetToHTML", () => {
	const html = runSheetToHTML(sheet, compiled);

	it("is a section with a day each, marking active and passive tasks", () => {
		expect(html).toContain('<section class="gram-run-sheet">');
		expect(html).toContain("<h3>Saturday, October 10 · D-1</h3>");
		expect(html).toContain('class="run-sheet-entry active"');
		expect(html).toContain('class="run-sheet-entry passive"');
		expect(html).toContain('class="run-sheet-note"');
	});

	it("escapes everything that comes from the recipe", () => {
		const hostile = compile(
			getAST(
				"---\ntitle: <img src=x onerror=alert(1)>\n---\n\n## <script>alert(1)</script> ->&d\n\n[<b>Mix</b>] Mix @flour{1g} <i>now</i> ~{5min}.\n\n[Rest] Wait ~_{1h}.\n\n## Bake\n\n[Bake] Bake &d{1g} ~{5min}.\n",
			),
		);
		const out = runSheetToHTML(
			runSheet(
				project(
					[{ graph: hostile.tasks, title: "<img src=x onerror=alert(1)>" }],
					context({
						availability: { daily: [{ start: "00:00", end: "24:00" }] },
					}),
				),
			),
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

	it("is a complete document with the sheet inside and the language set", () => {
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html).toContain('<html lang="fr">');
		expect(html).toContain(
			"<title>Fiche de production — Country bread</title>",
		);
		expect(html).toContain('<section class="gram-run-sheet">');
		expect(html).toContain(".run-sheet-entry");
	});
});

describe("the rounding of the display", () => {
	it("goes to the nearest N minutes, the calculation staying exact", () => {
		const a = runSheetToText(sheet, compiled, { roundTo: 15 });
		expect(a).toMatch(/around 21:45/);
		// The sheet itself still holds the minute.
		expect(sheet.recipes[0]!.days[0]!.entries[0]!.startLocal).toBe(
			"2026-10-10T21:38",
		);
	});
});

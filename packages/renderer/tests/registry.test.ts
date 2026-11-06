import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import {
	FORMAT_DEFINITIONS,
	FORMATS,
	VIEW_SETTINGS,
	getView,
	prepareViews,
	render,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToPrintHTML,
	runSheetToText,
	toHTML,
	toMarkdown,
	toPrintHTML,
	viewSettingsToRendererOptions,
	views,
} from "../src/index";

const BREAD = `---
title: Country bread
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}. // keep it cold

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake for ~{30min}.
`;

const compiled = compile(getAST(BREAD));
const settings = {
	miseEnPlace: "upfront",
	rests: "longest",
	comments: "hide",
	nutritionBasis: "total",
	bakersMathOnly: true,
	stepQuantities: "hide",
} as const;
const input = prepareViews(compiled, settings, { lang: "fr" });

describe("the views registry", () => {
	it("describes every format once, and lists every described format", () => {
		expect([...FORMATS].sort()).toEqual(Object.keys(FORMAT_DEFINITIONS).sort());
		for (const format of FORMATS) {
			const { display, language } = FORMAT_DEFINITIONS[format];
			if (display === "code") expect(language, format).toBeTruthy();
		}
	});

	it("names every format in every language", () => {
		for (const lang of ["en", "fr"]) {
			const names = getDictionary(lang).renderer.formats;
			for (const format of FORMATS) {
				expect(names[format], `${format} in ${lang}`).toBeString();
			}
		}
	});

	it("lists each view once, with formats and settings that exist", () => {
		// Read from the registry, not listed here: a view added there needs no
		// edit in this test.
		const ids = views.map((view) => view.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain("recipe");
		expect(ids).toContain("workPlan");
		for (const view of views) {
			expect(view.kind).toBe("renderer");
			// Every view can be shown on screen: the editor's panel and the
			// playground's preview render it in html.
			expect(view.formats).toContain("html");
			for (const format of view.formats) expect(FORMATS).toContain(format);
			for (const key of view.honors)
				expect(Object.keys(VIEW_SETTINGS)).toContain(key);
		}
	});

	it("finds a view by its id", () => {
		expect(getView("workPlan")?.id).toBe("workPlan");
		expect(getView("gantt")).toBeUndefined();
	});
});

describe("render", () => {
	const options = {
		...viewSettingsToRendererOptions(input.settings),
		lang: "fr",
	};

	it("writes the recipe as the functions of each format do", () => {
		expect(render("recipe", input, "html")).toBe(toHTML(compiled, options));
		expect(render("recipe", input, "markdown")).toBe(
			toMarkdown(compiled, options),
		);
		expect(render("recipe", input, "print")).toBe(
			toPrintHTML(compiled, options),
		);
	});

	it("writes the work plan as the functions of each format do", () => {
		const sheet = input.runSheet!;
		const sheetOptions = { lang: "fr", comments: "hide" } as const;
		expect(render("workPlan", input, "html")).toBe(
			runSheetToHTML(sheet, compiled, sheetOptions),
		);
		expect(render("workPlan", input, "markdown")).toBe(
			runSheetToMarkdown(sheet, compiled, sheetOptions),
		);
		expect(render("workPlan", input, "text")).toBe(
			runSheetToText(sheet, compiled, sheetOptions),
		);
		expect(render("workPlan", input, "print")).toBe(
			runSheetToPrintHTML(sheet, compiled, sheetOptions),
		);
	});

	it("passes the surface options on, the language of the surface first", () => {
		const html = render("recipe", input, "html", {
			lang: "en",
			interactiveNutrition: true,
		});
		expect(html).toBe(
			toHTML(compiled, { ...options, lang: "en", interactiveNutrition: true }),
		);
	});

	it("says so for a recipe with nothing to plan, and is null with no tasks at all", () => {
		const empty = compile(getAST("---\ntitle: Note\n---\n"));
		expect(render("workPlan", prepareViews(empty), "text")).toContain(
			"Nothing to plan.",
		);
		const noTasks = { ...empty, tasks: undefined, schedule: undefined };
		expect(render("workPlan", prepareViews(noTasks), "html")).toBeNull();
	});

	it("refuses a format the view does not offer, and an unknown view", () => {
		expect(() => render("recipe", input, "text")).toThrow(RangeError);
		// @ts-expect-error: not a view of the registry
		expect(() => render("gantt", input, "html")).toThrow(RangeError);
	});
});

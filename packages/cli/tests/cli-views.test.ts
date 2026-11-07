import { describe, expect, it } from "bun:test";
import { getView, views } from "@gram-lang/renderer";
import {
	CLI_VIEW_NAMES,
	EXPORT_EXTENSIONS,
	EXPORT_FORMATS,
	PLAN_SHEET_FORMATS,
	cliFormatsOf,
	cliViewName,
	isPlanned,
	resolveCliFormat,
	viewByCliName,
} from "../src/core/cli-views";
import { GramCLIError } from "../src/errors";
import { PLAN_FORMATS } from "../src/services/planner";

const recipe = getView("recipe")!;
const runSheet = getView("runSheet")!;

describe("the views on the command line", () => {
	it("names every view of the registry in kebab case, in its order", () => {
		expect(cliViewName("runSheet")).toBe("run-sheet");
		expect(CLI_VIEW_NAMES).toEqual(views.map((v) => cliViewName(v.id)));
		expect(CLI_VIEW_NAMES.slice(0, 2)).toEqual(["recipe", "run-sheet"]);
	});

	it("finds a view by that name, and refuses one it does not know with the list", () => {
		expect(viewByCliName("run-sheet")).toBe(runSheet);
		expect(() => viewByCliName("gantt")).toThrow(GramCLIError);
		expect(() => viewByCliName("gantt")).toThrow(/recipe, run-sheet/);
	});

	it("knows which views are laid out in time", () => {
		expect(isPlanned(runSheet)).toBe(true);
		expect(isPlanned(recipe)).toBe(false);
	});
});

describe("formats", () => {
	it("offers each view the formats it has, in the command's words", () => {
		expect(cliFormatsOf(recipe, EXPORT_FORMATS)).toEqual([
			"md",
			"html",
			"text",
		]);
		expect(cliFormatsOf(runSheet, EXPORT_FORMATS)).toEqual([
			"md",
			"html",
			"text",
		]);
		expect(cliFormatsOf(runSheet, PLAN_SHEET_FORMATS)).toEqual([
			"text",
			"md",
			"html",
		]);
	});

	it("maps a command's word to the renderer's format", () => {
		expect(resolveCliFormat(recipe, "html", EXPORT_FORMATS)).toBe("print");
		expect(resolveCliFormat(runSheet, "html", PLAN_SHEET_FORMATS)).toBe("html");
		expect(resolveCliFormat(runSheet, "text", EXPORT_FORMATS)).toBe("text");
	});

	it("refuses a format the view does not have, and says what it has", () => {
		// Every view has every format today: a view without text stands in.
		const noText = {
			...recipe,
			id: "notes",
			formats: ["html", "markdown", "print"],
		} as const;
		expect(() => resolveCliFormat(noText, "text", EXPORT_FORMATS)).toThrow(
			'The notes view has no "text" format. Expected one of: md, html.',
		);
		expect(() => resolveCliFormat(recipe, "pdf", EXPORT_FORMATS)).toThrow(
			'Unknown --format value "pdf". Expected one of: md, html, text.',
		);
	});

	it("says so when a view has none of the formats a command writes", () => {
		// A view on screen only: gram export's html is the print layout.
		const screenOnly = { ...recipe, id: "notes", formats: ["html"] } as const;
		expect(cliFormatsOf(screenOnly, EXPORT_FORMATS)).toEqual([]);
		expect(() => resolveCliFormat(screenOnly, "html", EXPORT_FORMATS)).toThrow(
			"The notes view has none of the formats this command writes.",
		);
	});

	it("gives every export format a file extension", () => {
		for (const name of Object.keys(EXPORT_FORMATS)) {
			expect(EXPORT_EXTENSIONS[name]).toBeString();
		}
	});

	it("keeps the formats of gram plan as released, json last", () => {
		expect(PLAN_FORMATS).toEqual(["text", "md", "html", "json"]);
	});
});

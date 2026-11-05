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
const workPlan = getView("workPlan")!;

describe("the views on the command line", () => {
	it("names every view of the registry in kebab case, in its order", () => {
		expect(cliViewName("workPlan")).toBe("work-plan");
		expect(CLI_VIEW_NAMES).toEqual(views.map((v) => cliViewName(v.id)));
		expect(CLI_VIEW_NAMES.slice(0, 2)).toEqual(["recipe", "work-plan"]);
	});

	it("finds a view by that name, and refuses one it does not know with the list", () => {
		expect(viewByCliName("work-plan")).toBe(workPlan);
		expect(() => viewByCliName("gantt")).toThrow(GramCLIError);
		expect(() => viewByCliName("gantt")).toThrow(/recipe, work-plan/);
	});

	it("knows which views are laid out in time", () => {
		expect(isPlanned(workPlan)).toBe(true);
		expect(isPlanned(recipe)).toBe(false);
	});
});

describe("formats", () => {
	it("offers each view the formats it has, in the command's words", () => {
		expect(cliFormatsOf(recipe, EXPORT_FORMATS)).toEqual(["md", "html"]);
		expect(cliFormatsOf(workPlan, EXPORT_FORMATS)).toEqual([
			"md",
			"html",
			"text",
		]);
		expect(cliFormatsOf(workPlan, PLAN_SHEET_FORMATS)).toEqual([
			"text",
			"md",
			"html",
		]);
	});

	it("maps a command's word to the renderer's format", () => {
		expect(resolveCliFormat(recipe, "html", EXPORT_FORMATS)).toBe("print");
		expect(resolveCliFormat(workPlan, "html", PLAN_SHEET_FORMATS)).toBe("html");
		expect(resolveCliFormat(workPlan, "text", EXPORT_FORMATS)).toBe("text");
	});

	it("refuses a format the view does not have, and says what it has", () => {
		expect(() => resolveCliFormat(recipe, "text", EXPORT_FORMATS)).toThrow(
			'The recipe view has no "text" format. Expected one of: md, html.',
		);
		expect(() => resolveCliFormat(recipe, "pdf", EXPORT_FORMATS)).toThrow(
			'Unknown --format value "pdf". Expected one of: md, html.',
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

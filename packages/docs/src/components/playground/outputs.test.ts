import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { outputs, prepareViews } from "@gram-lang/renderer";
import {
	formatFor,
	outputById,
	inspectorOptions,
	paneOf,
	renderOutput,
	screenFormatsOf,
	viewTabs,
} from "./outputs";

const SOURCE = `---
title: Tart
---

## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}.
`;

describe("the view tabs and the inspector menu", () => {
	it("puts the views in the tabs and the inspectors apart, each output once", () => {
		const t = getDictionary("en");
		const tabs = viewTabs(t);
		const menu = inspectorOptions(t);
		// Read from the registry, not listed here: a view added there needs no
		// edit in this test.
		expect(tabs.map((o) => o.value)).toEqual(
			outputs.filter((o) => o.kind === "renderer").map((o) => o.id),
		);
		expect(menu.map((o) => o.value)).toEqual(
			outputs.filter((o) => o.kind === "inspector").map((o) => o.id),
		);
		expect([...tabs, ...menu].map((o) => o.value)).toEqual(
			outputs.map((o) => o.id),
		);
		expect(tabs).toContainEqual({ label: "Recipe", value: "recipe" });
		expect(tabs).toContainEqual({ label: "Work plan", value: "workPlan" });
	});

	it("names every output, in every language", () => {
		for (const lang of ["en", "fr"] as const) {
			const names = getDictionary(lang).renderer.outputs;
			for (const output of outputs) expect(names[output.id]).toBeTruthy();
		}
	});

	it("names them in the playground's language", () => {
		const t = getDictionary("fr");
		expect(viewTabs(t)[0]?.label).toBe("Recette");
		expect(inspectorOptions(t).at(-1)?.label).toBe("Arbre JSON");
	});
});

describe("formats", () => {
	it("offers the on-screen formats of a view, never print", () => {
		expect(screenFormatsOf(outputById("recipe"))).toEqual(["html", "markdown"]);
		expect(screenFormatsOf(outputById("workPlan"))).toEqual([
			"html",
			"markdown",
			"text",
		]);
		expect(screenFormatsOf(outputById("json"))).toEqual([]);
	});

	it("keeps the chosen format when the next view has it, else takes its first", () => {
		expect(formatFor(outputById("recipe"), "markdown")).toBe("markdown");
		expect(formatFor(outputById("recipe"), "text")).toBe("html");
	});
});

describe("panes", () => {
	it("reads how to show an output from its descriptor", () => {
		expect(paneOf(outputById("recipe"), "html")).toEqual({ type: "html" });
		expect(paneOf(outputById("recipe"), "markdown")).toEqual({
			type: "code",
			language: "markdown",
		});
		expect(paneOf(outputById("workPlan"), "text")).toEqual({
			type: "code",
			language: "text",
		});
		expect(paneOf(outputById("ast"), "html")).toEqual({
			type: "code",
			language: "scheme",
		});
		expect(paneOf(outputById("json-tree"), "html")).toEqual({ type: "tree" });
	});
});

describe("renderOutput", () => {
	const ast = getAST(SOURCE);
	const recipe = compile(ast);
	const input = prepareViews(recipe);
	const artifacts = {
		composedAst: ast,
		analyzed: recipe as never,
		compiled: recipe,
	};

	it("writes every output of the registry in each of its formats", () => {
		for (const output of outputs) {
			const formats = screenFormatsOf(output);
			for (const format of formats.length > 0 ? formats : (["html"] as const)) {
				const text = renderOutput(output, format, input, artifacts, {});
				expect(typeof text, `${output.id} ${format}`).toBe("string");
			}
		}
	});

	it("gives the JSON of the recipe to the JSON inspector", () => {
		const json = renderOutput(
			outputById("json")!,
			"html",
			input,
			artifacts,
			{},
		);
		expect(JSON.parse(json ?? "").title).toBe("Tart");
	});

	it("is null for an inspector whose stage is missing", () => {
		expect(renderOutput(outputById("ast")!, "html", input, {}, {})).toBeNull();
	});
});

import { describe, expect, it } from "bun:test";
import { type IngredientData, analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import {
	type RenderableCompilationResult,
	type TextStyle,
	type ViewSettings,
	prepareViews,
	render,
} from "../src/index";

// The text format of the recipe view: what a terminal shows (`gram view`) and
// `gram export --format text` writes. The contract test already renders it
// for every fixture and setting; these check what it says.

const database: Record<string, IngredientData> = {
	flour: {
		name: "Flour",
		nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
	},
	milk: {
		name: "Milk",
		physical: { density: 1.03 },
	},
};

const SOURCE = `---
title: Country bread
portions: 2
---

## Dough

// Use a strong flour.

[Mix] Mix @flour{500g} with @milk{250ml} in a #bowl{}, knead ~{20min}. // keep it cold

[Rise] Let it rise ~_{8-16h}.

## Garnish

Squeeze the @juice{150ml}<@lemon{1}(cut in half) over the bread.
`;

const recipe = (
	source = SOURCE,
	extra: Record<string, IngredientData> = {},
): RenderableCompilationResult =>
	analyze(compile(getAST(source)), { ...database, ...extra }).result;

const text = (
	settings: Partial<ViewSettings> = {},
	surface: { lang?: string; width?: number; textStyle?: TextStyle } = {},
	data = recipe(),
): string => {
	const out = render("recipe", prepareViews(data, settings), "text", surface);
	if (out === null) throw new Error("no text");
	return out;
};

describe("recipe view, text format", () => {
	it("opens on a box with the title, the servings and the times", () => {
		const lines = text().split("\n");
		expect(lines[0]).toStartWith("┌─ Country bread ");
		expect(lines[0]).toEndWith(" 2 servings ─┐");
		expect(lines.slice(1, 3).join("\n")).toContain("Total Time: ");
		expect(lines.find((l) => l.startsWith("└"))).toBe(`└${"─".repeat(76)}┘`);
		// Every line of the box is as wide as the box.
		const box = lines.slice(0, lines.findIndex((l) => l.startsWith("└")) + 1);
		for (const line of box) expect(line.length).toBe(78);
	});

	it("draws a plain box for a recipe with no title", () => {
		const out = text({}, {}, recipe("## A\n\nMix @flour{1g}.\n"));
		const top = out.split("\n")[0] ?? "";
		expect(top).toMatch(/^┌─+┐$/);
		expect(top.length).toBe(78);
	});

	it("draws the box and the rules at the width the surface gives", () => {
		const lines = text({}, { width: 60 }).split("\n");
		expect(lines[0]?.length).toBe(60);
		expect(lines.find((l) => l.startsWith("─── Dough"))?.length).toBe(60);
	});

	it("lists the shopping, then each section: its ingredients, then numbered steps", () => {
		const out = text();
		expect(out).toContain("SHOPPING LIST\n");
		expect(out).toContain("COOKWARE\n  bowl");
		expect(out).toMatch(/─── Dough ─+\n {2}• flour +500 g\n/);
		expect(out).toContain(
			" 1. [Mix] Mix flour (500 g) with milk (250 ml, ≈257.5 g) in a bowl, knead 20 min. [1]",
		);
		expect(out).toContain(" 2. [Rise] Let it rise 8-16 h.");
	});

	it("puts the parts of a composite ingredient under it", () => {
		expect(text()).toMatch(/• lemon, cut in half\n {4}↳ juice +150 ml/);
	});

	it("writes an estimated mass with ≈", () => {
		expect(text()).toMatch(/• milk +250 ml, ≈257\.5 g/);
	});

	it("gathers the comments at the end of a line as notes, and hides them all on request", () => {
		const shown = text();
		expect(shown).toContain("Use a strong flour.");
		expect(shown).toContain("NOTES\n  [1] keep it cold");
		const hidden = text({ comments: "hide" });
		expect(hidden).not.toContain("Use a strong flour.");
		expect(hidden).not.toContain("NOTES");
		expect(hidden).not.toContain("[1]");
	});

	it("says so under the nutrition when a mass was estimated", () => {
		const estimated = recipe(
			"---\ntitle: Porridge\n---\n\n## A\n\nAdd @oats{1 cup}.\n",
			{
				oats: {
					name: "Oats",
					physical: { density: 0.4 },
					nutrition: { calories: 389, protein: 17, carbs: 66, fat: 7 },
				},
			},
		);
		expect(text({}, {}, estimated)).toContain("\n  * estimated values");
		expect(text({}, { lang: "fr" }, estimated)).toContain("* valeurs estimées");
		const exact = recipe("---\ntitle: T\n---\n\n## A\n\nAdd @flour{100g}.\n");
		expect(text({}, {}, exact)).not.toContain("estimated values");
	});

	it("leaves the quantities out of the steps on request, never out of the lists", () => {
		const out = text({ stepQuantities: "hide" });
		expect(out).toContain("[Mix] Mix flour with milk in a bowl");
		expect(out).toMatch(/• flour +500 g/);
	});

	it("writes the recipe as it is: no markup, no escaping", () => {
		const out = text(
			{},
			{},
			recipe("---\ntitle: Fish & chips <3\n---\n\n## A\n\nMix @flour{1g}.\n"),
		);
		expect(out).toContain("Fish & chips <3");
		expect(out).not.toContain("&amp;");
		expect(out).not.toContain("**");
	});

	it("speaks the reader's language", () => {
		const out = text({}, { lang: "fr" });
		expect(out).toContain(" 2 parts ─┐");
		expect(out).toContain("LISTE DE COURSES");
		expect(out).toContain("MATÉRIEL");
		expect(out).toContain("Temps Total : ");
		expect(out).toContain("NUTRITION (PAR PORTION)");
	});

	it("sets parts apart with the surface's style, and is plain without one", () => {
		const tag =
			(name: string) =>
			(s: string): string =>
				`<${name}>${s}</${name}>`;
		const out = text(
			{},
			{
				textStyle: {
					title: tag("t"),
					heading: tag("h"),
					ingredient: tag("i"),
					cookware: tag("c"),
					timer: tag("tm"),
					action: tag("a"),
				},
			},
		);
		expect(out).toContain("<h>SHOPPING LIST</h>");
		expect(out).toContain("<a>[Mix]</a> Mix <i>flour</i> (500 g)");
		expect(out).toContain("in a <c>bowl</c>, knead <tm>20 min</tm>.");
		// The quantities still line up: the name is measured before it is styled.
		expect(out).toMatch(/• <i>flour<\/i> {16}500 g/);
		expect(text()).not.toContain("<");
	});
});

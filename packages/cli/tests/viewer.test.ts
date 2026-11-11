import { afterEach, describe, expect, it } from "bun:test";
import { basename } from "node:path";
import { viewRecipe } from "../src/services/viewer";
import { cleanupTmpFile, makeDb, writeTmpFile } from "./helpers";

describe("viewRecipe", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop() as string);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	const text = async (
		source: string,
		options: Parameters<typeof viewRecipe>[1] = {},
	) => (await viewRecipe(await tmp(source), options)).text;

	it("writes the title, the portions, and the sections with their steps", async () => {
		const out = await text(
			'---\ntitle: "Crepes"\nportions: 4\n---\n## Batter\n[Mix] Combine the @flour{200g} and @eggs{2}.\n',
		);
		const lines = out.split("\n");
		expect(lines[0]).toStartWith("┌─ Crepes ");
		// `portions` is the canonical key: it used to be read from a field the
		// language doesn't have, so the header never showed a serving count.
		expect(lines[0]).toContain(" 4 portions ");
		expect(out).toContain("─── Batter ");
		expect(out).toContain("1. [Mix] Combine the flour (200 g) and eggs (2).");
	});

	it("shows no serving count when the recipe declares none", async () => {
		const out = await text("## Batter\n[Mix] Add @flour{200g}.\n");
		expect(out).not.toContain("servings");
	});

	it("calls a recipe with no title by its file name", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const { text: out } = await viewRecipe(path);
		expect(out.split("\n")[0]).toStartWith(`┌─ ${basename(path, ".gram")} `);
	});

	it("builds the shopping list without a database", async () => {
		const out = await text("## Prep\n[Mix] Add @flour{200g}.\n");
		expect(out).toMatch(/SHOPPING LIST\n {2}flour +200 g\n/);
	});

	it("uses the database display name in the shopping list when analyzed, and the recipe's own name in the sections", async () => {
		const db = makeDb({
			flour: { name: "Wheat Flour", physical: { density: 0.59 } },
		});
		const out = await text("## Prep\n[Mix] Add @flour{200g}.\n", { db });
		expect(out).toMatch(/SHOPPING LIST\n {2}Wheat Flour +200 g/);
		expect(out).toMatch(/• flour +200 g/);
	});

	it("keeps the recipe's own (non-English) name in the shopping list even with an English-only database", async () => {
		const db = makeDb({ flour: { aliases: ["farine"] } });
		const out = await text("## Prep\n[Mix] Add @farine{200g}.\n", { db });
		expect(out).toMatch(/SHOPPING LIST\n {2}farine +200 g/);
	});

	it("groups composite ingredient children under their parent with a MAX-rule parent quantity", async () => {
		const out = await text(
			"## Prep\n[Separate] Crack the @egg yolks{2}<@eggs{2} and @egg whites{4}<@eggs{4}.\n",
		);
		// The shopping list buys the larger quantity (4), not the sum (6) or the first (2).
		expect(out).toMatch(/SHOPPING LIST\n {2}eggs +4\n/);
		expect(out).toMatch(/• eggs\n {4}↳ egg yolks +2\n {4}↳ egg whites +4\n/);
	});

	it("computes nutrition and missingIngredients only when a database is analyzed", async () => {
		const db = makeDb({
			flour: {
				physical: { density: 0.59 },
				nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
			},
		});
		const path = await tmp(
			"## Prep\n[Mix] Add @flour{200g} and @unknown-thing{10g}.\n",
		);
		const viewed = await viewRecipe(path, { db });
		expect(viewed.text).toContain("NUTRITION");
		expect(viewed.missingIngredients).toContain("unknown-thing");
	});

	it("has no nutrition and no missing ingredients without a database", async () => {
		const viewed = await viewRecipe(
			await tmp("## Prep\n[Mix] Add @flour{200g}.\n"),
		);
		expect(viewed.text).not.toContain("NUTRITION");
		expect(viewed.missingIngredients).toEqual([]);
	});

	it("reports the times of the recipe in the header", async () => {
		const viewed = await viewRecipe(
			await tmp("## Prep ~{10min}\n[Mix] Add @flour{200g}. ~_{5min}\n"),
		);
		expect(viewed.text).toContain("Total Time: ");
		expect(viewed.totalMinutes).toBeGreaterThan(0);
	});

	it("scales quantities when a scaleFactor is provided", async () => {
		const out = await text("## Prep\n[Mix] Add @flour{200g}.\n", {
			scaleFactor: 2,
		});
		expect(out).toMatch(/• flour +400 g/);
	});

	it("keeps each timer's own unit in the step text", async () => {
		const out = await text(
			"## T\n\nA ~{20s} B ~{20 s} C ~{90s} D ~{2min} E ~{1h}\n",
		);
		expect(out).toContain("20 s");
		expect(out).toContain("90 s");
		expect(out).toContain("2 min");
		expect(out).toContain("1 h");
		expect(out).not.toContain("20 min");
		expect(out).not.toContain("1 min");
	});

	it("shows the resting time as the idle time", async () => {
		const out = await text(
			"## T\n\nMix @flour{200g}. ~_{30min}\n\nBake it ~{10min}.\n",
		);
		expect(out).toMatch(/Idle Time: [1-9]/);
	});

	it("colors the parts of the recipe through the style it is given", async () => {
		const out = await text("## T\n\n[Mix] Add @flour{200g} in a #bowl{}.\n", {
			textStyle: {
				ingredient: (s) => `<i>${s}</i>`,
				cookware: (s) => `<c>${s}</c>`,
			},
		});
		expect(out).toContain("Add <i>flour</i> (200 g) in a <c>bowl</c>.");
	});
});

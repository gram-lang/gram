import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { lintDb, applyLintDecisions } from "../src/services/db-linter";
import { makeDb } from "./helpers";
import type { GramConfig, LintResult } from "../src/types";

const config = {} as GramConfig;

function jsonModel(body: unknown): LanguageModel {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text", text: JSON.stringify(body) }],
			finishReason: "stop",
			usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
			warnings: [],
		}),
	}) as unknown as LanguageModel;
}

describe("lintDb", () => {
	it("passes through a valid plural issue", async () => {
		const db = makeDb({ oeuf: {}, oeufs: {} });
		const model = jsonModel({
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					keepId: "oeuf",
					aliasIds: ["oeufs"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]?.type).toBe("plural");
		expect(result.issues[0]?.suggestion).toEqual({
			keepId: "oeuf",
			aliasIds: ["oeufs"],
		});
	});

	it("rejects an issue referencing an id that isn't in the database", async () => {
		const db = makeDb({ oeuf: {} });
		const model = jsonModel({
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "ghost"],
					keepId: "oeuf",
					aliasIds: ["ghost"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues).toHaveLength(0);
	});

	it("rejects an issue whose keepId isn't in the database", async () => {
		const db = makeDb({ oeuf: {}, oeufs: {} });
		const model = jsonModel({
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					keepId: "not-a-key",
					aliasIds: ["oeufs"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues).toHaveLength(0);
	});

	it("flags hasNutritionConflict when a duplicate issue's ingredients both have nutrition data", async () => {
		const db = makeDb({
			tomate: { nutrition: { calories: 18, protein: 1, carbs: 4, fat: 0 } },
			tomato: { nutrition: { calories: 20, protein: 1, carbs: 4, fat: 0 } },
		});
		const model = jsonModel({
			issues: [
				{
					type: "duplicate",
					ids: ["tomate", "tomato"],
					keepId: "tomato",
					aliasIds: ["tomate"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues[0]?.hasNutritionConflict).toBe(true);
	});

	it("does not flag hasNutritionConflict for a plural issue, even if both have nutrition", async () => {
		const db = makeDb({
			oeuf: { nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 } },
			oeufs: { nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 } },
		});
		const model = jsonModel({
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					keepId: "oeuf",
					aliasIds: ["oeufs"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues[0]?.hasNutritionConflict).toBe(false);
	});

	it("deduplicates the same issue reported by multiple batches", async () => {
		const entries: Record<string, object> = {};
		for (let i = 0; i < 150; i++) entries[`ingredient-${i}`] = {};
		entries.oeuf = {};
		entries.oeufs = {};
		const db = makeDb(entries);
		const model = jsonModel({
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					keepId: "oeuf",
					aliasIds: ["oeufs"],
				},
			],
		});
		const result = await lintDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.issues).toHaveLength(1);
	});
});

describe("applyLintDecisions", () => {
	let dir: string;

	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	async function makeDbFile(yaml: string): Promise<string> {
		dir = await mkdtemp(join(tmpdir(), "gram-linter-"));
		const dbPath = join(dir, "ingredients.yaml");
		await Bun.write(dbPath, yaml);
		return dbPath;
	}

	it("merges a plural alias into the keep ingredient and removes the alias key", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  oeuf:\n    name: Oeuf\n    aliases: []\n  oeufs:\n    name: Oeufs\n    aliases: [ovos]\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					suggestion: { keepId: "oeuf", aliasIds: ["oeufs"] },
					hasNutritionConflict: false,
				},
			],
		};
		const summary = await applyLintDecisions(result, [
			{ issueIndex: 0, action: "apply" },
		]);
		expect(summary).toEqual({ applied: 1, skipped: 0 });
		const content = await readFile(dbPath, "utf-8");
		expect(content).not.toContain("oeufs:");
		expect(content).toContain("oeuf:");
		// the alias's own former alias ("ovos") is carried over to the keep ingredient
		expect(content).toContain("ovos");
	});

	it("merges a duplicate pair, keeping the target's own nutrition by default", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  tomato:\n    name: Tomato\n    nutrition:\n      calories: 20\n      protein: 1\n      carbs: 4\n      fat: 0\n  tomate:\n    name: Tomate\n    nutrition:\n      calories: 18\n      protein: 1\n      carbs: 4\n      fat: 0\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "duplicate",
					ids: ["tomate", "tomato"],
					suggestion: { keepId: "tomato", aliasIds: ["tomate"] },
					hasNutritionConflict: true,
				},
			],
		};
		await applyLintDecisions(result, [{ issueIndex: 0, action: "apply" }]);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("calories: 20"); // kept the target's own nutrition
		expect(content).not.toContain("calories: 18");
		expect(content).not.toContain("tomate:");
	});

	it("uses the source's nutrition when keepNutrition is 'source'", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  tomato:\n    name: Tomato\n    nutrition:\n      calories: 20\n      protein: 1\n      carbs: 4\n      fat: 0\n  tomate:\n    name: Tomate\n    nutrition:\n      calories: 18\n      protein: 1\n      carbs: 4\n      fat: 0\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "duplicate",
					ids: ["tomate", "tomato"],
					suggestion: { keepId: "tomato", aliasIds: ["tomate"] },
					hasNutritionConflict: true,
				},
			],
		};
		await applyLintDecisions(result, [
			{ issueIndex: 0, action: "apply", keepNutrition: "source" },
		]);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("calories: 18");
		expect(content).not.toContain("calories: 20");
	});

	it("fills in physical data on the keep ingredient only if it's missing", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  tomato:\n    name: Tomato\n  tomate:\n    name: Tomate\n    physical:\n      density: 0.95\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "duplicate",
					ids: ["tomate", "tomato"],
					suggestion: { keepId: "tomato", aliasIds: ["tomate"] },
					hasNutritionConflict: false,
				},
			],
		};
		await applyLintDecisions(result, [{ issueIndex: 0, action: "apply" }]);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.95");
	});

	it("overrides the keepId via the decision for a duplicate issue", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  tomato:\n    name: Tomato\n  tomate:\n    name: Tomate\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "duplicate",
					ids: ["tomate", "tomato"],
					suggestion: { keepId: "tomato", aliasIds: ["tomate"] },
					hasNutritionConflict: false,
				},
			],
		};
		await applyLintDecisions(result, [
			{ issueIndex: 0, action: "apply", keepId: "tomate" },
		]);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("tomate:");
		expect(content).not.toContain("tomato:");
	});

	it("counts a skipped decision without merging the two ingredients", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  oeuf:\n    name: Oeuf\n  oeufs:\n    name: Oeufs\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "plural",
					ids: ["oeuf", "oeufs"],
					suggestion: { keepId: "oeuf", aliasIds: ["oeufs"] },
					hasNutritionConflict: false,
				},
			],
		};
		const summary = await applyLintDecisions(result, [
			{ issueIndex: 0, action: "skip" },
		]);
		expect(summary).toEqual({ applied: 0, skipped: 1 });
		const content = await readFile(dbPath, "utf-8");
		// Both keys still exist independently — skip must not perform the merge
		expect(content).toContain("oeuf:");
		expect(content).toContain("oeufs:");
	});

	it("sorts ingredient keys alphabetically after applying decisions", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  zucchini:\n    name: Zucchini\n  apple:\n    name: Apple\n  banane:\n    name: Banane\n  banana:\n    name: Banana\n",
		);
		const result: LintResult = {
			dbPath,
			issues: [
				{
					type: "plural",
					ids: ["banane", "banana"],
					suggestion: { keepId: "banana", aliasIds: ["banane"] },
					hasNutritionConflict: false,
				},
			],
		};
		await applyLintDecisions(result, [{ issueIndex: 0, action: "apply" }]);
		const content = await readFile(dbPath, "utf-8");
		const order = ["apple", "banana", "zucchini"].map((k) =>
			content.indexOf(`${k}:`),
		);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});
});

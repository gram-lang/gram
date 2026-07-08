import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { enrichDb } from "../src/services/db-enricher";
import { makeDb } from "./helpers";
import type { GramConfig } from "../src/types";

const config = {} as GramConfig;

function jsonModel(
	responses: Record<string, unknown> | Record<string, unknown>[],
): LanguageModel {
	let call = 0;
	const list = Array.isArray(responses) ? responses : [responses];
	return new MockLanguageModelV3({
		doGenerate: async () => {
			const body = list[Math.min(call, list.length - 1)];
			call++;
			return {
				content: [{ type: "text", text: JSON.stringify(body) }],
				finishReason: "stop",
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
				warnings: [],
			};
		},
	}) as unknown as LanguageModel;
}

function throwingModel(): LanguageModel {
	return new MockLanguageModelV3({
		doGenerate: async () => {
			throw new Error("network error");
		},
	}) as unknown as LanguageModel;
}

describe("enrichDb", () => {
	let dir: string;

	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	async function makeDir(): Promise<string> {
		dir = await mkdtemp(join(tmpdir(), "gram-enricher-"));
		return dir;
	}

	it("returns immediately with no model call when nothing needs enrichment", async () => {
		const db = makeDb({
			flour: {
				physical: { density: 0.59 },
				nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
				category: "Grains",
				tags: ["baking"],
			},
		});
		const model = jsonModel({ ingredients: [] });
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.totalIncomplete).toBe(0);
		expect(result.enriched).toEqual([]);
		expect(result.skipped).toEqual(["flour"]);
	});

	it("filters by field: 'density' only selects ingredients missing density", async () => {
		const db = makeDb({
			flour: { physical: { density: 0.59 } },
			sugar: {},
		});
		const model = jsonModel({ ingredients: [] });
		const result = await enrichDb(db, config, model, {
			field: "density",
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.totalIncomplete).toBe(1);
		expect(result.skipped).toEqual(["flour"]);
	});

	it("filters to a single ingredient when opts.ingredient is set", async () => {
		const db = makeDb({ flour: {}, sugar: {} });
		const model = jsonModel({ ingredients: [] });
		const result = await enrichDb(db, config, model, {
			ingredient: "sugar",
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.totalIncomplete).toBe(1);
		expect(result.skipped).toContain("flour");
	});

	it("records a successful enrichment and writes fill-only fields to disk without overwriting existing data", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(
			dbPath,
			"ingredients:\n  flour:\n    name: Flour\n    physical:\n      density: 0.59\n",
		);
		const db = makeDb({ flour: { physical: { density: 0.59 } } });
		const model = jsonModel({
			ingredients: [
				{
					key: "flour",
					density: 0.7, // should NOT overwrite the existing 0.59
					nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
					category: "Grains",
					tagSuggestions: ["baking"],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: dbPath,
		});
		expect(result.enriched).toHaveLength(1);
		expect(result.enriched[0]?.id).toBe("flour");
		expect(result.failed).toEqual([]);

		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.59"); // untouched
		expect(content).not.toContain("density: 0.7");
		expect(content).toContain("Grains");
		expect(content).toContain("calories: 364");
	});

	it("puts every ingredient in a batch into `failed` when the model call throws", async () => {
		const db = makeDb({ flour: {}, sugar: {} });
		const model = throwingModel();
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.failed.sort()).toEqual(["flour", "sugar"]);
		expect(result.enriched).toEqual([]);
	});

	it("matches an AI-returned key case-insensitively", async () => {
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [
				{
					key: "FLOUR",
					category: "Grains",
					tagSuggestions: [],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toHaveLength(1);
		expect(result.enriched[0]?.id).toBe("flour");
	});

	it("marks an ingredient as failed when the AI response omits it entirely", async () => {
		const db = makeDb({ flour: {}, sugar: {} });
		const model = jsonModel({
			ingredients: [{ key: "flour", category: "Grains", tagSuggestions: [] }],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched.map((e) => e.id)).toEqual(["flour"]);
		expect(result.failed).toContain("sugar");
	});

	it("marks a hallucinated key (not matching any requested ingredient) as failed", async () => {
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [
				{
					key: "not-a-real-ingredient",
					category: "Grains",
					tagSuggestions: [],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toEqual([]);
		expect(result.failed).toContain("not-a-real-ingredient");
		expect(result.failed).toContain("flour");
	});

	it("does not write to disk in dry-run mode", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(dbPath, "ingredients:\n  flour:\n    name: Flour\n");
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [{ key: "flour", category: "Grains", tagSuggestions: [] }],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: dbPath,
			dryRun: true,
		});
		expect(result.enriched).toHaveLength(1);
		const content = await readFile(dbPath, "utf-8");
		expect(content).not.toContain("Grains");
	});
});

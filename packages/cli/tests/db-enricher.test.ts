import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { enrichDb } from "../src/services/db-enricher";
import { makeDb } from "./helpers";
import { GramCLIError } from "../src/errors";
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
					category: "grains",
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
		expect(result.write).toEqual({ written: true, path: dbPath, count: 1 });

		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.59"); // untouched
		expect(content).not.toContain("density: 0.7");
		expect(content).toContain("grains");
		expect(content).toContain("calories: 364");
	});

	// Regression tests for the audit (2026-07-22, cli finding B-5): the write
	// was gated by silent guards (missing/unreadable file, non-map root) that
	// left `enriched` populated and the caller reporting "Updated <path>"
	// against a database that was never touched. `write` must now say so
	// explicitly instead of the caller inferring success from `!dryRun`.
	describe("write result (B-5)", () => {
		it("reports write.written=false with a reason when there's nothing to enrich", async () => {
			const db = makeDb({
				flour: {
					physical: { density: 0.59 },
					nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
					category: "grains",
					tags: ["baking"],
				},
			});
			const model = jsonModel({ ingredients: [] });
			const result = await enrichDb(db, config, model, {
				dbPathOverride: "/tmp/unused.yaml",
			});
			expect(result.write).toEqual({
				written: false,
				reason: "nothing to enrich",
			});
		});

		it("reports write.written=false with a reason when no ingredient produced a usable AI response", async () => {
			const db = makeDb({ flour: {} });
			const model = jsonModel({ ingredients: [] });
			const result = await enrichDb(db, config, model, {
				dbPathOverride: "/tmp/unused.yaml",
			});
			expect(result.enriched).toEqual([]);
			expect(result.write).toEqual({
				written: false,
				reason: "no ingredient produced a usable AI response",
			});
		});

		it("reports write.written=false with reason 'dry run' in dry-run mode, even though ingredients were enriched", async () => {
			const d = await makeDir();
			const dbPath = join(d, "ingredients.yaml");
			await Bun.write(dbPath, "ingredients:\n  flour:\n    name: Flour\n");
			const db = makeDb({ flour: {} });
			const model = jsonModel({
				ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
			});
			const result = await enrichDb(db, config, model, {
				dbPathOverride: dbPath,
				dryRun: true,
			});
			expect(result.enriched).toHaveLength(1);
			expect(result.write).toEqual({ written: false, reason: "dry run" });
		});

		it("throws instead of silently skipping the write when the database file doesn't exist", async () => {
			const db = makeDb({ flour: {} });
			const model = jsonModel({
				ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
			});
			await expect(
				enrichDb(db, config, model, {
					dbPathOverride: "/tmp/gram-enricher-does-not-exist.yaml",
				}),
			).rejects.toThrow(GramCLIError);
		});

		it("throws instead of silently skipping the write when the YAML root isn't a map (a sequence)", async () => {
			const d = await makeDir();
			const dbPath = join(d, "ingredients.yaml");
			await Bun.write(dbPath, "- not\n- a\n- map\n");
			const db = makeDb({ flour: {} });
			const model = jsonModel({
				ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
			});
			await expect(
				enrichDb(db, config, model, { dbPathOverride: dbPath }),
			).rejects.toThrow(GramCLIError);
		});
	});

	// Regression test for the audit (2026-07-22, i18n finding F-03): the AI
	// response schema used to accept any string for `category` — the prompt
	// said "examples like", not a closed list — so nothing stopped a
	// translated label ("Grains") or an invented variant ("Grains entiers")
	// from being written straight into `ingredients.yaml` as if it were a
	// stable, portable identity. `EnrichItemSchema.category` is now
	// `z.enum(CATEGORY_KEYS)`, so an old-style label fails validation for
	// that item specifically (ends up in `failed`, not silently accepted).
	it("rejects a translated category label from the AI response instead of writing it as data (F-03)", async () => {
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [{ key: "flour", category: "Grains", tagSuggestions: [] }],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toEqual([]);
		expect(result.failed).toContain("flour");
	});

	// Regression tests for the audit (2026-07-22, cli finding I-26): ingredient
	// names reaching this prompt can come from arbitrary sources (a synced
	// recipe, a merged third-party YAML file), and `generateObject`'s zod
	// schema was the only real backstop against a prompt-injected response —
	// but it constrained only shape (`z.number().positive()`), not
	// plausibility, so a prompt-injected density of `1e9` or calories of
	// `50000` used to pass straight through. The schema now reuses
	// `db-validator.ts`'s own bounds (density ≤ 2.5, calories ≤ 900).
	it("rejects an implausible density from the AI response (I-26)", async () => {
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [
				{ key: "flour", density: 1e9, category: "grains", tagSuggestions: [] },
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toEqual([]);
		expect(result.failed).toContain("flour");
	});

	it("rejects implausible calories from the AI response (I-26)", async () => {
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [
				{
					key: "flour",
					nutrition: { calories: 50000, carbs: 76, protein: 10, fat: 1 },
					category: "grains",
					tagSuggestions: [],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toEqual([]);
		expect(result.failed).toContain("flour");
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
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(dbPath, "ingredients:\n  flour:\n    name: Flour\n");
		const db = makeDb({ flour: {} });
		const model = jsonModel({
			ingredients: [
				{
					key: "FLOUR",
					category: "grains",
					tagSuggestions: [],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: dbPath,
		});
		expect(result.enriched).toHaveLength(1);
		expect(result.enriched[0]?.id).toBe("flour");
	});

	it("marks an ingredient as failed when the AI response omits it entirely", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(
			dbPath,
			"ingredients:\n  flour:\n    name: Flour\n  sugar:\n    name: Sugar\n",
		);
		const db = makeDb({ flour: {}, sugar: {} });
		const model = jsonModel({
			ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: dbPath,
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
					category: "grains",
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
			ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: dbPath,
			dryRun: true,
		});
		expect(result.enriched).toHaveLength(1);
		const content = await readFile(dbPath, "utf-8");
		expect(content).not.toContain("grains");
	});
});

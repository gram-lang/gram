import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { enrichDb, applyEnrichDecisions } from "../src/services/db-enricher";
import { makeDb } from "./helpers";
import { GramCLIError } from "../src/errors";
import type { GramConfig, EnrichEntry, EnrichDecision } from "../src/types";

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

	// `enrichDb` is now generation-only (no disk access) — the writing
	// behavior this used to assert on lives in `applyEnrichDecisions` below.
	it("records a successful enrichment with the AI's proposed values", async () => {
		const db = makeDb({ flour: { physical: { density: 0.59 } } });
		const model = jsonModel({
			ingredients: [
				{
					key: "flour",
					density: 0.7,
					nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
					category: "grains",
					tagSuggestions: ["baking"],
				},
			],
		});
		const result = await enrichDb(db, config, model, {
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toHaveLength(1);
		expect(result.enriched[0]).toMatchObject({
			id: "flour",
			density: 0.7,
			category: "grains",
			tagSuggestions: ["baking"],
		});
		expect(result.failed).toEqual([]);
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
			dbPathOverride: "/tmp/unused.yaml",
		});
		expect(result.enriched).toHaveLength(1);
		expect(result.enriched[0]?.id).toBe("flour");
	});

	it("marks an ingredient as failed when the AI response omits it entirely", async () => {
		const db = makeDb({ flour: {}, sugar: {} });
		const model = jsonModel({
			ingredients: [{ key: "flour", category: "grains", tagSuggestions: [] }],
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
});

describe("applyEnrichDecisions", () => {
	let dir: string;

	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	async function makeDbFile(yaml: string): Promise<string> {
		dir = await mkdtemp(join(tmpdir(), "gram-enricher-"));
		const dbPath = join(dir, "ingredients.yaml");
		await Bun.write(dbPath, yaml);
		return dbPath;
	}

	function entry(overrides: Partial<EnrichEntry> = {}): EnrichEntry {
		return { id: "flour", name: "Flour", tagSuggestions: [], ...overrides };
	}

	it("returns written:false without touching disk when there are no decisions", async () => {
		const result = await applyEnrichDecisions(
			"/tmp/gram-enricher-does-not-exist.yaml",
			[],
			[],
		);
		expect(result).toEqual({ written: false, reason: "no changes to apply" });
	});

	it("throws instead of silently skipping the write when the database file doesn't exist", async () => {
		const enriched = [entry()];
		const decisions: EnrichDecision[] = [
			{ entryIndex: 0, physical: null, nutrition: null },
		];
		await expect(
			applyEnrichDecisions(
				"/tmp/gram-enricher-does-not-exist.yaml",
				enriched,
				decisions,
			),
		).rejects.toThrow(GramCLIError);
	});

	it("throws instead of silently skipping the write when the YAML root isn't a map (a sequence)", async () => {
		const dbPath = await makeDbFile("- not\n- a\n- map\n");
		const enriched = [entry()];
		const decisions: EnrichDecision[] = [
			{ entryIndex: 0, physical: null, nutrition: null },
		];
		await expect(
			applyEnrichDecisions(dbPath, enriched, decisions),
		).rejects.toThrow(GramCLIError);
	});

	it("writes fill-only physical/nutrition fields without overwriting existing data, tagging AI-sourced values [LLM]", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n    physical:\n      density: 0.59\n",
		);
		const enriched = [
			entry({
				density: 0.7, // should NOT overwrite the existing 0.59
				nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
				category: "grains",
				tagSuggestions: ["baking"],
			}),
		];
		const decisions: EnrichDecision[] = [
			{
				entryIndex: 0,
				physical: { action: "write", density: 0.7 },
				nutrition: {
					action: "write",
					nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
				},
			},
		];
		const write = await applyEnrichDecisions(dbPath, enriched, decisions);
		expect(write).toEqual({ written: true, path: dbPath, count: 1 });

		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.59"); // untouched, no [LLM] tag added to it
		expect(content).not.toContain("density: 0.7");
		expect(content).toContain("grains");
		expect(content).toContain("calories: 364 # [LLM]");
	});

	it("does not tag a user-edited value with [LLM]", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n",
		);
		const enriched = [entry({ density: 0.59 })]; // AI's original proposal
		const decisions: EnrichDecision[] = [
			{
				entryIndex: 0,
				physical: { action: "write", density: 0.65 }, // user edited it
				nutrition: null,
			},
		];
		await applyEnrichDecisions(dbPath, enriched, decisions);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.65");
		expect(content).not.toContain("[LLM]");
	});

	// Locks in the fix for a bug caught in review: tagging provenance at the
	// whole-block level made a physical block lose the AI tag on `density`
	// whenever only `unit_weight` was edited in the same review step.
	// Provenance is now computed per field by comparing the final value to
	// the AI's original one, not per action.
	it("preserves the [LLM] tag on an untouched field within a partially edited block", async () => {
		const dbPath = await makeDbFile("ingredients:\n  egg:\n    name: Egg\n");
		const enriched = [
			entry({ id: "egg", name: "Egg", density: 1.03, unit_weight: 50 }),
		];
		const decisions: EnrichDecision[] = [
			{
				entryIndex: 0,
				physical: { action: "write", density: 1.03, unit_weight: 55 }, // only unit_weight edited
				nutrition: null,
			},
		];
		await applyEnrichDecisions(dbPath, enriched, decisions);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 1.03 # [LLM]");
		expect(content).toContain("unit_weight: 55");
		expect(content).not.toMatch(/unit_weight: 55 #/);
	});

	it("writes only nutrition when physical is skipped and nutrition is accepted", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n",
		);
		const enriched = [
			entry({
				density: 0.59,
				nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
			}),
		];
		const decisions: EnrichDecision[] = [
			{
				entryIndex: 0,
				physical: { action: "skip" },
				nutrition: {
					action: "write",
					nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 },
				},
			},
		];
		const write = await applyEnrichDecisions(dbPath, enriched, decisions);
		expect(write).toMatchObject({ written: true, count: 1 });
		const content = await readFile(dbPath, "utf-8");
		expect(content).not.toContain("physical:");
		expect(content).toContain("calories: 364");
	});

	// Regression test for a bug caught in review: an earlier version of this
	// plan passed `decisions = []` for `--field tags`/`category` runs (which
	// never have physical/nutrition to review) and then sliced `enriched` to
	// match — an empty array either way, so `gram db enrich --field tags`
	// would have silently stopped writing anything at all. Category/tags-only
	// entries now still get a real decision (both groups `null`), so they're
	// visited and written exactly like today.
	it("writes category and tags unconditionally for entries with nothing to review (--field tags/category)", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n  sugar:\n    name: Sugar\n",
		);
		const enriched = [
			entry({ category: "grains", tagSuggestions: ["baking"] }),
			entry({ id: "sugar", name: "Sugar", tagSuggestions: ["sweetener"] }),
		];
		const decisions: EnrichDecision[] = enriched.map((_, entryIndex) => ({
			entryIndex,
			physical: null,
			nutrition: null,
		}));
		const write = await applyEnrichDecisions(dbPath, enriched, decisions);
		expect(write).toEqual({ written: true, path: dbPath, count: 2 });
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("grains");
		expect(content).toContain("sweetener");
		expect(content).not.toContain("[LLM]"); // category/tags never get a provenance tag
	});

	// Verified in practice against yaml@2.9.0: a flow-style map (`physical:
	// {}` on one line) silently drops any `.comment` set on its children at
	// stringify time unless `flow` is forced back to `false` first.
	it("writes correctly through a flow-style physical map without losing sibling content", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n    physical: {}\n    tags: [pantry]\n",
		);
		const enriched = [entry({ density: 0.59 })];
		const decisions: EnrichDecision[] = [
			{
				entryIndex: 0,
				physical: { action: "write", density: 0.59 },
				nutrition: null,
			},
		];
		await applyEnrichDecisions(dbPath, enriched, decisions);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("density: 0.59 # [LLM]");
		expect(content).toContain("pantry"); // sibling content untouched

		// Round-trip: the written YAML must still parse cleanly.
		const doc = parseDocument(content);
		expect(doc.errors).toEqual([]);
		const root = doc.toJSON();
		expect(root.ingredients.flour.physical.density).toBe(0.59);
	});

	// Ctrl+C during review must leave entries the user was never shown
	// completely untouched — not even category/tags, which write
	// unconditionally for entries that *do* have a decision.
	it("never writes any field for entries with no matching decision (Ctrl+C mid-review)", async () => {
		const dbPath = await makeDbFile(
			"ingredients:\n  flour:\n    name: Flour\n  sugar:\n    name: Sugar\n  salt:\n    name: Salt\n",
		);
		const enriched = [
			entry({ category: "grains", tagSuggestions: ["baking"] }),
			entry({
				id: "sugar",
				name: "Sugar",
				category: "sweeteners",
				tagSuggestions: ["sweetener"],
			}),
			entry({
				id: "salt",
				name: "Salt",
				category: "seasoning",
				tagSuggestions: ["seasoning"],
			}),
		];
		// Only the first entry got a decision — simulates the user canceling
		// (Ctrl+C) right after reviewing "flour".
		const decisions: EnrichDecision[] = [
			{ entryIndex: 0, physical: null, nutrition: null },
		];
		const write = await applyEnrichDecisions(dbPath, enriched, decisions);
		expect(write).toEqual({ written: true, path: dbPath, count: 1 });

		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("grains"); // flour: written
		expect(content).not.toContain("sweeteners"); // sugar: never visited
		expect(content).not.toContain("seasoning"); // salt: never visited
	});
});

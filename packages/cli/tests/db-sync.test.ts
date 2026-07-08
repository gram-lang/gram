import { describe, it, expect, afterEach } from "bun:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeIngredients, applySync } from "../src/services/db-sync";
import { writeTmpFile, cleanupTmpFile, makeDb } from "./helpers";
import type { GramConfig } from "../src/types";

const config = {} as GramConfig;

describe("analyzeIngredients", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("classifies an ingredient already in the database as an exact match", async () => {
		const db = makeDb({ flour: {} });
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const result = await analyzeIngredients([a], db, config, {
			dbPathOverride: "/tmp/unused-db.yaml",
		});
		expect(result.exactMatches).toEqual(["flour"]);
		expect(result.genuinelyNew).toEqual([]);
	});

	it("classifies a near-duplicate ingredient as a fuzzy match, not genuinely new", async () => {
		const db = makeDb({ tomato: {} });
		const a = await tmp("## Prep\n[Mix] Add @tomatoe{200g}.\n");
		const result = await analyzeIngredients([a], db, config, {
			dbPathOverride: "/tmp/unused-db.yaml",
		});
		expect(result.fuzzyMatches).toHaveLength(1);
		expect(result.fuzzyMatches[0]?.existingId).toBe("tomato");
		expect(result.genuinelyNew).toEqual([]);
	});

	it("classifies an ingredient with no close match as genuinely new", async () => {
		const db = makeDb({ flour: {} });
		const a = await tmp("## Prep\n[Mix] Add @saffron{1g}.\n");
		const result = await analyzeIngredients([a], db, config, {
			dbPathOverride: "/tmp/unused-db.yaml",
		});
		expect(result.genuinelyNew).toEqual(["saffron"]);
	});

	it("deduplicates the same ingredient id found across multiple files", async () => {
		const a = await tmp("## Prep\n[Mix] Add @saffron{1g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @saffron{2g}.\n");
		const result = await analyzeIngredients([a, b], {}, config, {
			dbPathOverride: "/tmp/unused-db.yaml",
		});
		expect(result.genuinelyNew).toEqual(["saffron"]);
		expect(result.allIds.size).toBe(1);
	});

	it("excludes intermediate (section-level ->&name) ingredients from the analysis", async () => {
		const a = await tmp(
			"## Pastry Dough ->&pastry dough{}\n[Mix] Add @flour{200g}.\n\n## Baking\n[Roll] Roll out the &pastry dough{}.\n",
		);
		const result = await analyzeIngredients([a], {}, config, {
			dbPathOverride: "/tmp/unused-db.yaml",
		});
		expect(result.allIds.has("pastry-dough")).toBe(false);
		expect(result.genuinelyNew).toEqual(["flour"]);
	});
});

describe("applySync", () => {
	let dir: string;

	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	async function makeDir(): Promise<string> {
		dir = await mkdtemp(join(tmpdir(), "gram-db-sync-"));
		return dir;
	}

	it("dry-run does not write to disk", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		const analysis = {
			dbPath,
			allIds: new Map([["saffron", "saffron"]]),
			exactMatches: [],
			fuzzyMatches: [],
			genuinelyNew: ["saffron"],
		};
		const decisions = new Map([["saffron", "new"]]);
		const result = await applySync(analysis, decisions, { dryRun: true });
		expect(result.newIngredients).toEqual(["saffron"]);
		await expect(readFile(dbPath, "utf-8")).rejects.toThrow();
	});

	it("creates a new database file with the decided new ingredients", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		const analysis = {
			dbPath,
			allIds: new Map([["saffron", "Saffron"]]),
			exactMatches: [],
			fuzzyMatches: [],
			genuinelyNew: ["saffron"],
		};
		const decisions = new Map([["saffron", "new"]]);
		await applySync(analysis, decisions, {});
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("saffron");
		expect(content).toContain("Saffron");
	});

	it("adds an alias to an existing ingredient instead of creating a new one", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(
			dbPath,
			"ingredients:\n  tomato:\n    name: Tomato\n    aliases: []\n",
		);
		const analysis = {
			dbPath,
			allIds: new Map([["tomatoe", "Tomatoe"]]),
			exactMatches: [],
			fuzzyMatches: [{ newId: "tomatoe", existingId: "tomato", score: 0.9 }],
			genuinelyNew: [],
		};
		const decisions = new Map([["tomatoe", "alias-of:tomato"]]);
		const result = await applySync(analysis, decisions, {});
		expect(result.aliasedIngredients).toEqual(["tomatoe"]);
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("tomatoe");
		expect(content).not.toContain("tomatoe:\n"); // not created as its own key
	});

	it("ignores decisions marked 'ignore'", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		const analysis = {
			dbPath,
			allIds: new Map([["saffron", "Saffron"]]),
			exactMatches: [],
			fuzzyMatches: [],
			genuinelyNew: ["saffron"],
		};
		const decisions = new Map([["saffron", "ignore"]]);
		const result = await applySync(analysis, decisions, {});
		expect(result.newIngredients).toEqual([]);
		expect(result.aliasedIngredients).toEqual([]);
	});

	it("preserves existing YAML comments when rewriting the database", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(
			dbPath,
			"ingredients:\n  # a staple\n  flour:\n    name: Flour\n",
		);
		const analysis = {
			dbPath,
			allIds: new Map([["saffron", "Saffron"]]),
			exactMatches: ["flour"],
			fuzzyMatches: [],
			genuinelyNew: ["saffron"],
		};
		const decisions = new Map([["saffron", "new"]]);
		await applySync(analysis, decisions, {});
		const content = await readFile(dbPath, "utf-8");
		expect(content).toContain("# a staple");
	});

	it("sorts ingredient keys alphabetically after adding new entries", async () => {
		const d = await makeDir();
		const dbPath = join(d, "ingredients.yaml");
		await Bun.write(dbPath, "ingredients:\n  zucchini:\n    name: Zucchini\n");
		const analysis = {
			dbPath,
			allIds: new Map([["apple", "Apple"]]),
			exactMatches: ["zucchini"],
			fuzzyMatches: [],
			genuinelyNew: ["apple"],
		};
		const decisions = new Map([["apple", "new"]]);
		await applySync(analysis, decisions, {});
		const content = await readFile(dbPath, "utf-8");
		expect(content.indexOf("apple")).toBeLessThan(content.indexOf("zucchini"));
	});
});

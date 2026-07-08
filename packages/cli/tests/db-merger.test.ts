import { describe, it, expect, afterEach } from "bun:test";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeMerge, loadSourceDb } from "../src/services/db-merger";
import type { IngredientData } from "@gram-lang/analyzer";

function db(
	entries: Record<string, Partial<IngredientData>>,
): Record<string, IngredientData> {
	return Object.fromEntries(
		Object.entries(entries).map(([id, data]) => [
			id,
			{ name: id, ...data } as IngredientData,
		]),
	);
}

describe("analyzeMerge", () => {
	it("adds source ingredients that don't exist locally", async () => {
		const local = db({ flour: {} });
		const source = db({ sugar: {} });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toAdd).toEqual([{ key: "sugar", entry: source.sugar! }]);
	});

	it("matches a source ingredient to a local one via alias", async () => {
		const local = db({ flour: { aliases: ["farine"] } });
		const source = db({ farine: { category: "Grains" } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toAdd).toHaveLength(0);
		expect(result.toEnrich).toHaveLength(1);
		expect(result.toEnrich[0]?.localKey).toBe("flour");
	});

	it("matches a source ingredient to a local one via name", async () => {
		const local = db({ flour: { name: "All-purpose flour" } });
		const source = db({
			"flour-alt-key": { name: "All-purpose flour", category: "Grains" },
		});
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toEnrich[0]?.localKey).toBe("flour");
	});

	it("fills in a missing scalar field (category) without conflict", async () => {
		const local = db({ flour: {} });
		const source = db({ flour: { category: "Grains" } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toEnrich).toHaveLength(1);
		expect(result.toEnrich[0]?.additions.category).toBe("Grains");
		expect(result.conflicts).toHaveLength(0);
	});

	it("reports a conflict when both sides define a differing scalar field", async () => {
		const local = db({ flour: { category: "Baking" } });
		const source = db({ flour: { category: "Grains" } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.conflicts).toEqual([
			{
				localKey: "flour",
				sourceKey: "flour",
				field: "category",
				localValue: "Baking",
				remoteValue: "Grains",
			},
		]);
	});

	it("does not conflict when both sides define the same scalar value", async () => {
		const local = db({ flour: { category: "Grains" } });
		const source = db({ flour: { category: "Grains" } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.conflicts).toHaveLength(0);
		expect(result.unchanged).toEqual(["flour"]);
	});

	it("fills in a missing object field (nutrition) without conflict", async () => {
		const local = db({ flour: {} });
		const source = db({
			flour: { nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 } },
		});
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toEnrich[0]?.additions.nutrition).toEqual(
			source.flour!.nutrition,
		);
	});

	it("reports a conflict when both sides define differing object fields deeply", async () => {
		const local = db({
			flour: { nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 } },
		});
		const source = db({
			flour: { nutrition: { calories: 300, protein: 10, carbs: 76, fat: 1 } },
		});
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0]?.field).toBe("nutrition");
	});

	it("unions aliases and tags without ever conflicting", async () => {
		const local = db({ flour: { aliases: ["farine"], tags: ["baking"] } });
		const source = db({ flour: { aliases: ["harina"], tags: ["gluten"] } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toEnrich[0]?.aliasAdditions).toEqual(["harina"]);
		expect(result.toEnrich[0]?.tagAdditions).toEqual(["gluten"]);
		expect(result.conflicts).toHaveLength(0);
	});

	it("does not re-add an alias/tag that's already present locally", async () => {
		const local = db({ flour: { aliases: ["farine"] } });
		const source = db({ flour: { aliases: ["farine"] } });
		const result = await analyzeMerge(local, source, "db.yaml");
		expect(result.toEnrich).toHaveLength(0);
		expect(result.unchanged).toEqual(["flour"]);
	});

	it("in onlyNew mode, treats every matched ingredient as unchanged and skips enrichment", async () => {
		const local = db({ flour: { aliases: ["farine"] } });
		const source = db({ flour: { category: "Grains" } });
		const result = await analyzeMerge(local, source, "db.yaml", true);
		expect(result.toEnrich).toHaveLength(0);
		expect(result.conflicts).toHaveLength(0);
		expect(result.unchanged).toEqual(["flour"]);
	});

	it("in onlyNew mode, still adds genuinely new ingredients", async () => {
		const local = db({ flour: {} });
		const source = db({ sugar: {} });
		const result = await analyzeMerge(local, source, "db.yaml", true);
		expect(result.toAdd).toEqual([{ key: "sugar", entry: source.sugar! }]);
	});
});

describe("loadSourceDb", () => {
	let tmpDir: string;

	afterEach(async () => {
		if (tmpDir) await unlink(tmpDir).catch(() => {});
	});

	it("throws a clear error when the file doesn't exist", async () => {
		await expect(loadSourceDb("/nonexistent/path/db.yaml")).rejects.toThrow(
			/Source file not found/,
		);
	});

	it("loads a valid database wrapped in an 'ingredients' key", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-merger-test-"));
		tmpDir = join(dir, "db.yaml");
		await writeFile(
			tmpDir,
			"ingredients:\n  flour:\n    name: Flour\n",
			"utf-8",
		);
		const result = await loadSourceDb(tmpDir);
		expect(result.flour?.name).toBe("Flour");
	});

	it("loads a database given as a bare top-level map (no 'ingredients' wrapper)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-merger-test-"));
		tmpDir = join(dir, "db.yaml");
		await writeFile(tmpDir, "flour:\n  name: Flour\n", "utf-8");
		const result = await loadSourceDb(tmpDir);
		expect(result.flour?.name).toBe("Flour");
	});

	it("throws when the resulting database is empty", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-merger-test-"));
		tmpDir = join(dir, "db.yaml");
		await writeFile(tmpDir, "ingredients: {}\n", "utf-8");
		await expect(loadSourceDb(tmpDir)).rejects.toThrow(
			/Source database is empty/,
		);
	});
});

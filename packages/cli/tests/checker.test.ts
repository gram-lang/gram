import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IngredientData } from "@gram-lang/analyzer";
import { checkFiles } from "../src/services/checker";

describe("checkFiles — warning severity", () => {
	// A Timer without a unit raises MISSING_UNIT, a 'warning'-level code —
	// it must not fail the build unless --strict is passed.
	const path = join(tmpdir(), `gram-checker-test-${Date.now()}.gram`);

	beforeAll(async () => {
		await writeFile(
			path,
			"---\ntitle: Wait\n---\n\n## Section\n\nWait for ~timer{10}.\n",
			"utf-8",
		);
	});

	afterAll(async () => {
		await unlink(path);
	});

	it('reports a nutritional/estimation warning as level "warning", not "error", by default', async () => {
		const result = await checkFiles([path]);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.level).toBe("warning");
		expect(result.hasErrors).toBe(false);
	});

	it('promotes the same warning to "error" under --strict', async () => {
		const result = await checkFiles([path], { strict: true });
		expect(result.diagnostics[0]?.level).toBe("error");
		expect(result.hasErrors).toBe(true);
	});
});

describe("checkFiles — deprecated frontmatter key", () => {
	// `servings:` still works but raises DEPRECATED_FRONTMATTER_KEY, a
	// 'warning': a strict CI run fails until it becomes `portions:`.
	const path = join(tmpdir(), `gram-checker-deprecated-${Date.now()}.gram`);

	beforeAll(async () => {
		await writeFile(
			path,
			"---\ntitle: Bread\nservings: 4\n---\n\n[Mix] @flour{500g}.\n",
			"utf-8",
		);
	});

	afterAll(async () => {
		await unlink(path);
	});

	const deprecated = (result: Awaited<ReturnType<typeof checkFiles>>) =>
		result.diagnostics.filter((d) =>
			d.message.startsWith('Frontmatter key "servings" is deprecated'),
		);

	it("reports it as a warning by default", async () => {
		const result = await checkFiles([path], { db: null });
		expect(deprecated(result).map((d) => d.level)).toEqual(["warning"]);
		expect(result.hasErrors).toBe(false);
	});

	it("fails under --strict", async () => {
		const result = await checkFiles([path], { db: null, strict: true });
		expect(deprecated(result).map((d) => d.level)).toEqual(["error"]);
		expect(result.hasErrors).toBe(true);
	});
});

describe("checkFiles — ingredients missing from the database", () => {
	// The database knows sugar, not flour: @flour is an UNKNOWN_INGREDIENT,
	// on its mention, the verdict the editor shows.
	const path = join(tmpdir(), `gram-checker-db-test-${Date.now()}.gram`);
	const db = { sugar: { name: "Sugar" } as unknown as IngredientData };

	beforeAll(async () => {
		await writeFile(
			path,
			"---\ntitle: Bread\n---\n\n## Section\n\nMix @flour{100 g}.\n",
			"utf-8",
		);
	});

	afterAll(async () => {
		await unlink(path);
	});

	const databaseDiagnostics = (r: Awaited<ReturnType<typeof checkFiles>>) =>
		r.diagnostics.filter((d) => d.code === "UNKNOWN_INGREDIENT");

	it('reports a missing ingredient as an "info", on its mention, by default', async () => {
		const result = await checkFiles([path], { db });
		const found = databaseDiagnostics(result);
		expect(found).toHaveLength(1);
		expect(found[0]?.level).toBe("info");
		expect([found[0]?.line, found[0]?.col]).toEqual([7, 5]);
		expect(result.diagnostics.map((d) => d.code)).not.toContain(
			"MISSING_INGREDIENT",
		);
		expect(result.hasErrors).toBe(false);
	});

	it('promotes a missing ingredient to "error" under --strict', async () => {
		const result = await checkFiles([path], { db, strict: true });
		const found = databaseDiagnostics(result);
		expect(found).toHaveLength(1);
		expect(found[0]?.level).toBe("error");
		expect(result.hasErrors).toBe(true);
	});

	it("keeps the database out of a strict run when it is skipped (--skip-db)", async () => {
		const result = await checkFiles([path], { db: null, strict: true });
		expect(databaseDiagnostics(result)).toHaveLength(0);
		expect(result.hasErrors).toBe(false);
	});
});

describe("checkFiles — syntax errors", () => {
	// The invalid-composite construct is on line 2 — this pins the diagnostic's
	// `line` to GramParseError.offset (via getAST), not a regex on the message.
	const path = join(tmpdir(), `gram-checker-syntax-test-${Date.now()}.gram`);

	beforeAll(async () => {
		await writeFile(path, "## Section\n@ <@parent\n", "utf-8");
	});

	afterAll(async () => {
		await unlink(path);
	});

	it("resolves the offset of a GramParseError to the correct line number", async () => {
		const result = await checkFiles([path]);
		expect(result.hasErrors).toBe(true);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.line).toBe(2);
	});
});

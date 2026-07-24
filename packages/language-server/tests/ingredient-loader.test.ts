import { describe, it, expect, afterEach } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadIngredientDB,
	lookupIngredient,
	buildIngredientLookupSet,
	isKnownIngredient,
} from "../src/ingredient-loader";

// Regression tests for the security/robustness audit (2026-07-22, finding
// B1): loadIngredientDB used to cast the parsed YAML straight to IngredientDB
// with zero validation. An entry missing `name` (or otherwise malformed)
// crashed the server the moment any lookup touched it — e.g. `entry.name` on
// undefined — because unlike the CLI, the LSP never called
// validateIngredientDatabase. A crash here kills every language feature for
// the whole editor session, not just one command.

describe("loadIngredientDB", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0))
			rmSync(dir, { recursive: true, force: true });
	});

	function writeDb(yaml: string): string {
		const dir = mkdtempSync(join(tmpdir(), "gram-lsp-db-test-"));
		dirs.push(dir);
		const path = join(dir, "ingredients.yaml");
		writeFileSync(path, yaml);
		return path;
	}

	it("returns an empty db with no rejections when the file doesn't exist", () => {
		const result = loadIngredientDB(join(tmpdir(), "does-not-exist.yaml"));
		expect(result.db).toEqual({});
		expect(result.rejected).toEqual([]);
	});

	it("drops a malformed entry (missing name) instead of crashing, and reports it", () => {
		const path = writeDb(
			[
				"ingredients:",
				"  flour:",
				"    name: Flour",
				"    physical: { density: 0.6 }",
				"  bad:",
				"    physical: { density: 1.0 }", // missing required `name`
			].join("\n"),
		);

		const result = loadIngredientDB(path);

		expect(Object.keys(result.db)).toEqual(["flour"]);
		expect(result.rejected).toHaveLength(1);
		expect(result.rejected[0]?.key).toBe("bad");
	});

	it("survives entirely invalid YAML content without throwing", () => {
		const path = writeDb(": : : not valid yaml : : :\n\t- broken");
		expect(() => loadIngredientDB(path)).not.toThrow();
		expect(loadIngredientDB(path)).toEqual({ db: {}, rejected: [] });
	});

	it("downstream lookups never see a malformed entry and never crash", () => {
		const path = writeDb(
			["ingredients:", "  bad:", "    aliases: [oups]"].join("\n"),
		);
		const { db } = loadIngredientDB(path);

		// Would throw on `entry.name.toLowerCase()` pre-fix if `bad` had leaked
		// through unvalidated.
		expect(() => lookupIngredient("oups", db)).not.toThrow();
		const set = buildIngredientLookupSet(db);
		expect(() => isKnownIngredient("oups", set)).not.toThrow();
		expect(isKnownIngredient("oups", set)).toBe(false);
	});
});

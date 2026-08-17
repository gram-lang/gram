import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	matchUseSpecifierPrefix,
	provideImportPathCompletions,
} from "../src/features/completions-imports";

describe("matchUseSpecifierPrefix", () => {
	it("matches an empty specifier right after the opening quote", () => {
		expect(matchUseSpecifierPrefix('@use "')).toBe("");
	});

	it("matches a partial specifier", () => {
		expect(matchUseSpecifierPrefix('@use "./bas')).toBe("./bas");
	});

	it("does not match once the closing quote is typed", () => {
		expect(matchUseSpecifierPrefix('@use "./base.gram"')).toBeNull();
	});

	it("does not match outside an @use line", () => {
		expect(matchUseSpecifierPrefix("[Mix] the @flour")).toBeNull();
	});

	it("tolerates leading whitespace before @use", () => {
		expect(matchUseSpecifierPrefix('  @use "./b')).toBe("./b");
	});
});

describe("provideImportPathCompletions", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-lspcomplete-"));
		dirs.push(dir);
		await mkdir(join(dir, ".gram"));
		for (const [name, content] of Object.entries(files)) {
			const filePath = join(dir, name);
			await mkdir(join(filePath, ".."), { recursive: true });
			await writeFile(filePath, content, "utf-8");
		}
		return dir;
	}

	it("offers the starting points when nothing has been typed", async () => {
		const dir = await project({});
		await writeFile(
			join(dir, ".gram", "config.yaml"),
			"paths:\n  bases: ./shared/bases\n",
		);
		const uri = pathToFileURL(join(dir, "tarte.gram")).toString();

		const items = provideImportPathCompletions("", uri);
		const labels = items.map((i) => i.label);
		expect(labels).toContain("./");
		expect(labels).toContain("../");
		expect(labels).toContain("@/");
		expect(labels).toContain("@bases/");
	});

	it("lists .gram files and subdirectories for a relative partial", async () => {
		const dir = await project({
			"base.gram": "## Base\n",
			"desserts/tarte.gram": "## Tarte\n",
			"notes.txt": "not a recipe",
		});
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("./", uri);
		const labels = items.map((i) => i.label);
		expect(labels).toContain("base.gram");
		expect(labels).toContain("desserts/");
		expect(labels).not.toContain("notes.txt");
	});

	it("lists files inside a subdirectory once the partial commits to it", async () => {
		const dir = await project({ "desserts/tarte.gram": "## Tarte\n" });
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("./desserts/", uri);
		expect(items.map((i) => i.label)).toEqual(["tarte.gram"]);
	});

	it("resolves @/ against the project root regardless of the importing file's own directory", async () => {
		const dir = await project({ "base.gram": "## Base\n" });
		const uri = pathToFileURL(
			join(dir, "recipes", "desserts", "top.gram"),
		).toString();

		const items = provideImportPathCompletions("@/", uri);
		expect(items.map((i) => i.label)).toContain("base.gram");
	});

	it("resolves a declared @alias/ path", async () => {
		const dir = await project({ "shared/bases/base.gram": "## Base\n" });
		await writeFile(
			join(dir, ".gram", "config.yaml"),
			"paths:\n  bases: ./shared/bases\n",
		);
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("@bases/", uri);
		expect(items.map((i) => i.label)).toEqual(["base.gram"]);
	});

	it("returns nothing for an undeclared alias instead of throwing", async () => {
		const dir = await project({});
		const uri = pathToFileURL(join(dir, "top.gram")).toString();
		expect(() => provideImportPathCompletions("@nope/", uri)).not.toThrow();
		expect(provideImportPathCompletions("@nope/", uri)).toEqual([]);
	});
});

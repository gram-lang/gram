import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transitiveDependents } from "@gram-lang/modules";
import { buildWatchReverseIndex } from "../src/core/watch-graph";

describe("buildWatchReverseIndex", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-watchgraph-"));
		dirs.push(dir);
		for (const [name, content] of Object.entries(files)) {
			await writeFile(join(dir, name), content, "utf-8");
		}
		return dir;
	}

	it("changing a base recipe reports the recipe that imports it as a dependent", async () => {
		const dir = await project({
			"base.gram": "## Base\n[Mix] the @flour{200g}.\n",
			"tarte.gram":
				'@use "./base.gram" as &base\n\n## Montage\n[Use] the &base{200g}.\n',
		});
		const base = join(dir, "base.gram");
		const tarte = join(dir, "tarte.gram");

		const index = await buildWatchReverseIndex(dir, dir);
		expect(transitiveDependents(index, base)).toEqual(new Set([tarte]));
	});

	it("a transitive chain reports every ancestor importer", async () => {
		const dir = await project({
			"base.gram": "## Base\n[Mix] the @flour{200g}.\n",
			"mid.gram":
				'@use "./base.gram" as &base\n\n## Mid ->&mid\n[Use] the &base{200g}.\n',
			"top.gram":
				'@use "./mid.gram" as &mid\n\n## Montage\n[Use] the &mid{200g}.\n',
		});
		const base = join(dir, "base.gram");
		const mid = join(dir, "mid.gram");
		const top = join(dir, "top.gram");

		const index = await buildWatchReverseIndex(dir, dir);
		expect(transitiveDependents(index, base)).toEqual(new Set([mid, top]));
	});

	it("a file with no importers has no dependents", async () => {
		const dir = await project({
			"a.gram": "## A\n[Mix] the @flour{200g}.\n",
			"b.gram": "## B\n[Mix] the @sugar{100g}.\n",
		});
		const a = join(dir, "a.gram");

		const index = await buildWatchReverseIndex(dir, dir);
		expect(transitiveDependents(index, a)).toEqual(new Set());
	});

	it("resolves @/ project-root imports", async () => {
		const dir = await project({
			"base.gram": "## Base\n[Mix] the @flour{200g}.\n",
			"tarte.gram":
				'@use "@/base.gram" as &base\n\n## Montage\n[Use] the &base{200g}.\n',
		});
		const base = join(dir, "base.gram");
		const tarte = join(dir, "tarte.gram");

		const index = await buildWatchReverseIndex(dir, dir);
		expect(transitiveDependents(index, base)).toEqual(new Set([tarte]));
	});

	it("skips a file that fails to parse rather than throwing", async () => {
		const dir = await project({
			"base.gram": "## Base\n[Mix] the @flour{200g}.\n",
			"broken.gram": '@use "./base.gram" as &base\n\n[[[',
		});

		const index = await buildWatchReverseIndex(dir, dir);
		expect(index).toBeInstanceOf(Map);
	});
});

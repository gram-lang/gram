import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterModuleRoots } from "../src/core/module-roots";

describe("filterModuleRoots", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-modroots-"));
		dirs.push(dir);
		for (const [name, content] of Object.entries(files)) {
			await writeFile(join(dir, name), content, "utf-8");
		}
		return dir;
	}

	it("excludes a file imported by another file in the same batch", async () => {
		const dir = await project({
			"base.gram": "## Base\n[Mix] the @flour{200g}.\n",
			"tarte.gram":
				'@use "./base.gram" as &base\n\n## Montage\n[Use] the &base{200g}.\n',
		});
		const base = join(dir, "base.gram");
		const tarte = join(dir, "tarte.gram");
		const roots = await filterModuleRoots([base, tarte], dir);
		expect(roots).toEqual([tarte]);
	});

	it("keeps every file when none of them import each other", async () => {
		const dir = await project({
			"a.gram": "## A\n[Mix] the @flour{200g}.\n",
			"b.gram": "## B\n[Mix] the @sugar{100g}.\n",
		});
		const a = join(dir, "a.gram");
		const b = join(dir, "b.gram");
		const roots = await filterModuleRoots([a, b], dir);
		expect(new Set(roots)).toEqual(new Set([a, b]));
	});

	it("excludes a transitively-imported file", async () => {
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
		const roots = await filterModuleRoots([base, mid, top], dir);
		expect(roots).toEqual([top]);
	});

	it("does not filter a single-file batch", async () => {
		const dir = await project({ "a.gram": "## A\n[Mix] the @flour{200g}.\n" });
		const a = join(dir, "a.gram");
		const roots = await filterModuleRoots([a], dir);
		expect(roots).toEqual([a]);
	});
});

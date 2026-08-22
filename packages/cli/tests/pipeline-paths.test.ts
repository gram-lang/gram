import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPipeline } from "../src/core/pipeline";

describe("runPipeline: '@/' and 'paths:' specifiers end-to-end", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-pipeline-paths-"));
		dirs.push(dir);
		for (const [name, content] of Object.entries(files)) {
			const path = join(dir, name);
			await mkdir(join(path, ".."), { recursive: true });
			await writeFile(path, content, "utf-8");
		}
		return dir;
	}

	it("resolves a bare '@/' specifier against the project root", async () => {
		const dir = await project({
			"base.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
			"tarte.gram":
				'@use "@/base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n',
		});
		const { compiled } = await runPipeline(join(dir, "tarte.gram"));
		expect(compiled.warnings).toEqual([]);
		const ids = (compiled.shopping_list as any[]).map((i) => i.id);
		expect(ids).toContain("flour");
	});

	it("resolves an '@alias/' specifier via the paths: option", async () => {
		const dir = await project({
			"shared/bases/pate.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
			"main.gram":
				'@use "@bases/pate.gram" as &pate\n\n## Montage\n\n[Use] the &pate{200g}.\n',
		});
		const { compiled } = await runPipeline(join(dir, "main.gram"), {
			paths: { bases: "./shared/bases" },
		});
		expect(compiled.warnings).toEqual([]);
		const ids = (compiled.shopping_list as any[]).map((i) => i.id);
		expect(ids).toContain("flour");
	});

	it("reports MODULE_SPECIFIER_INVALID for an undeclared '@alias/' specifier", async () => {
		const dir = await project({
			"main.gram":
				'@use "@bases/pate.gram" as &pate\n\n## Montage\n\n[Use] the &pate{200g}.\n',
		});
		const { compiled } = await runPipeline(join(dir, "main.gram"));
		expect(compiled.warnings.map((w) => w.code)).toContain(
			"MODULE_SPECIFIER_INVALID",
		);
	});
});
